/**
 * De qué sucursal y caja salió una compra o un pago. Copia de la lógica de
 * `AtlasERPFrontend/components/atlas/OrigenDeCaja.tsx`; el dibujo vive en `src/ui/gestion-pos/`.
 *
 * Pablo (2026-10-08): «pueden haber dos montos iguales pero de cajas distintas». Por eso la caja va
 * SIEMPRE, también cuando no tiene alias (se muestra su número de serie), y si la compra no nació de
 * un QR físico se dice con palabras en vez de dejar el hueco.
 */
export interface Origen {
  branchName?: string | null;
  terminalAlias?: string | null;
  terminalSerial?: string | null;
}

/** «Caja 1», o la serie si la caja no tiene nombre, o null si no hay caja. */
export function nombreDeCaja(origen: Origen): string | null {
  return origen.terminalAlias?.trim() || (origen.terminalSerial ? `Caja ${origen.terminalSerial}` : null);
}

/** «Equipetrol · Caja 1» en una línea, para listas y PDF. */
export function textoDeOrigen(origen: Origen): string {
  const caja = nombreDeCaja(origen);
  if (!origen.branchName && !caja) return 'Sin caja registrada';
  return [origen.branchName, caja].filter(Boolean).join(' · ');
}
