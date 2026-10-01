/**
 * El historial de posiciones, GUARDADO EN EL TELEFONO.
 *
 * ## Por que existe, si cada posicion ya se sube
 *
 * Porque lo que se sube no vuelve: el servidor no le devuelve a la persona su propio rastro —le
 * ensenaria justo donde mover el telefono para que la medida salga mejor— y la app no tiene otra
 * forma de saber por donde ha estado. El sistema operativo tampoco entrega un historial a las apps.
 * Este es el unico origen de «los sitios que frecuentas» que se le ensenan a quien rellena el
 * domicilio (`features/sitios-frecuentes.ts`).
 *
 * ## Que se guarda y cuanto
 *
 * Solo `lat`, `lng` y la hora: sin precision, sin velocidad, sin nada que no haga falta para agrupar.
 * Un tope de `MAX_HISTORIAL` posiciones, las mas recientes. Se borra al cerrar sesion junto con el
 * resto del contexto de rastreo: una persona que sale no deja su rastro en un telefono compartido.
 *
 * ## Falla en silencio
 *
 * Igual que el resto de señales: una anotacion que no se puede escribir no impide nada.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { distanciaM, MAX_HISTORIAL, posicionValida, type PosicionHistorica } from '../features/sitios-frecuentes';

const KEY = 'atlas.ubicaciones.historial';

/** Dos medidas del mismo punto a menos de 2 minutos no añaden nada: se descartan. */
const DUPLICADA_MS = 2 * 60 * 1000;

export async function leerHistorial(): Promise<PosicionHistorica[]> {
  try {
    const crudo = await AsyncStorage.getItem(KEY);
    if (!crudo) return [];
    const valor: unknown = JSON.parse(crudo);
    return Array.isArray(valor) ? valor.filter(posicionValida) : [];
  } catch {
    return [];
  }
}

/** Añade posiciones al historial, sin repetir y respetando el tope. */
export async function anotarEnHistorial(nuevas: readonly PosicionHistorica[]): Promise<void> {
  if (nuevas.length === 0) return;
  try {
    const previas = await leerHistorial();
    const todas = [...previas];
    for (const posicion of nuevas) {
      if (!posicionValida(posicion)) continue;
      const instante = Date.parse(posicion.at);
      const repetida = todas.some(
        (otra) => Math.abs(Date.parse(otra.at) - instante) < DUPLICADA_MS && distanciaM(otra, posicion) < 30,
      );
      if (!repetida) todas.push({ lat: posicion.lat, lng: posicion.lng, at: posicion.at });
    }
    todas.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    await AsyncStorage.setItem(KEY, JSON.stringify(todas.slice(-MAX_HISTORIAL)));
  } catch {
    // Sin memoria no hay historial; la medida se sube igual.
  }
}

export async function borrarHistorial(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
