/**
 * Lo que el motor LEYO del carnet, guardado en el telefono entre la pantalla de identidad y la de
 * confirmacion de datos.
 *
 * ## Por que se guarda aqui y no se vuelve a pedir
 *
 * La verificacion la arranca `identidad.tsx` y contesta `verificacion.tsx` (sondeando). La pantalla
 * que necesita la lectura —`perfil.tsx`, «Confirma tus datos»— es otra, y puede abrirse dias despues
 * desde el indice del registro. Guardar la lectura en disco evita volver a consultar un tramite que
 * ya termino y que, ademas, solo devuelve `extracted` mientras el servidor lo conserve.
 *
 * ## Que se guarda
 *
 * Solo los campos que se van a prellenar: nombres, apellidos y nacimiento. Nada mas, y se borra al
 * confirmar (`perfil.tsx`) y al cerrar sesion o entrar otro cliente (`session/datos-locales.ts`). Un nombre en disco es lo mismo que en cualquier formulario a medio rellenar: es de la
 * persona que lo esta escribiendo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LecturaDelDocumento } from '../api/endpoints/identity-engine';

const CLAVE = 'atlas.identidad.lectura.v1';

export type LecturaParaPrellenar = { firstNames?: string; lastNames?: string; dateOfBirth?: string };

/** Solo procedencias que sostienen «se leyo el documento». `MODEL` no llega del servidor, pero se filtra igual. */
const PROCEDENCIAS = new Set(['OCR', 'MRZ', 'BARCODE', 'PROVIDER']);

export function paraPrellenar(lectura: LecturaDelDocumento | null | undefined): LecturaParaPrellenar | null {
  if (!lectura) return null;
  const tomar = (campo: keyof LecturaDelDocumento) => {
    const valor = lectura[campo];
    return valor && PROCEDENCIAS.has(valor.source) && valor.value.trim() ? valor.value.trim() : undefined;
  };
  const salida: LecturaParaPrellenar = {
    firstNames: tomar('firstNames'),
    lastNames: tomar('lastNames'),
    dateOfBirth: normalizarFecha(tomar('dateOfBirth')),
  };
  return salida.firstNames || salida.lastNames || salida.dateOfBirth ? salida : null;
}

/** `DD/MM/AAAA` (como imprime la cedula) o `AAAA-MM-DD` → `AAAA-MM-DD`; otra cosa, nada. */
export function normalizarFecha(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (iso) return valor;
  const dmy = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(valor);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return undefined;
}

export async function guardarLecturaDelCarnet(lectura: LecturaDelDocumento | null | undefined): Promise<void> {
  const util = paraPrellenar(lectura);
  try {
    if (util) await AsyncStorage.setItem(CLAVE, JSON.stringify(util));
    else await AsyncStorage.removeItem(CLAVE);
  } catch {
    /* sin disco no hay prellenado; la pantalla pide los datos a mano */
  }
}

export async function leerLecturaDelCarnet(): Promise<LecturaParaPrellenar | null> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as LecturaParaPrellenar) : null;
  } catch {
    return null;
  }
}

export async function borrarLecturaDelCarnet(): Promise<void> {
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
}
