/**
 * Los rechazos de validación, dichos como se le dicen a una persona.
 *
 * El validador del backend habla en inglés y por nombre de campo del código: «lines.0.description:
 * String must contain at least 3 character(s)». Quien vende una propuesta no sabe qué es `lines.0`
 * ni por qué le hablan en inglés, así que el aviso —que es correcto— no le servía para corregir
 * nada. Aquí se traduce la frase y se nombra el campo como lo ve en pantalla.
 *
 * Lo que no se reconoce se deja pasar tal cual: un mensaje raro se entiende mejor que ninguno.
 */

/** Nombre de campo del código → el rótulo que lleva en pantalla. */
const ETIQUETAS: Record<string, string> = {
  lines: 'Línea',
  items: 'Elemento',
  allocations: 'Asignación',
  recipients: 'Destinatarios',
  description: 'Descripción',
  termType: 'Tipo de término',
  billingTiming: 'Facturación',
  ratePercent: 'Tasa %',
  fixedAmount: 'Monto fijo',
  minimumMonthlyAmount: 'Mínimo mensual',
  currency: 'Moneda',
  currencyCode: 'Moneda',
  opportunityId: 'Oportunidad',
  accountId: 'Cuenta',
  proposalId: 'Propuesta',
  contractId: 'Contrato',
  pricingExceptionReason: 'Justificación de excepción',
  totalEstimatedMonthlyRevenue: 'Ingreso mensual estimado',
  validUntil: 'Válida hasta',
  startDate: 'Fecha de inicio',
  endDate: 'Fecha de fin',
  amount: 'Monto',
  allocatedAmount: 'Monto aplicado',
  receiptDate: 'Fecha del recibo',
  documentDate: 'Fecha del documento',
  legalEntityId: 'Entidad legal',
  payerBpId: 'Pagador',
  bankAccountId: 'Cuenta bancaria',
  bankGlAccountId: 'Cuenta contable del banco',
  arControlGlAccountId: 'Cuenta de control por cobrar',
  accountingPeriodId: 'Período contable',
  ledgerId: 'Ledger',
  arInvoiceId: 'Factura por cobrar',
  glAccountId: 'Cuenta contable',
  debitAmount: 'Debe',
  creditAmount: 'Haber',
  partnerType: 'Tipo de socio',
  legalName: 'Razón social',
  tradeName: 'Nombre comercial',
  taxId: 'NIT',
  email: 'Correo',
  phone: 'Teléfono',
  address: 'Dirección',
  city: 'Ciudad',
  country: 'País',
  name: 'Nombre',
  code: 'Código',
  reason: 'Motivo',
  notes: 'Notas',
  stage: 'Etapa',
  status: 'Estado',
  subject: 'Asunto',
  htmlBody: 'Cuerpo del mensaje',
  scheduledAt: 'Programado para',
  campaignId: 'Campaña',
};

/** `pricingExceptionReason` → `Pricing exception reason`, para lo que no está en el diccionario. */
function humanizar(nombre: string): string {
  const palabras = nombre.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

/** `lines.0.description` → `Línea 1 · Descripción`. */
export function etiquetaDeRuta(path: string): string {
  const partes: string[] = [];
  for (const segmento of path.split('.').filter(Boolean)) {
    if (/^\d+$/.test(segmento)) {
      const numero = Number(segmento) + 1;
      if (partes.length > 0) partes[partes.length - 1] = `${partes[partes.length - 1]} ${numero}`;
      else partes.push(`Elemento ${numero}`);
      continue;
    }
    partes.push(ETIQUETAS[segmento] ?? humanizar(segmento));
  }
  return partes.join(' · ');
}

/** Sustituye los nombres de campo que el backend mete DENTRO del texto del mensaje. */
function traducirNombresDentro(mensaje: string): string {
  return mensaje.replace(/\b[a-z][A-Za-z0-9]*\b/g, (palabra) => ETIQUETAS[palabra]?.toLowerCase() ?? palabra);
}

const REGLAS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^String must contain at least (\d+) character\(s\)$/, (m) => `escriba al menos ${m[1]} caracteres`],
  [/^String must contain at most (\d+) character\(s\)$/, (m) => `no puede pasar de ${m[1]} caracteres`],
  [/^String must contain exactly (\d+) character\(s\)$/, (m) => `debe tener exactamente ${m[1]} caracteres`],
  [/^Number must be greater than or equal to (-?[\d.]+)$/, (m) => `no puede ser menor que ${m[1]}`],
  [/^Number must be less than or equal to (-?[\d.]+)$/, (m) => `no puede ser mayor que ${m[1]}`],
  [/^Number must be greater than (-?[\d.]+)$/, (m) => `tiene que ser mayor que ${m[1]}`],
  [/^Number must be less than (-?[\d.]+)$/, (m) => `tiene que ser menor que ${m[1]}`],
  [/^Array must contain at least (\d+) element\(s\)$/, (m) => `añada al menos ${m[1]}`],
  [/^Expected number, received nan$/, () => 'escriba un número'],
  [/^Expected \w+, received \w+$/, () => 'el valor no tiene el formato esperado'],
  [/^Invalid enum value\. Expected (.+?), received/, (m) => `elija una de estas opciones: ${m[1]!.replace(/'/g, '').replace(/ \| /g, ', ')}`],
  [/^Invalid uuid$/, () => 'elija un registro de la lista'],
  [/^Invalid email$/, () => 'escriba un correo válido'],
  [/^Invalid date$/, () => 'la fecha no es válida'],
  [/^Invalid$/, () => 'el valor no es válido'],
  [/^Required$/, () => 'hace falta completarlo'],
];

/** Traduce el mensaje del validador; si no lo reconoce, lo devuelve tal cual. */
export function traducirMensajeValidacion(mensaje: string): string {
  for (const [patron, texto] of REGLAS) {
    const encontrado = mensaje.match(patron);
    if (encontrado) return texto(encontrado);
  }
  return traducirNombresDentro(mensaje);
}

/** Una incidencia completa, lista para enseñar: `Línea 1 · Descripción: escriba al menos 3 caracteres`. */
export function describirIncidencia(path: string | undefined, mensaje: string): string {
  const texto = traducirMensajeValidacion(mensaje);
  const etiqueta = path ? etiquetaDeRuta(path) : '';
  return etiqueta ? `${etiqueta}: ${texto}` : texto;
}
