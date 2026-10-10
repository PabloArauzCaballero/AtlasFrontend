/**
 * El estado del asistente del comercio, del lado de la pantalla.
 *
 * Tiene la MISMA forma que `useAssist` de la app del cliente (`apps/consumer-app/src/features/assist.ts`)
 * —`disponible`, `burbujas`, `estado`, `historial`, `enviar`, `reintentar`…— para que la hoja se lea
 * igual en las dos apps. Lo que cambia es de dónde sale: aquí habla con la pasarela del ERP
 * (`assistService`, superficie `merchant-portal`) y no con `/mobile/assist/*`; y `pantalla` es el
 * nombre de la sección («Gestión POS»), no un vocabulario cerrado.
 *
 * ## La llave de idempotencia vive aquí
 *
 * `clientMessageId` se genera al enviar y SE CONSERVA mientras ese mensaje no tenga respuesta: el
 * reintento viaja con la misma llave y recoge la respuesta que Core ya guardó. El 409 «sigue en
 * curso» lo resuelve el servicio en silencio (`conReintentoEnCurso`, con `Retry-After`).
 *
 * ## El 404 es el interruptor
 *
 * La sonda es la lectura del hilo vigente: si contesta, el asistente existe y la hoja abre con lo
 * ya hablado; si contesta 404, `disponible` pasa a `false` y el botón flotante no se pinta. Un botón
 * que abre una hoja rota es peor que ningún botón. (La web lo deja visible y dice «apagado» en el
 * panel; en el teléfono se sigue a la app del cliente.)
 */
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { assistService, type ResumenDeConversacion, type TurnoDelAsistente } from '@/api/servicios/assistService';
import { describirErrorDelAsistente, esApagado } from './asistente';

export type BurbujaAsistente = {
  /** El `turnId` del servidor, o la clave local mientras no hay respuesta. */
  id: string;
  rol: 'persona' | 'asistente';
  texto: string;
  /** El asistente pidió ofrecer el soporte humano en primer plano. */
  sugiereHumano?: boolean;
  /** El texto salió de la guía, sin modelo de lenguaje (`mode: 'sin-ia'`). */
  sinIa?: boolean;
};

export type EstadoAsistente = { fase: 'cargando' } | { fase: 'lista' } | { fase: 'enviando' } | { fase: 'error'; mensaje: string };

/** Una fila del historial con el título ya resuelto (Core puede mandarlo `null`). */
export type ConversacionResumida = Omit<ResumenDeConversacion, 'title'> & {
  title: string;
};

/** La lista del historial: sus cuatro caras. Un fallo aquí NUNCA toca el estado del chat. */
export type EstadoHistorial =
  { fase: 'inactivo' } | { fase: 'cargando' } | { fase: 'lista'; items: ConversacionResumida[] } | { fase: 'error'; mensaje: string };

type Pendiente = { texto: string; clientMessageId: string };

export function turnosABurbujas(turnos: TurnoDelAsistente[] | undefined): BurbujaAsistente[] {
  return (turnos ?? []).flatMap((turno) => [
    { id: `${turno.turnId}-p`, rol: 'persona' as const, texto: turno.prompt },
    {
      id: turno.turnId,
      rol: 'asistente' as const,
      texto: turno.reply,
      sugiereHumano: turno.suggestHandoff,
      sinIa: turno.mode === 'sin-ia',
    },
  ]);
}

function sinConexion(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

/**
 * El hilo con el asistente. Un solo hook para el botón y la hoja, porque comparten la misma pregunta
 * —«¿existe el asistente en este ambiente?»— y el hilo tiene que sobrevivir a cerrar y reabrir la hoja.
 */
export function useAsistente() {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [burbujas, setBurbujas] = useState<BurbujaAsistente[]>([]);
  const [estado, setEstado] = useState<EstadoAsistente>({ fase: 'cargando' });
  const conversationId = useRef<string | null>(null);
  /** Espejo de `conversationId` para marcar cuál es la conversación abierta en el historial. */
  const [actualId, setActualId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<EstadoHistorial>({
    fase: 'inactivo',
  });
  /** Un aviso de la última acción del historial (abrir o borrar). Se limpia al volver a intentar. */
  const [avisoHistorial, setAvisoHistorial] = useState<string | null>(null);
  const cargaHistorial = useRef(0);
  const pendiente = useRef<Pendiente | null>(null);
  /*
    El candado es «hay una petición EN VIAJE», no «hay un mensaje sin responder»: tras un error la
    persona puede reintentar el que falló O escribir otra cosa. Sólo mientras se espera al servidor
    no se envía nada más.
  */
  const enViaje = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // La sonda y la rehidratación son la MISMA llamada. Cualquier fallo que no sea 404 deja el botón:
  // no poder leer lo de ayer no impide preguntar hoy.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const hilo = await assistService.conversacion();
        if (cancelado) return;
        conversationId.current = hilo?.conversationId ?? null;
        setActualId(conversationId.current);
        setBurbujas(turnosABurbujas(hilo?.turns));
        setDisponible(true);
      } catch (error) {
        if (cancelado) return;
        if (esApagado(error)) {
          setDisponible(false);
          return;
        }
        setDisponible(true);
      }
      setEstado({ fase: 'lista' });
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const preguntar = useCallback(async (texto: string, pantalla: string, clientMessageId: string) => {
    enViaje.current = true;
    setEstado({ fase: 'enviando' });
    try {
      const respuesta = await assistService.preguntar({
        prompt: texto,
        clientMessageId,
        ...(conversationId.current ? { conversationId: conversationId.current } : {}),
        ...(pantalla ? { screen: pantalla } : {}),
      });
      enViaje.current = false;
      if (!montado.current) return;
      conversationId.current = respuesta.conversationId ?? conversationId.current;
      setActualId(conversationId.current);
      pendiente.current = null;
      setBurbujas((actuales) => [
        ...actuales,
        {
          // Con sufijo propio: sin base de datos Core no manda `turnId`, y la clave de esta burbuja no
          // puede chocar con la de la pregunta (`local-<llave>`).
          id: respuesta.turnId || `local-r-${clientMessageId}`,
          rol: 'asistente',
          texto: respuesta.reply,
          sugiereHumano: respuesta.suggestHandoff,
          sinIa: respuesta.mode === 'sin-ia',
        },
      ]);
      setEstado({ fase: 'lista' });
    } catch (error) {
      enViaje.current = false;
      if (!montado.current) return;
      if (esApagado(error)) {
        setDisponible(false);
        setEstado({ fase: 'lista' });
        return;
      }
      setEstado({
        fase: 'error',
        mensaje: describirErrorDelAsistente(error),
      });
    }
  }, []);

  /** Envía una pregunta nueva. La burbuja propia aparece al instante; la llave queda guardada. */
  const enviar = useCallback(
    (texto: string, pantalla: string) => {
      const limpio = texto.trim();
      if (!limpio || enViaje.current) return;
      // UUID v4 SIEMPRE: Core valida `clientMessageId` como UUID.
      const clientMessageId = randomUUID();
      pendiente.current = { texto: limpio, clientMessageId };
      setBurbujas((actuales) => [...actuales, { id: `local-${clientMessageId}`, rol: 'persona', texto: limpio }]);
      void preguntar(limpio, pantalla, clientMessageId);
    },
    [preguntar],
  );

  /** Reintenta el último mensaje CON LA MISMA llave: recoge la respuesta guardada, no genera otra. */
  const reintentar = useCallback(
    (pantalla: string) => {
      const previo = pendiente.current;
      if (!previo || enViaje.current) return;
      void preguntar(previo.texto, pantalla, previo.clientMessageId);
    },
    [preguntar],
  );

  /** Deja el hilo en blanco. Nada viaja al servidor: la conversación nueva nace con el primer envío. */
  const reiniciarHilo = useCallback(() => {
    conversationId.current = null;
    pendiente.current = null;
    setActualId(null);
    setBurbujas([]);
    setEstado({ fase: 'lista' });
  }, []);

  /**
   * «Nueva conversación». No se permite con una petición en viaje, porque su respuesta caería en un
   * hilo que la persona ya dejó. Devuelve si se hizo.
   */
  const nuevaConversacion = useCallback((): boolean => {
    if (enViaje.current) return false;
    reiniciarHilo();
    setAvisoHistorial(null);
    return true;
  }, [reiniciarHilo]);

  /** Trae la lista del historial. Si dos cargas se cruzan, sólo cuenta la última. */
  const cargarHistorial = useCallback(async () => {
    const turno = ++cargaHistorial.current;
    setAvisoHistorial(null);
    setHistorial({ fase: 'cargando' });
    try {
      const conversaciones = await assistService.conversaciones();
      if (!montado.current || turno !== cargaHistorial.current) return;
      setHistorial({
        fase: 'lista',
        items: conversaciones.map((c) => ({
          ...c,
          title: c.title?.trim() || 'Conversación sin título',
        })),
      });
    } catch (error) {
      if (!montado.current || turno !== cargaHistorial.current) return;
      setHistorial({
        fase: 'error',
        mensaje: sinConexion(error)
          ? 'Sin conexión. Revisa tu internet y vuelve a intentar.'
          : 'No pudimos cargar tus conversaciones. Intenta de nuevo.',
      });
    }
  }, []);

  /** Abre una conversación anterior para seguirla: sus mensajes y su id quedan como el hilo vigente. */
  const abrirConversacion = useCallback(async (id: string): Promise<boolean> => {
    if (enViaje.current) return false;
    enViaje.current = true;
    setAvisoHistorial(null);
    try {
      const detalle = await assistService.abrir(id);
      enViaje.current = false;
      if (!montado.current) return false;
      conversationId.current = detalle?.conversationId ?? id;
      pendiente.current = null;
      setActualId(conversationId.current);
      setBurbujas(turnosABurbujas(detalle?.turns));
      setEstado({ fase: 'lista' });
      return true;
    } catch (error) {
      enViaje.current = false;
      if (!montado.current) return false;
      const yaNoExiste = error instanceof ApiError && error.status === 404;
      if (yaNoExiste) {
        setHistorial((h) =>
          h.fase === 'lista'
            ? {
                fase: 'lista',
                items: h.items.filter((c) => c.conversationId !== id),
              }
            : h,
        );
      }
      setAvisoHistorial(yaNoExiste ? 'Esa conversación ya no existe.' : 'No pudimos abrir la conversación. Intenta de nuevo.');
      return false;
    }
  }, []);

  /** Borra una conversación. Si era la abierta, el hilo se reinicia. Devuelve si quedó borrada. */
  const borrarConversacion = useCallback(
    async (id: string): Promise<boolean> => {
      if (enViaje.current && id === conversationId.current) return false;
      setAvisoHistorial(null);
      try {
        await assistService.borrar(id);
      } catch {
        if (montado.current) setAvisoHistorial('No pudimos borrar la conversación. Intenta de nuevo.');
        return false;
      }
      if (!montado.current) return true;
      setHistorial((h) =>
        h.fase === 'lista'
          ? {
              fase: 'lista',
              items: h.items.filter((c) => c.conversationId !== id),
            }
          : h,
      );
      if (id === conversationId.current) reiniciarHilo();
      return true;
    },
    [reiniciarHilo],
  );

  return {
    disponible,
    burbujas,
    estado,
    actualId,
    historial,
    avisoHistorial,
    enviar,
    reintentar,
    nuevaConversacion,
    cargarHistorial,
    abrirConversacion,
    borrarConversacion,
  };
}

export type Asistente = ReturnType<typeof useAsistente>;
