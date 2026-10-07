/**
 * El latido de la sesion abierta, con la app en PRIMER PLANO.
 *
 * ## Por que existe
 *
 * El job `expire_stale_sessions` de AtlasBackend cierra las sesiones de cliente por
 * `COALESCE(last_activity_at, started_at) < ahora − RUNTIME_JOBS_SESSION_MAX_IDLE_MINUTES` (120 min
 * por defecto), y `last_activity_at` solo lo escribe `POST .../sessions/:sessionId/heartbeat`. La app
 * abria y cerraba la sesion pero nunca latia: quien la usaba mas de dos horas seguidas se quedaba con
 * la sesion caducada a mitad de uso.
 *
 * ## Cuando late
 *
 *  - Al VOLVER a primer plano (`AppState` pasa a `active` desde `background`/`inactive`): es el caso
 *    comun, alguien abre la app, la deja y vuelve.
 *  - Cada `CADENCIA_LATIDO_MS` mientras sigue en primer plano.
 *
 * No late al montarse: la sesion se acaba de abrir y `started_at` ya cuenta como actividad.
 *
 * ## Nada en segundo plano
 *
 * Al irse a segundo plano se para el temporizador y se corta la llamada en curso (con sus
 * reintentos). Una sesion que nadie mira no tiene por que mantenerse viva: si la persona tarda mas de
 * la ventana en volver, que caduque es lo correcto.
 *
 * ## Falla en silencio, pero no a ciegas
 *
 * Un latido perdido es una anotacion menos: se deja constancia en el log y la UI no se entera. No se
 * encadenan intentos: mientras uno esta en curso el siguiente tic se salta, y el cliente HTTP ya
 * acota sus propios reintentos. Si el servidor responde que la sesion ya no sirve —422
 * `SESSION_NOT_ACTIVE`, 404, 403, 400—, se deja de latir para ESA sesion: repetirlo cada cinco minutos
 * no la resucitaria.
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { newIdempotencyKey } from '../api/client';
import * as customerApi from '../api/endpoints/customer';
import { AtlasApiError } from '../api/errors';

/**
 * Cada cuanto late con la app abierta.
 *
 * Cinco minutos frente a una ventana de caducidad de 120: cabe perder una veintena seguidos antes de
 * que el job cierre una sesion en uso, y el coste es una peticion pequeña cada cinco minutos.
 */
export const CADENCIA_LATIDO_MS = 5 * 60 * 1000;

export type ContextoDeLatido = { customerId: string; sessionId: string; deviceId: string };

/** Respuestas que dicen que esta sesion ya no admite latidos: insistir no cambia nada. */
function esDefinitivo(error: unknown): boolean {
  return error instanceof AtlasApiError && (error.kind === 'validation' || error.kind === 'not_found' || error.kind === 'permission');
}

const enSegundoPlano = (estado: AppStateStatus) => /inactive|background/.test(estado);

export function useLatidoDeSesion(contexto: ContextoDeLatido | null): void {
  // Primitivas y no el objeto: un objeto nuevo en cada render reiniciaria el temporizador y, con una
  // cadencia de cinco minutos, bastaria un repintado antes para que nunca latiera.
  const customerId = contexto?.customerId ?? null;
  const sessionId = contexto?.sessionId ?? null;
  const deviceId = contexto?.deviceId ?? null;

  useEffect(() => {
    if (!customerId || !sessionId || !deviceId) return;

    let temporizador: ReturnType<typeof setInterval> | null = null;
    let enCurso: AbortController | null = null;
    let detenido = false;

    const cortarLlamada = () => {
      enCurso?.abort();
      enCurso = null;
    };
    const parar = () => {
      if (temporizador) clearInterval(temporizador);
      temporizador = null;
    };

    const latir = () => {
      if (detenido || enCurso || enSegundoPlano(AppState.currentState)) return;
      const control = new AbortController();
      enCurso = control;
      customerApi
        .sessionHeartbeat(
          customerId,
          sessionId,
          { deviceId, clientHeartbeatId: `hb-${newIdempotencyKey()}`, capturedAt: new Date().toISOString() },
          { signal: control.signal },
        )
        .catch((error: unknown) => {
          if (control.signal.aborted) return;
          const codigo = error instanceof AtlasApiError ? `${error.status ?? '-'} ${error.code}` : String(error);
          console.warn(`[sesion] latido de la sesion ${sessionId} no enviado: ${codigo}`);
          if (esDefinitivo(error)) {
            detenido = true;
            parar();
          }
        })
        .finally(() => {
          if (enCurso === control) enCurso = null;
        });
    };

    const arrancar = () => {
      if (!temporizador && !detenido) temporizador = setInterval(latir, CADENCIA_LATIDO_MS);
    };

    if (!enSegundoPlano(AppState.currentState)) arrancar();

    let anterior = AppState.currentState;
    const suscripcion = AppState.addEventListener('change', (estado: AppStateStatus) => {
      if (estado === 'active' && enSegundoPlano(anterior)) {
        latir();
        arrancar();
      } else if (enSegundoPlano(estado)) {
        parar();
        cortarLlamada();
      }
      anterior = estado;
    });

    return () => {
      detenido = true;
      parar();
      cortarLlamada();
      suscripcion.remove();
    };
  }, [customerId, sessionId, deviceId]);
}
