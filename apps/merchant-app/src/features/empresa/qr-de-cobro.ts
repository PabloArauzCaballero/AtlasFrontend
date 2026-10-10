/**
 * Las reglas del QR de cobro (el QR del BANCO con el que el cliente le paga al comercio).
 *
 * Fuente: `components/screens/MerchantPaymentQrScreen.tsx`, `lib/cuentaEnmascarada.ts` y
 * `lib/qrImagen.ts` del portal web. Los textos se copian tal cual: son los que el comercio lee en la
 * web, y dos redacciones del mismo aviso se leen como dos avisos.
 */
import type { PartnerQrCode } from '@/api/servicios/partnerOnboardingService';
import { tablaPdf, type DocumentoPdf } from '@/features/pdf';

/** Los estados del expediente en los que AtlasBackend admite subir o cambiar el QR. Fuera responde 422. */
const ESTADOS_QUE_ADMITEN_QR = new Set(['draft', 'contact_verified', 'documents_submitted', 'approved']);

/** Por qué no se puede subir ahora, dicho ANTES de que el comercio gaste la subida. `null` = se puede. */
export function motivoSinSubida(estadoExpediente: string): string | null {
  if (!estadoExpediente || ESTADOS_QUE_ADMITEN_QR.has(estadoExpediente)) return null;
  if (estadoExpediente === 'under_review') {
    return 'Atlas está revisando su expediente. Mientras dure la revisión no se puede cambiar el QR de cobro.';
  }
  if (estadoExpediente === 'rejected') {
    return 'Su expediente fue rechazado. Corrija lo que se le indicó y vuelva a enviarlo antes de subir un QR.';
  }
  return `Con el expediente en «${estadoExpediente}» no se admite cambiar el QR de cobro.`;
}

export type TonoEstadoQr = 'success' | 'warning' | 'danger' | 'neutral';

/** Lo que significa cada estado del QR para el comercio, sin la clave interna. */
export const ESTADO_QR: Record<string, { tono: TonoEstadoQr; texto: string }> = {
  active: { tono: 'success', texto: 'Activo · sus clientes ya lo ven' },
  pending_review: { tono: 'warning', texto: 'Pendiente de activar · sus clientes aún no lo ven' },
  rejected: { tono: 'danger', texto: 'Revocado por Atlas' },
  replaced: { tono: 'neutral', texto: 'Archivado' },
};

export function estadoDeQr(status: string): { tono: TonoEstadoQr; texto: string } {
  return ESTADO_QR[status] ?? { tono: 'neutral', texto: status };
}

/**
 * «Vigente» es el APROBADO si lo hay; si no, el que espera revisión. Los dos pueden convivir: el
 * aprobado sigue cobrando hasta que Atlas apruebe el nuevo. El historial es el resto.
 */
export function clasificarQr(codigos: readonly PartnerQrCode[]) {
  const bancarios = codigos.filter((codigo) => codigo.qrKind === 'bank');
  const aprobado = bancarios.find((codigo) => codigo.status === 'active');
  const enRevision = bancarios.find((codigo) => codigo.status === 'pending_review');
  const vigente = aprobado ?? enRevision;
  const ultimoRechazo = bancarios.find((codigo) => codigo.status === 'rejected');
  const historial = bancarios.filter((codigo) => codigo !== vigente && codigo !== enRevision);
  return { aprobado, enRevision, vigente, ultimoRechazo, historial };
}

/* ───────────── Cuenta enmascarada ───────────── */

export const FORMATO_CUENTA_ENMASCARADA = /^\*{2,}\d{4}$/;
const ESCRITURA_ADMITIDA = /^[\d*\s.-]+$/;

export type CuentaLeida = { ok: true; valor: string } | { ok: false; motivo: string };

/**
 * Lee lo escrito y devuelve la versión que se puede guardar: nunca sale el número completo, sólo
 * `****` + los 4 últimos. Vacío vale (el campo es opcional); letras o menos de 4 dígitos, no.
 */
export function leerCuentaEnmascarada(entrada: string): CuentaLeida {
  const texto = entrada.trim();
  if (!texto) return { ok: true, valor: '' };
  if (FORMATO_CUENTA_ENMASCARADA.test(texto)) return { ok: true, valor: `****${texto.slice(-4)}` };
  if (!ESCRITURA_ADMITIDA.test(texto)) {
    return { ok: false, motivo: 'Escribe sólo números: los últimos cuatro dígitos de la cuenta, p. ej. ****7890.' };
  }
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length < 4) {
    return { ok: false, motivo: 'Faltan dígitos: hacen falta los últimos cuatro de la cuenta, p. ej. ****7890.' };
  }
  return { ok: true, valor: `****${digitos.slice(-4)}` };
}

/* ───────────── ¿La imagen lleva un QR? ───────────── */

export type ComprobacionQr = 'con-codigo' | 'sin-codigo' | 'no-se-pudo-comprobar';

/**
 * El veredicto a partir de lo que devolvió el lector de códigos del teléfono.
 *
 * En la web el lector es `BarcodeDetector` del navegador; aquí es `scanFromURLAsync` de
 * expo-camera. Como en la web, un fallo del lector NO es un veredicto: no bloquea, y decide el
 * servidor (`QR_IMAGE_HAS_NO_CODE`).
 */
export function veredictoDeLectura(lectura: { resultados: readonly unknown[] } | { fallo: unknown }): ComprobacionQr {
  if ('fallo' in lectura) return 'no-se-pudo-comprobar';
  return lectura.resultados.length > 0 ? 'con-codigo' : 'sin-codigo';
}

export const AVISO_SIN_QR =
  'Esa imagen no contiene ningún código QR. Sube la imagen del código que te dio tu banco, no una foto del local ni una captura de la pantalla.';

/** El tipo que se declara en el permiso de subida: PNG si lo es; todo lo demás, JPEG (igual que la web). */
export function tipoDeImagenQr(mimeType: string | null | undefined): 'image/png' | 'image/jpeg' {
  return mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
}

/* ───────────── Reautenticación ───────────── */

/** El rechazo de la contraseña, con palabras del comercio (`motivoDeRechazo` de la web). */
export function motivoDeRechazo(error: { code?: string; status?: number; message?: string } | null | undefined, respaldo = 'No se pudo confirmar su contraseña.'): string {
  if (!error) return respaldo;
  if (error.code === 'REAUTH_INVALID_PASSWORD') return 'La contraseña no es correcta. Vuelva a escribirla.';
  if (error.code === 'ACCOUNT_LOCKED' || error.status === 429) {
    return 'Demasiados intentos fallidos: su cuenta quedó bloqueada un rato. Espere unos minutos e inténtelo otra vez.';
  }
  return error.message || respaldo;
}

/* ───────────── PDF ───────────── */

export function documentoQrDeCobro(codigos: readonly PartnerQrCode[], nombre: string, estadoExpediente: string): DocumentoPdf {
  return {
    title: 'Mi QR de cobro',
    subtitle: nombre ? `Portal del comercio · ${nombre}` : 'Portal del comercio',
    summary: [{ label: 'Códigos registrados', value: codigos.length }],
    notices: [
      {
        level: 'caution',
        title: 'La imagen del QR no va en este PDF',
        text:
          'Se listan los códigos registrados y su huella, no la imagen: un QR impreso desde un ' +
          'informe puede acabar pegado en una caja sin que nadie compruebe que es el vigente. ' +
          'La imagen se descarga desde esta misma pantalla.',
      },
    ],
    sections: [
      {
        title: 'Códigos registrados',
        fields: [
          { label: 'Comercio', value: nombre || '—' },
          { label: 'Estado del expediente', value: estadoExpediente || '—' },
        ],
        table: tablaPdf(
          [
            { key: 'qrKind', label: 'Tipo' },
            { key: 'bankInstitutionCode', label: 'Entidad' },
            { key: 'accountNumberMasked', label: 'Cuenta' },
            { key: 'status', label: 'Estado' },
            { key: 'registeredAt', label: 'Registrado' },
          ],
          codigos as unknown as Record<string, unknown>[],
        ),
      },
    ],
  };
}
