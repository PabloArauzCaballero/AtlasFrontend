/**
 * Como se nombra y se dibuja un rubro de comercio.
 *
 * El expediente del partner guarda el rubro en minuscula y sin acentos porque es una CLAVE, no un
 * texto para leer. Traducirla aqui y no en cada pantalla evita que la misma categoria salga
 * «educacion» en el tablero y «Educación» en el informe, que es como se pierde la confianza en una
 * cifra: si el nombre baila, el numero tambien parece que baila.
 */
import type { IconName } from '../ui/icons';

type CategoryLook = { label: string; icon: IconName };

/**
 * El mapa es explicito y no derivado.
 *
 * Se podria adivinar el icono por palabras del nombre, pero entonces un rubro nuevo del expediente
 * aparecería con un icono al azar, y un icono equivocado miente mas rapido que un texto: se lee
 * antes de leer la etiqueta.
 */
const CATEGORIES: Record<string, CategoryLook> = {
  educacion: { label: 'Educación', icon: 'educacion' },
  electronica: { label: 'Electrónica', icon: 'electronica' },
  celulares: { label: 'Celulares', icon: 'celulares' },
  ropa: { label: 'Ropa y calzado', icon: 'ropa' },
  hogar: { label: 'Hogar', icon: 'hogar' },
  salud: { label: 'Salud', icon: 'salud' },
  farmacia: { label: 'Farmacia', icon: 'salud' },
  supermercado: { label: 'Supermercado', icon: 'supermercado' },
  transporte: { label: 'Transporte', icon: 'transporte' },
  servicios: { label: 'Servicios', icon: 'servicios' },
  retail: { label: 'Tienda', icon: 'comercio' },
  sin_rubro: { label: 'Sin rubro declarado', icon: 'comercio' },
  sin_comercio: { label: 'Sin comercio registrado', icon: 'etiqueta' },
};

/**
 * La clave del expediente, normalizada antes de buscarla.
 *
 * El expediente del partner guarda el rubro en MAYUSCULAS —`EDUCACION`, `RETAIL`— y este mapa esta
 * indexado en minuscula, asi que la busqueda fallaba SIEMPRE y todo caia al respaldo. El resultado
 * en la pantalla de pagos era que el cliente leia «EDUCACION · 1 credito» y «RETAIL · 1 credito»:
 * la clave de la base de datos, en versalitas y sin tilde, en la lista de lo que debe.
 *
 * El icono se perdia con ella, que es lo que mas se nota sin saber por que: los dos comercios
 * llevaban la misma tienda generica en vez del birrete de educacion, asi que la columna de iconos
 * dejaba de distinguir nada y pasaba a ser decoracion repetida.
 *
 * Se normaliza aqui y no en cada pantalla porque el formato de la clave es un detalle del
 * expediente, no del sitio donde se pinta. Si mañana llega `Educacion` o `educación`, tambien entra.
 */
const normalizeKey = (category: string) =>
  category
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Quita las tildes de la CLAVE, no de la etiqueta: `educación` y `educacion` son el mismo rubro.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

export function categoryLook(category: string): CategoryLook {
  const found = CATEGORIES[normalizeKey(category)];
  if (found) return found;
  /*
    Un rubro que el expediente traiga y aqui no este: se escribe legible y lleva la tienda generica.

    `toLowerCase` primero, y no solo capitalizar la inicial: la clave llega en mayusculas, asi que
    capitalizarla tal cual dejaba «EDUCACION» intacto y el respaldo no arreglaba nada. Ahora al menos
    se lee «Educacion» —sin tilde, porque la clave no la trae— en vez de un grito.
  */
  const legible = normalizeKey(category).replace(/_/g, ' ');
  return { label: legible.charAt(0).toUpperCase() + legible.slice(1), icon: 'comercio' };
}

/**
 * Importes que llegan del backend como NUMERO, no como centavos.
 *
 * `formatMoney` de `domain/money` habla en unidades menores porque el dominio de compra local
 * trabaja en centavos. El libro de prestamos devuelve decimales ya cerrados, y convertirlos a
 * centavos para volver a dividirlos solo añade dos redondeos donde no hacia falta ninguno.
 */
export function formatAmount(amount: number, currency = 'BOB'): string {
  const text = amount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Espacio duro entre moneda y cifra, igual que en `domain/money.formatMoney`: un importe no se
  // puede partir en dos renglones, y esta funcion pinta las mismas cifras en las mismas filas.
  return currency === 'BOB' ? `Bs\u00A0${text}` : `${currency}\u00A0${text}`;
}

/**
 * Que color le toca a un importe pendiente.
 *
 * Tres estados y no dos: lo VENCIDO en rojo, lo que vence pronto en ambar y el resto neutro. Meter
 * lo proximo en el mismo rojo que lo vencido enseña a ignorar el rojo, que es exactamente lo que no
 * se quiere el dia que de verdad hay una mora.
 */
export type MoneyTone = 'danger' | 'warning' | 'neutral';

export function amountTone(input: { overdue: number; upcoming: number }): MoneyTone {
  if (input.overdue > 0) return 'danger';
  if (input.upcoming > 0) return 'warning';
  return 'neutral';
}

/** Dias que faltan (o que han pasado) hasta una fecha `YYYY-MM-DD`, en dias enteros. */
export function daysUntil(date: string, now = new Date()): number {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function dueCopy(date: string, now = new Date()): string {
  const days = daysUntil(date, now);
  if (days < -1) return `Venció hace ${Math.abs(days)} días`;
  if (days === -1) return 'Venció ayer';
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
}
