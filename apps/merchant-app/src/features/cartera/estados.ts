/**
 * La lógica de «Mi cartera» y «Consumo y facturación» que no es dibujo: en qué cesta cae cada cuota
 * y cada cargo, cómo se agrupan las cuotas por crédito y qué parte de lo cobrado no tiene pago detrás.
 *
 * Es copia de lo que la web tiene dentro de `MerchantBillingScreen.tsx` (`estadoDeCuota`,
 * `creditosConCuotas`, `codigoCorto`, `estadoDelCargo`) y de `components/atlas/OrigenDeCaja.tsx`.
 * Vive aparte de la pantalla para poder probarla: estas funciones deciden si una deuda se pinta en
 * rojo o en verde, y eso no puede depender de que alguien lo mire en el simulador.
 */
import type { BadgeTone } from '@cliente/ui/primitives';
import type { CreditoDeCartera, CuotaDeCartera, PagoDeCartera } from '@/api/servicios/merchantCreditService';

/** Las tres cestas. Es la misma lectura en las cuotas y en los cargos del ERP. */
export type Estado = 'mora' | 'pendiente' | 'pagado';

/** El rótulo y el tono de cada cesta. Web: rojo en mora, ámbar pendiente, verde pagado. */
export const ESTADOS: Record<Estado, { etiqueta: string; tono: BadgeTone }> = {
  mora: { etiqueta: 'En mora', tono: 'danger' },
  pendiente: { etiqueta: 'Pendiente', tono: 'warning' },
  pagado: { etiqueta: 'Pagado', tono: 'success' },
};

export function estadoDeCuota(cuota: Pick<CuotaDeCartera, 'amountOutstanding' | 'overdue'>): Estado {
  return Number(cuota.amountOutstanding) === 0 ? 'pagado' : cuota.overdue ? 'mora' : 'pendiente';
}

/**
 * El estado de un crédito en las tres cestas, para su pastilla. El backend manda `status` en inglés y
 * en mayúsculas (`ACTIVE`…), que no se pinta crudo: se lee de sus cuotas. Saldado si no falta nada,
 * en mora si alguna cuota lo está, y si no, pendiente.
 */
export function estadoDeCredito(credito: Pick<CreditoDeCartera, 'outstanding' | 'installments'>): Estado {
  if (Number(credito.outstanding) === 0) return 'pagado';
  return credito.installments.some((cuota) => estadoDeCuota(cuota) === 'mora') ? 'mora' : 'pendiente';
}

export type CuotaConEstado = CuotaDeCartera & { estado: Estado };

export interface GrupoDeCredito {
  credito: CreditoDeCartera;
  /** «El cliente ya terminó de pagar»: recién ahí Atlas factura. */
  saldado: boolean;
  cuotas: CuotaConEstado[];
}

/**
 * Los créditos con sus cuotas en el estado elegido, del más reciente al más antiguo (por fecha de
 * origen), y cada uno con sus cuotas por vencimiento. Un crédito sólo aparece si tiene alguna cuota
 * en ese estado, y sólo con esas cuotas.
 */
export function creditosConCuotas(creditos: CreditoDeCartera[], filtro: Estado | 'todas'): GrupoDeCredito[] {
  return creditos
    .map((credito) => ({
      credito,
      saldado: credito.installments.length > 0 && credito.installments.every((c) => Number(c.amountOutstanding) === 0),
      cuotas: credito.installments
        .map((cuota) => ({ ...cuota, estado: estadoDeCuota(cuota) }))
        .filter((cuota) => filtro === 'todas' || cuota.estado === filtro)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    }))
    .filter((grupo) => grupo.cuotas.length > 0)
    .sort((a, b) => (b.credito.originatedAt ?? '').localeCompare(a.credito.originatedAt ?? ''));
}

/** «LOAN-31c2c5b9-…-c1f88afa4eb4» → «LOAN-31c2c5b9». El código entero se lee al tocarlo (accesibilidad). */
export function codigoCorto(codigo: string): string {
  const m = /^([A-Z]+-[0-9a-f]{8})-[0-9a-f-]{27}$/iu.exec(codigo);
  return m ? m[1]! : codigo;
}

/**
 * El estado de un cargo del ERP traducido a las mismas tres cestas.
 *
 * El backend habla en mayúsculas y en inglés (`PARTIALLY_PAID`, `ISSUED`, `VOID`…): pintarlo crudo
 * obliga a aprender un vocabulario ajeno y deja una deuda vencida igual que una por vencer. Un cargo
 * con fecha pasada TAMBIÉN está en mora aunque el proceso diario aún no lo haya marcado.
 *
 * `hoy` se puede inyectar para probarlo; por defecto es la fecha UTC de ahora, como en la web.
 */
export function estadoDelCargo(status: string, saldoAbierto: number, vence?: string, hoy = new Date().toISOString().slice(0, 10)): Estado {
  const normalizado = status.toUpperCase();
  if (saldoAbierto <= 0 || normalizado === 'PAID' || normalizado === 'SETTLED' || normalizado === 'VOID') return 'pagado';
  if (normalizado === 'OVERDUE') return 'mora';
  if (vence && vence.slice(0, 10) < hoy) return 'mora';
  return 'pendiente';
}

/** Una factura emitida no lleva saldo en su fila: mientras no diga PAID se debe entera. */
export function estadoDeFactura(invoice: Record<string, unknown>, hoy?: string): Estado {
  const pagada = String(invoice.status ?? '').toUpperCase() === 'PAID';
  return estadoDelCargo(
    String(invoice.status ?? ''),
    pagada ? 0 : Number(invoice.totalAmount ?? 0),
    typeof invoice.dueDate === 'string' ? invoice.dueDate : undefined,
    hoy,
  );
}

/* ------------------------------------------------------------------ origen de la compra */

/**
 * De qué sucursal y caja salió una compra (`OrigenDeCaja` de la web). Pablo (2026-10-08): «pueden
 * haber dos montos iguales pero de cajas distintas». La caja va SIEMPRE —su serie si no tiene
 * alias— y si la compra no nació de un QR físico se dice con palabras.
 */
export interface Origen {
  branchName?: string | null;
  terminalAlias?: string | null;
  terminalSerial?: string | null;
}

export function nombreDeCaja(origen: Origen): string | null {
  return origen.terminalAlias?.trim() || (origen.terminalSerial ? `Caja ${origen.terminalSerial}` : null);
}

/** «Equipetrol · Caja 1» en una línea, para listas y PDF. */
export function textoDeOrigen(origen: Origen): string {
  const caja = nombreDeCaja(origen);
  if (!origen.branchName && !caja) return 'Sin caja registrada';
  return [origen.branchName, caja].filter(Boolean).join(' · ');
}

/* ------------------------------------------------------------------ cobros */

/**
 * Lo que suman los cobros listados y lo que falta para llegar a lo cobrado.
 *
 * `collected` cuenta lo pagado EN LAS CUOTAS, y una cuota puede figurar saldada sin un pago detrás
 * (carteras migradas, datos de demostración). Callarlo dejaba dos cifras distintas en la misma
 * pantalla sin explicación: la web dice qué parte del cobro no tiene pago registrado, y aquí igual.
 */
export function cuadreDeCobros(pagos: PagoDeCartera[], cobrado: unknown) {
  const comisionDePagos = pagos.reduce((suma, pago) => suma + Number(pago.commissionAccrued), 0);
  const cobradoConPago = pagos.reduce((suma, pago) => suma + Number(pago.appliedAmount), 0);
  const cobradoSinPago = Math.max(Number(cobrado ?? 0) - cobradoConPago, 0);
  return { comisionDePagos, cobradoConPago, cobradoSinPago };
}

/** Todas las cuotas de todos los créditos, con su crédito y su origen: la tabla «Cuotas por cobrar» del PDF. */
export function cuotasPlanas(creditos: CreditoDeCartera[]) {
  return creditos.flatMap((credito) =>
    credito.installments.map((cuota) => ({
      ...cuota,
      loanCode: credito.loanCode,
      origen: textoDeOrigen(credito),
      estado: estadoDeCuota(cuota),
    })),
  );
}

/* ------------------------------------------------------------------ códigos a palabras */

/**
 * El concepto de un cargo de Atlas (`receivable.sourceType`). Los rótulos son los del ERP:
 * `CONCEPTO` de `b2b-sales-crm/services/proposal-terms.ts` (los `TermType`) y el dominio
 * `accounting.billingEventType` (SAAS, SETUP, INTERCOMPANY, SUPPORT). La web lo pinta crudo («MDR»);
 * aquí no se enseña ningún código (regla 6).
 */
const CONCEPTOS: Record<string, string> = {
  MDR: 'Comisión por venta',
  SUBSCRIPTION: 'Suscripción',
  SAAS: 'Suscripción',
  SETUP_FEE: 'Cargo de habilitación',
  SETUP: 'Cargo de alta',
  SERVICE_FEE: 'Cargo por servicio',
  PENALTY: 'Penalidad',
  MINIMUM_MONTHLY_FEE: 'Mínimo mensual',
  INTERCOMPANY: 'Servicio entre empresas del grupo',
  SUPPORT: 'Soporte',
  ADS: 'Publicidad',
  ADVERTISING: 'Publicidad',
};

/**
 * El medio de un cobro (`loan_payments.payment_method` del núcleo). Los valores son los que documenta
 * el proceso de cobranza del núcleo (`cash | bank_transfer | card | qr | wallet | direct_debit | other`)
 * y los de la cartera de demostración (`cash_partner`, `qr_transfer`). Los rótulos siguen al dominio
 * `accounting.paymentMethod` del ERP («Transferencia bancaria», «Efectivo», «Tarjeta»).
 */
const MEDIOS: Record<string, string> = {
  CASH: 'Efectivo',
  CASH_PARTNER: 'Efectivo en el comercio',
  BANK_TRANSFER: 'Transferencia bancaria',
  TRANSFER: 'Transferencia bancaria',
  TRANSFERENCIA: 'Transferencia bancaria',
  CARD: 'Tarjeta',
  TARJETA: 'Tarjeta',
  QR: 'QR',
  QR_TRANSFER: 'Transferencia por QR',
  WALLET: 'Billetera móvil',
  DIRECT_DEBIT: 'Débito automático',
  CHEQUE: 'Cheque',
  EFECTIVO: 'Efectivo',
  OTHER: 'Otro',
};

/** «SOME_NEW_CODE» → «Some new code»: lo desconocido se lee como palabras, nunca como código. */
export function humanizar(codigo: string): string {
  const palabras = codigo.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return palabras ? palabras.charAt(0).toUpperCase() + palabras.slice(1) : '—';
}

function rotulo(tabla: Record<string, string>, valor: unknown): string {
  const codigo = typeof valor === 'string' ? valor.trim() : '';
  if (!codigo) return '—';
  return tabla[codigo.toUpperCase()] ?? humanizar(codigo);
}

export const conceptoDeCargo = (sourceType: unknown) => rotulo(CONCEPTOS, sourceType);
export const medioDePago = (paymentMethod: unknown) => rotulo(MEDIOS, paymentMethod);
