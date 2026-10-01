/**
 * El rastreo con la app ABIERTA: un temporizador y el regreso desde segundo plano.
 *
 * ## Por que hacen falta las dos cosas
 *
 * El temporizador cubre a quien deja la app abierta un rato. El evento de `AppState` cubre el caso
 * mucho mas comun: alguien abre la app, la deja, vuelve media hora despues. Sin ese evento, el
 * temporizador de JavaScript —que el sistema congela en segundo plano— habria perdido esos treinta
 * minutos y la siguiente medida llegaria tarde y sin explicacion.
 *
 * ## Por que no mide nada mas al montarse
 *
 * Porque la medida de apertura ya la toma `activarSeñalesDelDispositivo` como `session_start`, y es
 * la que interesa: dice desde donde entro. Medir otra vez aqui, un segundo despues, produciria dos
 * filas casi identicas y ninguna informacion nueva.
 *
 * ## Falla en silencio, como todo lo demas
 *
 * Una posicion que no se puede tomar o enviar es una anotacion menos. No hay nada que contarle a la
 * persona y desde luego nada que impedirle hacer.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { medirYEnviar } from '../device/location';
import type { ContextoDeRastreo } from '../device/tracking-context';
import { CADENCIA_PRIMER_PLANO_MS } from '../features/rastreo';
import { reintentarAgendaPendiente } from './device-signals';

export function useRastreoEnPrimerPlano(contexto: ContextoDeRastreo | null, activo: boolean): void {
  /*
    El contexto va en una referencia y no en las dependencias del efecto.

    Si entrara como dependencia, cada renderizado con un objeto nuevo —y `contexto` se construye en
    cada renderizado— reinstalaria el temporizador desde cero, y con una cadencia de cinco minutos
    eso significa que NUNCA se cumpliria: bastaria con que la pantalla se repintara antes.
  */
  const referencia = useRef(contexto);
  referencia.current = contexto;

  useEffect(() => {
    if (!activo) return;

    const medir = () => {
      const actual = referencia.current;
      if (!actual) return;
      void medirYEnviar(actual, 'foreground');
    };

    const temporizador = setInterval(medir, CADENCIA_PRIMER_PLANO_MS);

    let anterior = AppState.currentState;
    const suscripcion = AppState.addEventListener('change', (estado: AppStateStatus) => {
      // Solo al VOLVER: `change` tambien dispara al irse a segundo plano, y medir ahi gastaria el
      // GPS justo cuando la persona ya no esta mirando.
      if (anterior.match(/inactive|background/) && estado === 'active') {
        medir();
        // Y si la agenda quedo a medias —un corte de red a mitad de la subida— se completa ahora.
        const actual = referencia.current;
        if (actual) void reintentarAgendaPendiente(actual);
      }
      anterior = estado;
    });

    return () => {
      clearInterval(temporizador);
      suscripcion.remove();
    };
  }, [activo]);
}
