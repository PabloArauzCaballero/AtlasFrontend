/**
 * Dinero en unidades menores (centavos), nunca en `number` decimal.
 *
 * Invariante R84 del modelo ATLAS: no se usa coma flotante para dinero. `0.1 + 0.2 !== 0.3` deja de
 * ser una curiosidad academica cuando el resultado es el saldo de un cliente. Todo importe viaja
 * como entero de centavos dentro de la app y solo se formatea al presentarlo.
 */

export type Currency = 'BOB' | 'USD';

/** Importe en unidades menores. El tipo nominal evita sumar centavos con bolivianos por descuido. */
export type Minor = number & { readonly __brand: 'Minor' };

const MINOR_UNITS: Record<Currency, number> = { BOB: 100, USD: 100 };

export const minor = (value: number): Minor => {
  if (!Number.isFinite(value)) throw new Error('AMOUNT_NOT_FINITE');
  if (!Number.isInteger(value)) throw new Error('AMOUNT_NOT_INTEGER_MINOR_UNITS');
  return value as Minor;
};

export const zero = minor(0);

/** Convierte lo que escribe una persona ("1.234,50" / "1234.5") a centavos exactos. */
export function parseAmountInput(raw: string, currency: Currency = 'BOB'): Minor | null {
  const cleaned = raw.replace(/\s/g, '').replace(/[^0-9.,]/g, '');
  if (cleaned === '') return null;

  // Se toma como separador decimal el ULTIMO signo que aparezca: en Bolivia se escribe "1.234,50",
  // pero un teclado numerico produce "1234.50". Asumir uno de los dos rompe al otro.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalSep = lastComma > lastDot ? ',' : lastDot > lastComma ? '.' : '';

  let integerPart = cleaned;
  let decimalPart = '';
  if (decimalSep) {
    const at = cleaned.lastIndexOf(decimalSep);
    integerPart = cleaned.slice(0, at);
    decimalPart = cleaned.slice(at + 1);
  }
  integerPart = integerPart.replace(/[.,]/g, '');
  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(decimalPart)) return null;
  if (integerPart === '' && decimalPart === '') return null;

  const scale = MINOR_UNITS[currency];
  const digits = String(scale).length - 1;
  if (decimalPart.length > digits) return null; // mas decimales de los que la moneda admite

  const units = BigInt(integerPart === '' ? '0' : integerPart);
  const fraction = BigInt((decimalPart + '0'.repeat(digits)).slice(0, digits) || '0');
  const total = units * BigInt(scale) + fraction;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return minor(Number(total));
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: Currency, withSymbol: boolean): Intl.NumberFormat {
  const cacheKey = `${currency}:${withSymbol}`;
  const cached = formatters.get(cacheKey);
  if (cached) return cached;
  const created = new Intl.NumberFormat('es-BO', {
    style: withSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  formatters.set(cacheKey, created);
  return created;
}

/**
 * "Bs 1.234,50". El simbolo es parte del significado: nunca mostrar un importe sin moneda.
 *
 * ## El espacio es INDIVISIBLE, y no es un detalle de gusto
 *
 * Lo que separa el simbolo de la cifra es un espacio duro (U+00A0), no el de la barra espaciadora.
 * Un espacio normal es un punto de corte valido: en cuanto el importe no cabe entero —una fila de
 * lista estrecha, un telefono pequeno, el texto del sistema ampliado— el renglon se parte JUSTO
 * ahi, y queda «Bs» solo al final de una linea con «4.200,00» empezando la siguiente. Es la unica
 * cosa de la pantalla que no puede leerse en dos trozos: media cifra sin moneda no es un importe,
 * y en la pantalla de inicio ese importe es lo primero y lo mas grande que hay.
 *
 * `Intl` ya devuelve un espacio duro entre moneda y cifra; lo que hacia falta era no perderlo al
 * cambiar «BOB» por «Bs», que es exactamente lo que hacia el reemplazo anterior.
 */
export function formatMoney(amount: Minor, currency: Currency = 'BOB', options?: { symbol?: boolean }): string {
  const value = amount / MINOR_UNITS[currency];
  const text = formatterFor(currency, options?.symbol !== false).format(value);
  return currency === 'BOB' ? text.replace(/^BOB\s?/, 'Bs\u00A0') : text;
}

/**
 * Centavos a unidades mayores para los contratos que hablan en bolivianos.
 *
 * Es el UNICO punto donde el dinero deja de ser entero, y existe porque AtlasBackend valida
 * `requestedAmount` como decimal. La division por la unidad menor es exacta para cualquier importe
 * que quepa en el rango seguro de enteros, asi que no introduce el error que el resto del modulo
 * evita; lo que no se debe hacer es operar con el resultado.
 */
export const toMajorNumber = (amount: Minor, currency: Currency = 'BOB'): number => amount / MINOR_UNITS[currency];

export const addMoney = (a: Minor, b: Minor): Minor => minor(a + b);
export const subtractMoney = (a: Minor, b: Minor): Minor => minor(a - b);
export const isPositive = (a: Minor): boolean => a > 0;

/**
 * Reparte un importe en `parts` cuotas sin perder ni inventar un centavo.
 *
 * El resto se acumula en la ULTIMA cuota, que es la convencion del documento maestro
 * (Bs 133,33 / 133,33 / 133,34). La suma reconcilia exactamente con el total: invariante R87.
 */
export function splitEvenly(total: Minor, parts: number): Minor[] {
  if (!Number.isInteger(parts) || parts <= 0) throw new Error('INVALID_INSTALLMENT_COUNT');
  const base = Math.floor(total / parts);
  const result = Array.from({ length: parts }, () => minor(base));
  const remainder = total - base * parts;
  const lastIndex = parts - 1;
  result[lastIndex] = minor((result[lastIndex] ?? zero) + remainder);
  return result;
}

/** Aplica un porcentaje expresado en base 1 (0.6 = 60%) redondeando al centavo mas cercano. */
export function percentageOf(total: Minor, ratio: number): Minor {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) throw new Error('INVALID_RATIO');
  return minor(Math.round(total * ratio));
}
