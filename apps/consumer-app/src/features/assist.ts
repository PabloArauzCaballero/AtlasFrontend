/**
 * El estado del asistente de la app, del lado de la pantalla.
 *
 * Reúne lo que la hoja de chat no debería tener que saber: cómo se rehidrata el hilo, qué se hace
 * con cada clase de fallo y por qué un reintento NUNCA genera una segunda respuesta facturada.
 *
 * ## La clave de idempotencia vive aquí
 *
 * `clientMessageId` se genera al enviar y SE CONSERVA mientras ese mensaje no tenga respuesta:
 * el reintento —manual o por el 409 de «sigue en curso»— viaja con la misma clave y recoge la
 * respuesta que el servidor ya guardó. Es el mismo contrato que el chat de soporte.
 *
 * ## El 404 no es un fallo: es el interruptor
 *
 * Con el asistente apagado en el servidor, todo contesta 404 `ASSIST_DISABLED`. Aquí eso se
 * traduce en `disponible: false`, y el botón flotante desaparece entero: un botón que abre una
 * hoja rota es peor que ningún botón.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as assistApi from '../api/endpoints/assist';
import { newIdempotencyKey } from '../api/client';
import { AtlasApiError } from '../api/errors';

/** Cuánto se espera cuando el servidor dice «la misma consulta sigue en curso» (409). */
const ESPERA_EN_CURSO_MS = 2_000;
/** Cuántas veces se insiste en silencio antes de enseñar el error con su botón de reintento. */
const INTENTOS_EN_CURSO = 5;

/**
 * Las preguntas del estado vacío. Salen del catálogo del asistente —son temas que SÍ sabe
 * contestar— y existen para que la primera pantalla no sea un campo en blanco frente a un robot.
 */
export const PREGUNTAS_FRECUENTES = [
  '¿Qué es Atlas y cómo funciona?',
  '¿Cómo compro con QR en un comercio?',
  '¿Cómo pago una cuota?',
] as const;

export type BurbujaAssist = {
  /** El `turnId` del servidor, o la clave local mientras no hay respuesta. */
  id: string;
  rol: 'persona' | 'asistente';
  texto: string;
  /** El asistente pidió ofrecer el chat humano en primer plano. */
  sugiereHumano?: boolean;
};

export type EstadoAssist =
  | { fase: 'cargando' }
  | { fase: 'lista' }
  | { fase: 'enviando' }
  | { fase: 'error'; mensaje: string };

type Pendiente = { texto: string; clientMessageId: string };

function mensajeDeError(error: unknown): string {
  if (error instanceof AtlasApiError) {
    if (error.kind === 'network' || error.kind === 'timeout') {
      return 'Sin conexión. Revisa tu internet y vuelve a intentar.';
    }
    // El backend redacta sus errores para la persona (topes, datos sensibles, indisponibilidad).
    if (['validation', 'rate_limited', 'unavailable', 'conflict'].includes(error.kind)) return error.message;
  }
  return 'El asistente no está disponible en este momento. Puedes hablar con una persona desde Soporte.';
}

function esApagado(error: unknown): boolean {
  return error instanceof AtlasApiError && (error.code === 'ASSIST_DISABLED' || error.status === 404);
}

/**
 * El hilo con el asistente. Un solo hook para el botón y la hoja, porque comparten la misma
 * pregunta —«¿existe el asistente en este despliegue?»— y el hilo tiene que sobrevivir a que la
 * hoja se cierre y se vuelva a abrir.
 */
export function useAssist() {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [burbujas, setBurbujas] = useState<BurbujaAssist[]>([]);
  const [estado, setEstado] = useState<EstadoAssist>({ fase: 'cargando' });
  const conversationId = useRef<string | null>(null);
  const pendiente = useRef<Pendiente | null>(null);
  /*
    El candado es «hay una petición EN VIAJE», no «hay un mensaje sin responder»: tras un error la
    persona puede reintentar el que falló O escribir otra cosa, y las dos puertas deben abrirse.
    Sólo mientras se espera al servidor no se envía nada más.
  */
  const enViaje = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  /*
    La sonda y la rehidratación son la MISMA llamada: el hilo vigente. Si contesta, el asistente
    existe y además la hoja abre con lo que ya se habló; si contesta 404, el botón no se pinta.
    Cualquier otro fallo deja el botón: no poder leer lo de ayer no impide preguntar hoy.
  */
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const hilo = await assistApi.conversacion();
        if (cancelado) return;
        conversationId.current = hilo.conversationId;
        setBurbujas(
          hilo.turns.flatMap((turno) => [
            { id: `${turno.turnId}-p`, rol: 'persona' as const, texto: turno.prompt },
            { id: turno.turnId, rol: 'asistente' as const, texto: turno.reply, sugiereHumano: turno.suggestHandoff },
          ]),
        );
        setDisponible(true);
        setEstado({ fase: 'lista' });
      } catch (error) {
        if (cancelado) return;
        if (esApagado(error)) {
          setDisponible(false);
          return;
        }
        // El hilo no se pudo leer; preguntar sigue siendo posible. Se abre con el hilo vacío.
        setDisponible(true);
        setEstado({ fase: 'lista' });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const preguntar = useCallback(async (texto: string, pantalla: assistApi.AssistScreen, clientMessageId: string) => {
    enViaje.current = true;
    setEstado({ fase: 'enviando' });
    let intentos = 0;
    for (;;) {
      try {
        const respuesta = await assistApi.preguntar({
          prompt: texto,
          clientMessageId,
          ...(conversationId.current ? { conversationId: conversationId.current } : {}),
          screen: pantalla,
        });
        enViaje.current = false;
        if (!montado.current) return;
        conversationId.current = respuesta.conversationId ?? conversationId.current;
        pendiente.current = null;
        setBurbujas((actuales) => [
          ...actuales,
          {
            // Con sufijo propio: sin base de datos el servidor no manda `turnId`, y la clave de
            // esta burbuja no puede chocar con la de la pregunta (`local-<clave>`). Medido en el
            // navegador: React avisaba de claves duplicadas y podía duplicar u omitir burbujas.
            id: respuesta.turnId ?? `local-r-${clientMessageId}`,
            rol: 'asistente',
            texto: respuesta.reply,
            sugiereHumano: respuesta.suggestHandoff,
          },
        ]);
        setEstado({ fase: 'lista' });
        return;
      } catch (error) {
        if (esApagado(error)) {
          enViaje.current = false;
          if (montado.current) setDisponible(false);
          return;
        }
        /*
          El 409 dice «esa MISMA consulta sigue en curso»: la respuesta viene en camino y se
          recoge reintentando con la misma clave. Se insiste en silencio unas veces —con la
          espera que pide el servidor— antes de molestar a la persona con un error.
        */
        const enCurso = error instanceof AtlasApiError && error.kind === 'conflict';
        if (enCurso && intentos < INTENTOS_EN_CURSO) {
          intentos += 1;
          await new Promise((resolver) => setTimeout(resolver, ESPERA_EN_CURSO_MS));
          continue;
        }
        enViaje.current = false;
        if (montado.current) setEstado({ fase: 'error', mensaje: mensajeDeError(error) });
        return;
      }
    }
  }, []);

  /** Envía una pregunta nueva. La burbuja propia aparece al instante; la clave queda guardada. */
  const enviar = useCallback(
    (texto: string, pantalla: assistApi.AssistScreen) => {
      const limpio = texto.trim();
      if (!limpio || enViaje.current) return;
      const clientMessageId = newIdempotencyKey();
      pendiente.current = { texto: limpio, clientMessageId };
      setBurbujas((actuales) => [...actuales, { id: `local-${clientMessageId}`, rol: 'persona', texto: limpio }]);
      void preguntar(limpio, pantalla, clientMessageId);
    },
    [preguntar],
  );

  /** Reintenta el último mensaje CON LA MISMA clave: recoge la respuesta guardada, no genera otra. */
  const reintentar = useCallback(
    (pantalla: assistApi.AssistScreen) => {
      const previo = pendiente.current;
      if (!previo || enViaje.current) return;
      void preguntar(previo.texto, pantalla, previo.clientMessageId);
    },
    [preguntar],
  );

  return { disponible, burbujas, estado, enviar, reintentar };
}
