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
  /**
   * La respuesta HTTP no la produjo AtlasBackend sino lo que tiene delante: el proxy de Next del
   * portal o Traefik.
   *
   * Se distingue por el cuerpo. El backend contesta SIEMPRE con su sobre JSON —hasta un 404 de una
   * ruta que no existe trae `requestId`—; el proxy de Next responde `Internal Server Error` en texto
   * plano cuando no encuentra el API, y Traefik `404 page not found` cuando no hay contenedor detrás.
   * Es lo que permite saber que una petición no llegó, y por tanto que repetirla no duplica nada.
   */
  readonly fromGateway: boolean;

  constructor(input: {
    kind: AtlasErrorKind;
    code: string;
    message: string;
    status?: number | null;
    requestId?: string | null;
    details?: unknown;
    fromGateway?: boolean;
  }) {
    super(input.message);
    this.name = 'AtlasApiError';
    this.kind = input.kind;
    this.code = input.code;
    this.status = input.status ?? null;
    this.requestId = input.requestId ?? null;
    this.details = input.details;
    this.fromGateway = input.fromGateway ?? false;
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
  INVALID_CREDENTIALS: 'Correo, teléfono o PIN incorrectos.',
  ACCOUNT_LOCKED: 'Tu cuenta está bloqueada temporalmente por varios intentos fallidos.',

  /*
   * Empezar el registro y no terminarlo NO puede dejar a nadie fuera.
   *
   * Quien rellena el formulario y cierra la app antes de acabar el alta ya tiene cuenta: se creó al
   * enviar el primer paso. Al volver e intentar registrarse otra vez, el servidor responde
   * `CUSTOMER_ALREADY_EXISTS` — correctamente, porque dos cuentas con el mismo correo serían dos
   * expedientes crediticios de la misma persona. Lo que fallaba es que este código NO estaba en esta
   * tabla, así que la pantalla mostraba «Revisa los datos ingresados» y no había nada que revisar:
   * los datos estaban bien. Era una pared sin puerta.
   *
   * El mensaje ahora dice lo que pasa y `RECOVERY_BY_CODE` pone la salida al lado.
   */
  CUSTOMER_ALREADY_EXISTS: 'Ya existe una cuenta con este correo o teléfono. Si la empezaste tú, ingresa y sigues donde lo dejaste.',
  CONTACT_ALREADY_REGISTERED: 'Ese correo o teléfono ya está registrado en otra cuenta.',
  CONTACT_ALREADY_VERIFIED: 'Ese contacto ya estaba verificado. Puedes continuar.',
  IDENTITY_FIELDS_LOCKED: 'Tu identidad ya fue verificada con tu documento. Para corregir tu nombre o tu fecha de nacimiento, escríbenos.',
};

/**
 * La salida que acompaña a un error sin salida.
 *
 * Un mensaje que explica el problema y no dice qué hacer deja a la persona exactamente donde
 * estaba. Estos son los códigos donde el camino de vuelta existe y es corto.
 */
export type ErrorRecovery = { label: string; href: string };

const RECOVERY_BY_CODE: Record<string, ErrorRecovery[]> = {
  CUSTOMER_ALREADY_EXISTS: [
    { label: 'Ingresar con mi cuenta', href: '/(auth)/ingresar' },
    { label: 'Olvidé mi PIN', href: '/(auth)/recuperar' },
  ],
  CONTACT_ALREADY_REGISTERED: [
    { label: 'Ingresar con mi cuenta', href: '/(auth)/ingresar' },
    { label: 'Olvidé mi PIN', href: '/(auth)/recuperar' },
  ],
  ACCOUNT_LOCKED: [{ label: 'Olvidé mi PIN', href: '/(auth)/recuperar' }],
};

/**
 * Hasta cuándo dura un bloqueo, dicho en hora de reloj.
 *
 * El backend manda `lockedUntil`; decir «intenta más tarde» a secas garantiza una de dos conductas,
 * las dos malas: no volver nunca, o reintentar cada diez segundos. Una hora concreta se puede
 * esperar.
 */
function lockedUntilOf(error: AtlasApiError): string | null {
  const envelope = error.details as { error?: { details?: { lockedUntil?: unknown } } } | undefined;
  const value = envelope?.error?.details?.lockedUntil;
  if (typeof value !== 'string') return null;

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

const MESSAGE_BY_KIND: Record<AtlasErrorKind, string> = {
  network: 'Sin conexión. Revisa tu internet e intenta de nuevo.',
  timeout: 'La conexión tardó demasiado. Intenta de nuevo.',
  server: 'Tuvimos un problema de nuestro lado. Intenta en unos minutos.',
  auth: 'Tu sesión expiró. Vuelve a ingresar.',
  permission: 'No tienes permiso para hacer esta acción.',
  not_found: 'No encontramos lo que buscabas.',
  validation: 'Revisa los datos ingresados.',
  conflict: 'Esta operación ya fue registrada.',
  rate_limited: 'Demasiados intentos. Espera un momento antes de reintentar.',
  unavailable: 'El servicio no está disponible ahora mismo.',
  unknown: 'No pudimos completar la operación.',
};

export function describeError(error: unknown): {
  title: string;
  detail: string;
  canRetry: boolean;
  reference: string | null;
  recovery: ErrorRecovery[];
} {
  if (error instanceof AtlasApiError) {
    const base = MESSAGE_BY_CODE[error.code] ?? MESSAGE_BY_KIND[error.kind];
    const until = error.code === 'ACCOUNT_LOCKED' ? lockedUntilOf(error) : null;
    return {
      title: titleFor(error.kind, error.code),
      detail: until ? `${base} Podrás volver a intentarlo a las ${until}.` : base,
      canRetry: error.kind === 'network' || error.kind === 'timeout' || error.kind === 'server' || error.kind === 'unavailable',
      reference: error.requestId,
      recovery: RECOVERY_BY_CODE[error.code] ?? [],
    };
  }
  return { title: 'Algo no salió bien', detail: MESSAGE_BY_KIND.unknown, canRetry: true, reference: null, recovery: [] };
}

function titleFor(kind: AtlasErrorKind, code?: string): string {
  // Un titulo por codigo cuando el codigo dice algo mas util que su familia. «Revisa los datos» sobre
  // un formulario correcto manda a la persona a buscar un error que no existe.
  if (code === 'CUSTOMER_ALREADY_EXISTS' || code === 'CONTACT_ALREADY_REGISTERED') return 'Ya tienes una cuenta';
  if (code === 'ACCOUNT_LOCKED') return 'Cuenta bloqueada temporalmente';

  switch (kind) {
    case 'network':
    case 'timeout':
      return 'Sin conexión';
    case 'auth':
      return 'Sesión expirada';
    case 'permission':
      return 'Acción no permitida';
    case 'not_found':
      return 'No encontrado';
    case 'validation':
      return 'Revisa los datos';
    case 'rate_limited':
      return 'Demasiados intentos';
    case 'unavailable':
      return 'Servicio no disponible';
    default:
      return 'Algo no salió bien';
  }
}
