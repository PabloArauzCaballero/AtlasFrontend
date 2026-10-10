/**
 * Las sucursales y sus cajas: los nombres, los seriales y el alta por cantidad.
 *
 * Junta tres archivos de la web que sólo usa la pestaña «Sucursales»: `lib/cajasDeSucursal.ts`,
 * `lib/codigoDeSucursal.ts` y `lib/estadoBnplSucursal.ts`. Los comentarios de por qué cada regla es
 * como es están allí; aquí sólo se conserva lo que hace falta para no cambiarlas sin querer.
 */
import { partnerOnboardingService, type PartnerPosTerminal } from '@/api/servicios/partnerOnboardingService';

export const MAX_CAJAS_POR_VEZ = 50;

const PATRON_ALIAS = /^caja\s+(\d+)$/iu;

/**
 * El código con el que el expediente nombra a una sucursal del ERP, DERIVADO de su identificador
 * entero: un prefijo hacía que dos locales del mismo comercio chocaran (`BRANCH_CODE_ALREADY_REGISTERED`).
 */
export function codigoDeExpediente(erpBranchId: string): string {
  return `SUC-${erpBranchId.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-36)}`;
}

export interface EstadoBnpl {
  texto: 'Sí' | 'Por habilitar' | 'No';
  tono: 'success' | 'warning' | 'neutral';
  explicacion: string;
}

/** Si una sucursal puede vender a crédito, dicho como se le dice al comercio. «No» sólo para la dada de baja. */
export function estadoBnplSucursal(sucursal: { canOriginateBnpl?: unknown; status?: unknown }): EstadoBnpl {
  if (sucursal.canOriginateBnpl) {
    return { texto: 'Sí', tono: 'success', explicacion: 'Esta sucursal puede vender a crédito con Atlas.' };
  }
  if (String(sucursal.status) === 'ACTIVE') {
    return {
      texto: 'Por habilitar',
      tono: 'warning',
      explicacion: 'Atlas habilita la venta a crédito en cada sucursal después de evaluar a tu comercio. Todavía no se ha habilitado.',
    };
  }
  return { texto: 'No', tono: 'neutral', explicacion: 'La sucursal está dada de baja y no puede vender a crédito.' };
}

/** «Tienda Norte (Equipetrol)» → `TIENDA-NORTE-EQUIPETROL`. Sin tildes ni signos; como mucho 24 caracteres. */
export function slugDeSucursal(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return (limpio || 'SUCURSAL').slice(0, 24).replace(/-+$/u, '');
}

export function aliasDeCaja(numero: number): string {
  return `Caja ${numero}`;
}

/** `TIENDA-NORTE-1A2B3C-CAJA-1`: lo que lleva el QR de la caja. */
export function serialDeCaja(nombreSucursal: string, erpBranchId: string, numero: number): string {
  const huella = erpBranchId.replace(/[^A-Za-z0-9]/gu, '').slice(0, 6).toUpperCase() || 'X';
  return `${slugDeSucursal(nombreSucursal)}-${huella}-CAJA-${numero}`;
}

/** El siguiente número libre: después del mayor «Caja N» que ya exista, o del total de cajas. */
export function siguienteNumero(existentes: readonly Pick<PartnerPosTerminal, 'terminalAlias'>[]): number {
  const numeros = existentes
    .map((pos) => PATRON_ALIAS.exec(String(pos.terminalAlias ?? '').trim())?.[1])
    .filter((valor): valor is string => Boolean(valor))
    .map(Number);
  return Math.max(existentes.length, ...numeros, 0) + 1;
}

export interface ResultadoCajas {
  creadas: number;
  /** Creadas pero no activadas: su QR todavía no lo acepta el teléfono del cliente. */
  sinActivar: number;
}

/**
 * Da de alta `cantidad` cajas numeradas a continuación de las que hay y las ACTIVA (una caja nace
 * `registered` y su QR no sirve hasta estar `active`). `serialPropio` sólo vale para UNA caja.
 */
export async function crearCajas(input: {
  partnerId: string;
  branchId: string;
  erpBranchId: string;
  nombreSucursal: string;
  cantidad: number;
  existentes: readonly PartnerPosTerminal[];
  serialPropio?: string;
}): Promise<ResultadoCajas> {
  const cantidad = Math.max(0, Math.min(MAX_CAJAS_POR_VEZ, Math.trunc(input.cantidad)));
  const desde = siguienteNumero(input.existentes);
  const resultado: ResultadoCajas = { creadas: 0, sinActivar: 0 };
  for (let i = 0; i < cantidad; i += 1) {
    const numero = desde + i;
    const serial = cantidad === 1 && input.serialPropio?.trim() ? input.serialPropio.trim() : serialDeCaja(input.nombreSucursal, input.erpBranchId, numero);
    const caja = await partnerOnboardingService.registerPosTerminal(input.partnerId, input.branchId, {
      terminalSerial: serial,
      terminalAlias: aliasDeCaja(numero),
    });
    resultado.creadas += 1;
    try {
      if (caja?.terminalId) await partnerOnboardingService.changePosStatus(input.partnerId, String(caja.terminalId), { status: 'active' });
      else resultado.sinActivar += 1;
    } catch {
      resultado.sinActivar += 1;
    }
  }
  return resultado;
}

/** La cantidad escrita, dentro de los límites; vacío o basura = 1 (lo normal). Igual que `cantidadDe` de la web. */
export function cantidadDe(valor: string | null | undefined): number {
  const numero = Number(String(valor ?? '').trim() || '1');
  return Number.isFinite(numero) ? Math.max(0, Math.min(MAX_CAJAS_POR_VEZ, Math.trunc(numero))) : 1;
}

export function textoDeCajas(prefijo: string, resultado: ResultadoCajas): string {
  const cajas = resultado.creadas === 1 ? '1 caja' : `${resultado.creadas} cajas`;
  return resultado.sinActivar
    ? `${prefijo} con ${cajas}. ${resultado.sinActivar} quedaron sin activar: pulsa «Reactivar» en cada una para que su QR funcione.`
    : `${prefijo} con ${cajas}, ya activas y con su QR.`;
}

/** El texto del botón de estado de una caja, según su estado. */
export function accionDeEstadoDeCaja(status: string): 'Suspender' | 'Activar' | 'Reactivar' {
  return status === 'active' ? 'Suspender' : status === 'registered' ? 'Activar' : 'Reactivar';
}

/** Lo que se le pide al backend al pulsar ese botón. */
export function siguienteEstadoDeCaja(status: string): 'suspended' | 'active' {
  return status === 'active' ? 'suspended' : 'active';
}

/** Los estados del expediente, dichos para el aviso de «todavía no está aprobado». */
export const ESTADO_EXPEDIENTE: Record<string, string> = {
  draft: 'borrador',
  contact_verified: 'contacto verificado',
  documents_submitted: 'documentos enviados',
  under_review: 'en revisión',
  rejected: 'rechazado',
};
