/**
 * Errores de API con jerarquia explicita.
 *
 * El documento maestro exige distinguir red / servidor / permiso / no encontrado / validacion /
 * sesion / desconocido, y no mostrar "algo salio mal" cuando hay contexto disponible. Cada error
 * lleva su `code` de negocio para que la pantalla pueda decidir, y un mensaje ya redactado para
 * cuando no necesita decidir nada.
 */
export type AtlasErrorKind =
  | 'network'
  | 'timeout'
  | 'server'
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'rate_limited'
  | 'unavailable'
  | 'unknown';

export class AtlasApiError extends Error {
  readonly kind: AtlasErrorKind;
  readonly code: string;
  readonly status: number | null;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(input: {
    kind: AtlasErrorKind;
    code: string;
    message: string;
    status?: number | null;
    requestId?: string | null;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'AtlasApiError';
    this.kind = input.kind;
    this.code = input.code;
    this.status = input.status ?? null;
    this.requestId = input.requestId ?? null;
    this.details = input.details;
  }
}

export function kindFromStatus(status: number): AtlasErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'permission';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'unavailable';
  if (status >= 500) return 'server';
  return 'unknown';
}

/**
 * Copy por codigo de negocio. Traduce el error tecnico a algo accionable SIN revelar reglas
 * antifraude (seccion 31 del documento maestro: reason codes comprensibles, no explotables).
 */
const MESSAGE_BY_CODE: Record<string, string> = {
  VERIFICATION_CHANNEL_UNAVAILABLE: 'El canal de verificación no está disponible ahora mismo. Intenta con otro canal o vuelve en unos minutos.',
  DOCUMENT_STORAGE_NOT_CONFIGURED: 'No podemos recibir documentos en este momento. Ya estamos trabajando en ello.',
  ONBOARDING_INCOMPLETE: 'Todavía falta información para enviar tu solicitud.',
  ONBOARDING_ALREADY_SUBMITTED: 'Tu solicitud ya fue enviada y está en revisión.',
  CUSTOMER_NOT_ELIGIBLE: 'Aún no cumples los requisitos para solicitar crédito.',
  CREDIT_APPLICATION_ALREADY_OPEN: 'Ya tienes una solicitud en curso.',
  IDENTITY_ALREADY_VERIFIED: 'Tu identidad ya fue verificada.',
  DOCUMENT_NUMBER_MISMATCH: 'El número de documento no coincide con el que registraste.',
  IDENTITY_PACKAGE_REQUIRED: 'Primero debes subir tu documento de identidad.',
  INVALID_CREDENTIALS: 'Usuario o contrasena incorrectos.',
  ACCOUNT_LOCKED: 'Tu cuenta está bloqueada temporalmente por intentos fallidos. Intenta más tarde.',
};

const MESSAGE_BY_KIND: Record<AtlasErrorKind, string> = {
  network: 'Sin conexion. Revisa tu internet e intenta de nuevo.',
  timeout: 'La conexion tardo demasiado. Intenta de nuevo.',
  server: 'Tuvimos un problema de nuestro lado. Intenta en unos minutos.',
  auth: 'Tu sesión expiró. Vuelve a ingresar.',
  permission: 'No tienes permiso para hacer esta accion.',
  not_found: 'No encontramos lo que buscabas.',
  validation: 'Revisa los datos ingresados.',
  conflict: 'Esta operacion ya fue registrada.',
  rate_limited: 'Demasiados intentos. Espera un momento antes de reintentar.',
  unavailable: 'El servicio no está disponible ahora mismo.',
  unknown: 'No pudimos completar la operacion.',
};

export function describeError(error: unknown): { title: string; detail: string; canRetry: boolean; reference: string | null } {
  if (error instanceof AtlasApiError) {
    const detail = MESSAGE_BY_CODE[error.code] ?? MESSAGE_BY_KIND[error.kind];
    return {
      title: titleFor(error.kind),
      detail,
      canRetry: error.kind === 'network' || error.kind === 'timeout' || error.kind === 'server' || error.kind === 'unavailable',
      reference: error.requestId,
    };
  }
  return { title: 'Algo no salio bien', detail: MESSAGE_BY_KIND.unknown, canRetry: true, reference: null };
}

function titleFor(kind: AtlasErrorKind): string {
  switch (kind) {
    case 'network':
    case 'timeout':
      return 'Sin conexion';
    case 'auth':
      return 'Sesión expirada';
    case 'permission':
      return 'Accion no permitida';
    case 'not_found':
      return 'No encontrado';
    case 'validation':
      return 'Revisa los datos';
    case 'rate_limited':
      return 'Demasiados intentos';
    case 'unavailable':
      return 'Servicio no disponible';
    default:
      return 'Algo no salio bien';
  }
}
