/**
 * Que le paso a un campo entre dos valores, sin mirar los valores.
 *
 * Solo se comparan LONGITUDES. Es suficiente para distinguir teclear de pegar y escribir de
 * corregir, y es lo maximo que se puede mirar sin que la bitacora sepa que se escribio.
 */
import { CAMPOS_SIN_DETECCION_DE_PEGADO, type Campo } from './tipos';

/** Cuantos caracteres tienen que entrar de golpe para que cuente como pegado. */
export const UMBRAL_DE_PEGADO = 4;

export type CambioDeCampo = 'tecleo' | 'pegado' | 'correccion' | 'sin_cambio';

/**
 * Clasifica un `onChangeText`.
 *
 * - Entran ≥ 4 caracteres de una vez → `pegado`, salvo en los campos donde el sistema rellena solo
 *   (codigo de verificacion, PIN), que se cuentan como tecleo.
 * - El texto se acorta → `correccion`.
 * - Entran 1-3 caracteres → `tecleo`. Tres y no uno porque los teclados con prediccion insertan
 *   la palabra entera al aceptarla, y eso es escribir, no pegar.
 */
export function clasificarCambio(campo: Campo, longitudAnterior: number, longitudNueva: number): CambioDeCampo {
  const delta = longitudNueva - longitudAnterior;
  if (delta === 0) return 'sin_cambio';
  if (delta < 0) return 'correccion';
  if (delta >= UMBRAL_DE_PEGADO && !CAMPOS_SIN_DETECCION_DE_PEGADO.has(campo)) return 'pegado';
  return 'tecleo';
}

/** Lo que se acumula de un campo mientras tiene el foco. */
export type SesionDeCampo = {
  campo: Campo;
  focoEn: number;
  longitud: number;
  cambios: number;
  correcciones: number;
  pegados: number;
};

export function abrirSesionDeCampo(campo: Campo, focoEn: number, longitudInicial: number): SesionDeCampo {
  return { campo, focoEn, longitud: longitudInicial, cambios: 0, correcciones: 0, pegados: 0 };
}

/** Aplica un cambio a la sesion y devuelve como se clasifico. Muta la sesion a proposito: es un acumulador. */
export function anotarCambio(sesion: SesionDeCampo, longitudNueva: number): CambioDeCampo {
  const clase = clasificarCambio(sesion.campo, sesion.longitud, longitudNueva);
  sesion.longitud = longitudNueva;
  if (clase === 'sin_cambio') return clase;
  sesion.cambios += 1;
  if (clase === 'correccion') sesion.correcciones += 1;
  if (clase === 'pegado') sesion.pegados += 1;
  return clase;
}

/** Posicion de un toque relativa a un rectangulo, acotada a [0, 1]. Fuera del rectangulo se recorta. */
export function posicionRelativa(x: number, y: number, ancho: number, alto: number): { rx: number; ry: number } {
  const acotar = (valor: number) => (Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0);
  return {
    rx: ancho > 0 ? acotar(x / ancho) : 0,
    ry: alto > 0 ? acotar(y / alto) : 0,
  };
}
