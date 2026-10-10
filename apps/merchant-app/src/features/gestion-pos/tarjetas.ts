/**
 * Lo que dicen las tarjetas de Gestión POS, fuera del dibujo para poder probarlo.
 *
 * Pablo (2026-10-10) pidió tarjetas «mucho más claras»: arriba el importe, a la derecha el estado en
 * español, y debajo UNA línea con lo demás —cuotas, fecha, caja—. Esa línea se arma aquí, saltando lo
 * que no venga, para que una compra sin caja no deje un «·  ·» suelto.
 *
 * Nada de ids internos como título: la referencia corta (los últimos seis caracteres del código) va
 * en gris al final, sólo para poder casarla con el aviso que sale al decidir o con el PDF.
 */
import type { ComprobanteDePago, PagoInicial, SolicitudDeCompra } from '@/api/servicios/merchantCreditService';
import { fechaCorta } from './formato';
import type { Tono } from './historial';
import { nombreDeCaja, type Origen } from './origen-de-caja';

/** «b51c9e»: el final del código, lo único que hace falta para distinguir dos filas. */
export function refCorta(codigo: string | null | undefined): string {
  if (!codigo) return '';
  const limpio = codigo.replace(/[^a-zA-Z0-9]/g, '');
  return limpio.slice(-6).toLowerCase();
}

/** «Casa matriz · Caja 5», o null si la compra no vino de un QR físico. */
function caja(origen: Origen): string | null {
  const partes = [origen.branchName, nombreDeCaja(origen)].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

const unir = (partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(' · ');

/*
 * La cola sólo trae lo que espera la palabra del comercio (`businessAcceptance = 'pending'`), así que
 * casi siempre es «Por aceptar». La web pinta el código en crudo («PENDIENTE», o el valor tal cual);
 * aquí va traducido, con los demás valores por si el backend los mandara.
 */
const ACEPTACION: Record<string, { texto: string; tono: Tono }> = {
  pending: { texto: 'Por aceptar', tono: 'warning' },
  accepted: { texto: 'Aceptada', tono: 'success' },
  declined: { texto: 'Rechazada', tono: 'danger' },
  rejected: { texto: 'Rechazada', tono: 'danger' },
};

export function estadoDeSolicitud(s: Pick<SolicitudDeCompra, 'businessAcceptance'>): { texto: string; tono: Tono } {
  return ACEPTACION[s.businessAcceptance ?? 'pending'] ?? { texto: 'Pendiente', tono: 'warning' };
}

/** «6 cuotas · 9 oct, 14:03 · Equipetrol · Caja 1». */
export function lineaDeSolicitud(s: SolicitudDeCompra, hoy?: Date): string {
  const n = Number(s.requestedTermMonths);
  const cuotas = Number.isFinite(n) && n > 0 ? `${n} ${n === 1 ? 'cuota' : 'cuotas'}` : null;
  return unir([cuotas, fechaCorta(s.submittedAt, hoy), caja(s)]);
}

/**
 * «Cuota · Ref. 778812 · 9 oct, 14:03 · Equipetrol · Caja 1». Empieza por QUÉ se paga porque las dos
 * colas comparten pestaña y los títulos de sección sólo salen cuando hay de las dos; la referencia
 * del banco es lo que se busca en el extracto.
 */
export function lineaDeComprobante(c: Pick<ComprobanteDePago, 'payerReference' | 'submittedAt'> & Origen, hoy?: Date): string {
  return unir(['Cuota', `Ref. ${c.payerReference ?? 'sin referencia'}`, fechaCorta(c.submittedAt, hoy), caja(c)]);
}

export function lineaDePagoInicial(p: PagoInicial, hoy?: Date): string {
  return unir(['Pago inicial', `Ref. ${p.payerReference ?? 'sin referencia'}`, fechaCorta(p.submittedAt, hoy) ?? 'Sin fecha', caja(p)]);
}

/**
 * El contador de la pestaña «Comprobantes»: las cuotas Y los pagos iniciales que esperan.
 *
 * La web cuenta sólo las cuotas, y con una cuota y dos pagos iniciales esperando la pestaña decía
 * «1»: los pagos iniciales —que están en la MISMA pestaña, arriba— no avisaban desde la otra. Se
 * corrige aquí (ver `docs/fidelidad/gestion-pos.md`). Sin número hasta que llega la primera de las
 * dos colas; la otra suma en cuanto llega.
 */
export function pendientesDeComprobantes(cuotas: number | null, iniciales: number | null): number | null {
  if (cuotas === null && iniciales === null) return null;
  return (cuotas ?? 0) + (iniciales ?? 0);
}
