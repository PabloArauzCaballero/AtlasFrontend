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
  sin_rubro: { label: 'Sin rubro declarado', icon: 'comercio' },
  sin_comercio: { label: 'Sin comercio registrado', icon: 'etiqueta' },
};

export function categoryLook(category: string): CategoryLook {
  const found = CATEGORIES[category];
  if (found) return found;
  // Un rubro que el expediente traiga y aqui no este: se capitaliza y lleva la tienda generica.
  const label = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
  return { label, icon: 'comercio' };
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
  return currency === 'BOB' ? `Bs ${text}` : `${currency} ${text}`;
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
