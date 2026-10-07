/**
 * Los textos del portal (superficie `copy`) a mano de quien NO es un componente.
 *
 * `useCopy` sirve a las pantallas. Pero `describeBlocker`, `describeLifecycle` y la etiqueta de cada etapa
 * del alta son funciones que se llaman desde varios sitios (listas, cabeceras, avisos), y no pueden usar un
 * hook. Aquí se guarda lo que llegó del portal para que esas funciones lo lean de forma síncrona. Es una
 * hoja a propósito —no importa nada de la app— para que `onboarding-map` pueda leerla sin cerrar un ciclo
 * con el catálogo, que a su vez importa `onboarding-map`.
 *
 * Una pantalla que use esas funciones debe llamar a `useCopy()` igualmente: es lo que la vuelve a pintar
 * cuando el contenido llega (la caché se llena antes de avisar a los componentes).
 */
import type { ContentEntry } from '../api/endpoints/app-content';

export type CopyRemoto = { title: string; body: string };

let cache: Readonly<Record<string, CopyRemoto>> = {};

const limpio = (valor: string | null | undefined): string => (typeof valor === 'string' ? valor.trim() : '');

/** Sólo entran las piezas con texto; una en blanco no tapa el de fábrica. */
export function recordarCopyRemoto(entries: readonly ContentEntry[]): void {
  const siguiente: Record<string, CopyRemoto> = {};
  for (const entry of entries) {
    const body = limpio(entry.body) || limpio(entry.subtitle);
    const title = limpio(entry.title);
    if (title || body) siguiente[entry.contentKey] = { title, body };
  }
  cache = siguiente;
}

export function copyRemoto(clave: string): CopyRemoto | undefined {
  return cache[clave];
}

/** Sólo para pruebas. */
export function olvidarCopyRemoto(): void {
  cache = {};
}
