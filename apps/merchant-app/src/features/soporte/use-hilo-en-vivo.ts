/**
 * Una conversación con soporte, en vivo: la transcripción, el hilo SSE, «escribiendo…» y el doble tic.
 *
 * Es el `useEffect` de `MerchantSupportScreen` de la web llevado a un gancho, con lo que el teléfono
 * añade al ciclo de vida:
 *
 *  - **Segundo plano.** iOS y Android cortan las conexiones de una app que no está a la vista, y la
 *    reconexión a ciegas desde segundo plano gastaría batería para nada. Al salir se CIERRA el hilo;
 *    al volver se relee la transcripción (lo que llegó mientras tanto) y se reabre.
 *  - **Desmontar.** Salir de la pantalla cierra el hilo, igual que en la web: una suscripción viva
 *    por cada navegación acabaría con varias conexiones escuchando la misma conversación.
 *  - **Canal cerrado por el agente.** Se avisa (`cerrado`) para que la pantalla deje de ofrecer escribir.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  supportService,
  suscribirseAlChat,
  type EstadoDeLectura,
  type MensajeDeSoporte,
} from '@/api/servicios/supportService';
import { agregarMensaje, aplicarLectura, efectoDelEvento, TEXTOS } from './chat';

/** Cuánto dura «Atlas está escribiendo…» sin un aviso nuevo. El de la web. */
const ESCRIBIENDO_MS = 3000;

export interface HiloEnVivo {
  mensajes: MensajeDeSoporte[];
  readState: EstadoDeLectura[];
  escribiendo: boolean;
  conectado: boolean;
  cargando: boolean;
  /** El agente cerró el canal mientras se miraba. */
  cerrado: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  /** Lo que devolvió el envío, para que aparezca sin esperar al hilo. */
  agregar: (mensaje: MensajeDeSoporte) => void;
}

export function useHiloEnVivo(channelId: string): HiloEnVivo {
  const [mensajes, setMensajes] = useState<MensajeDeSoporte[]>([]);
  const [readState, setReadState] = useState<EstadoDeLectura[]>([]);
  const [escribiendo, setEscribiendo] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cerrado, setCerrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enPrimerPlano, setEnPrimerPlano] = useState(AppState.currentState === 'active');
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => setEnPrimerPlano(estado === 'active'));
    return () => suscripcion.remove();
  }, []);

  /** Marcar leído al mirar, y no antes: un mensaje que llega en segundo plano no lo ha leído nadie. */
  const marcarLeido = useCallback(
    (sequence: string | undefined) => {
      if (sequence) void supportService.marcarLeido(channelId, sequence).catch(() => undefined);
    },
    [channelId],
  );

  const cargarConversacion = useCallback(async () => {
    const transcripcion = await supportService.leerConversacion(channelId);
    if (!montado.current) return;
    setMensajes(transcripcion.messages);
    setReadState(transcripcion.readState);
    marcarLeido(transcripcion.messages.at(-1)?.sequence);
  }, [channelId, marcarLeido]);

  useEffect(() => {
    if (!channelId || !enPrimerPlano) return undefined;
    setCargando(true);
    cargarConversacion()
      .catch(() => {
        if (montado.current) setError(TEXTOS.noCargoConversacion);
      })
      .finally(() => {
        if (montado.current) setCargando(false);
      });

    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const cerrar = suscribirseAlChat(
      channelId,
      (evento) => {
        if (!montado.current) return;
        const efecto = efectoDelEvento(evento);
        if (!efecto) return;
        if (efecto.tipo === 'mensaje') {
          setMensajes((previos) => agregarMensaje(previos, efecto.mensaje));
          marcarLeido(String(efecto.mensaje.sequence));
        } else if (efecto.tipo === 'escribiendo') {
          setEscribiendo(true);
          if (temporizador) clearTimeout(temporizador);
          temporizador = setTimeout(() => {
            if (montado.current) setEscribiendo(false);
          }, ESCRIBIENDO_MS);
        } else if (efecto.tipo === 'leido') {
          setReadState((previos) => aplicarLectura(previos, efecto.actorType, efecto.upToSequence));
        } else {
          setCerrado(true);
        }
      },
      (enLinea) => {
        if (montado.current) setConectado(enLinea);
      },
    );

    return () => {
      if (temporizador) clearTimeout(temporizador);
      cerrar();
    };
  }, [channelId, enPrimerPlano, cargarConversacion, marcarLeido]);

  const agregar = useCallback((mensaje: MensajeDeSoporte) => setMensajes((previos) => agregarMensaje(previos, mensaje)), []);

  return { mensajes, readState, escribiendo, conectado, cargando, cerrado, error, setError, agregar };
}
