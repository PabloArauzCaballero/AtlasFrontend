/**
 * Traduccion entre el vocabulario del servidor y el de la interfaz.
 *
 * El backend manda: el `nextStep` y el estado de cada seccion vienen calculados alli. La app solo
 * necesita saber a que pantalla corresponde cada codigo y como nombrarlo en espanol para una
 * persona que no sabe que es un "reference_contact".
 */
import type { Blocker, OnboardingSectionCode } from '../api/endpoints/onboarding';
import type { IconName } from '../ui/icons';

export type OnboardingRoute =
  | '/(onboarding)/verificar-contacto'
  | '/(onboarding)/perfil'
  | '/(onboarding)/economia'
  | '/(onboarding)/domicilio'
  | '/(onboarding)/identidad'
  | '/(onboarding)/referencias'
  | '/(onboarding)/permisos'
  | '/(onboarding)/habitos'
  | '/(onboarding)/revision';

export const SECTION_ROUTE: Record<OnboardingSectionCode, OnboardingRoute> = {
  contact_verification: '/(onboarding)/verificar-contacto',
  personal_data: '/(onboarding)/perfil',
  financial_profile: '/(onboarding)/economia',
  address: '/(onboarding)/domicilio',
  identity_documents: '/(onboarding)/identidad',
  reference_contacts: '/(onboarding)/referencias',
  device_permissions: '/(onboarding)/permisos',
  consumer_survey: '/(onboarding)/habitos',
};

/**
 * El ORDEN de los pasos, escrito una vez.
 *
 * `SECTION_ROUTE` ya lleva las seis secciones, pero el orden de las claves de un objeto no es un
 * contrato del que se pueda depender para numerar nada. Aqui esta explicito, y es el mismo que usa
 * el servidor para calcular `nextStep`: verificar el telefono antes de pedir datos, y el documento
 * antes de las referencias.
 *
 * Existe para poder decir «Paso 3 de 6» en cada pantalla del alta. Un formulario largo sin numero
 * de paso no da forma de estimar cuanto falta, y lo que la gente hace cuando no sabe cuanto falta
 * es abandonarlo.
 */
/*
 * Las CUATRO FASES del alta (2026-09-18), en el mismo orden que `ONBOARDING_SECTION_CODES` del
 * servidor: contacto → identidad (el carnet ANTES que los datos personales) → situacion (domicilio,
 * economia, referencias y los permisos del telefono) → habitos. `onboarding-map.test.ts` comprueba
 * que este orden y el del backend son el mismo.
 */
export const SECTION_ORDER: OnboardingSectionCode[] = [
  'contact_verification',
  'identity_documents',
  'personal_data',
  'address',
  'financial_profile',
  'reference_contacts',
  'device_permissions',
  'consumer_survey',
];

/** A que fase pertenece cada seccion. Es lo que numera «Fase 2 de 4» en la cabecera de cada paso. */
export type FaseDelAlta = 1 | 2 | 3 | 4;
export const FASE_DE_SECCION: Record<OnboardingSectionCode, FaseDelAlta> = {
  contact_verification: 1,
  identity_documents: 2,
  personal_data: 2,
  address: 3,
  financial_profile: 3,
  reference_contacts: 3,
  device_permissions: 3,
  consumer_survey: 4,
};
export const NOMBRE_DE_FASE: Record<FaseDelAlta, string> = { 1: 'Contacto', 2: 'Identidad', 3: 'Tu situación', 4: 'Tus hábitos' };

/** En que posicion (1-based) va una seccion, y cuantas hay. */
export function stepPosition(code: OnboardingSectionCode): { step: number; total: number } {
  const index = SECTION_ORDER.indexOf(code);
  return { step: index >= 0 ? index + 1 : 1, total: SECTION_ORDER.length };
}

/**
 * El icono es parte de la etiqueta, no un adorno de la pantalla.
 *
 * Vive aqui y no en `progreso.tsx` porque la lista de pasos sale en mas de un sitio, y un paso que
 * se dibuja con el sobre en una pantalla y sin nada en otra deja de reconocerse como el mismo. Cada
 * uno apunta al DATO que se pide —el sobre para el codigo, la casa para el domicilio— y no al orden
 * en que toca hacerlo: el orden ya lo cuenta la lista.
 */
export const SECTION_LABEL: Record<OnboardingSectionCode, { title: string; detail: string; icon: IconName }> = {
  contact_verification: { title: 'Verifica tu teléfono', detail: 'Te enviamos un código para confirmar que es tuyo.', icon: 'sobre' },
  personal_data: { title: 'Tus datos personales', detail: 'Nombre, apellido y fecha de nacimiento.', icon: 'perfil' },
  financial_profile: { title: 'Tu situación económica', detail: 'Trabajo, ingresos y gastos declarados.', icon: 'billetera' },
  address: { title: 'Tu domicilio', detail: 'Dónde vives actualmente.', icon: 'hogar' },
  identity_documents: { title: 'Tu documento de identidad', detail: 'Foto del carnet por ambos lados y una selfie.', icon: 'documento' },
  reference_contacts: { title: 'Tus referencias', detail: 'Dos personas que puedan dar referencia de ti.', icon: 'telefono' },
  device_permissions: { title: 'Permisos del teléfono', detail: 'Ubicación y contactos: decides tú, y puedes decir que no.', icon: 'ubicacion' },
  consumer_survey: { title: 'Tus hábitos', detail: 'Seis preguntas cortas sobre cómo manejas tu dinero.', icon: 'billetera' },
};

/** `nextStep` del servidor -> ruta. `awaiting_review` no es una seccion: es el estado de espera. */
export function routeForNextStep(nextStep: string): OnboardingRoute {
  if (nextStep === 'awaiting_review' || nextStep === 'submit') return '/(onboarding)/revision';
  const known = SECTION_ROUTE[nextStep as OnboardingSectionCode];
  return known ?? '/(onboarding)/revision';
}

/**
 * Copy de los bloqueadores.
 *
 * Se explica que falta y que hacer, sin exponer criterio de riesgo: la lista de bloqueadores del
 * servidor incluye codigos como `RISK_NOT_APPROVED`, que a la persona no le sirve de nada leer tal
 * cual y que tampoco conviene detallar.
 */
const BLOCKER_COPY: Record<string, { title: string; detail: string; actionable: boolean }> = {
  ACCOUNT_NOT_ACTIVE: { title: 'Cuenta en proceso', detail: 'Tu cuenta todavía no está activa.', actionable: false },
  CONTACT_NOT_VERIFIED: { title: 'Teléfono sin verificar', detail: 'Confirma el código que te enviamos.', actionable: true },
  FINANCIAL_PROFILE_INCOMPLETE: { title: 'Falta tu información económica', detail: 'Completa trabajo, ingresos y gastos.', actionable: true },
  ADDRESS_MISSING: { title: 'Falta tu domicilio', detail: 'Indica dónde vives.', actionable: true },
  REFERENCES_INSUFFICIENT: { title: 'Faltan referencias', detail: 'Necesitamos dos contactos de referencia.', actionable: true },
  IDENTITY_DOCUMENT_MISSING: { title: 'Falta tu documento', detail: 'Sube tu carnet de identidad.', actionable: true },
  IDENTITY_NOT_VERIFIED: { title: 'Documento en verificación', detail: 'Estamos validando tu identidad.', actionable: false },
  CONSUMER_SURVEY_INCOMPLETE: { title: 'Faltan tus hábitos', detail: 'Contesta las seis preguntas.', actionable: true },
  DEVICE_PERMISSIONS_UNDECIDED: { title: 'Falta decidir los permisos', detail: 'Ubicación y contactos: puedes decir que no.', actionable: true },
  EVIDENCE_PENDING_REVIEW: { title: 'Documentos en revisión', detail: 'Un analista está revisando lo que enviaste.', actionable: false },
  RISK_NOT_APPROVED: { title: 'Evaluación en curso', detail: 'Estamos evaluando tu solicitud.', actionable: false },
};

export function describeBlocker(blocker: Blocker): { title: string; detail: string; actionable: boolean } {
  return BLOCKER_COPY[blocker.code] ?? { title: 'Requisito pendiente', detail: 'Estamos revisando tu solicitud.', actionable: false };
}

/** Bloqueadores sobre los que la persona puede actuar hoy. El resto solo se informa. */
export function actionableBlockers(blockers: Blocker[]): Blocker[] {
  return blockers.filter((blocker) => describeBlocker(blocker).actionable);
}

const LIFECYCLE_COPY: Record<string, { title: string; detail: string }> = {
  registered: { title: 'Cuenta creada', detail: 'Termina de completar tus datos para pedir tu línea.' },
  onboarding_in_progress: { title: 'Registro en curso', detail: 'Te falta poco para terminar.' },
  under_review: { title: 'Solicitud en revisión', detail: 'Estamos validando tu información. Te avisamos apenas tengamos respuesta.' },
  observed: { title: 'Necesitamos una correccion', detail: 'Revisa las observaciones y vuelve a enviar.' },
  active: { title: 'Cuenta activa', detail: 'Ya puedes comprar con Atlas.' },
  rejected: { title: 'Solicitud no aprobada', detail: 'Por ahora no podemos habilitar tu línea.' },
  suspended: { title: 'Cuenta suspendida', detail: 'Comunícate con soporte para revisar tu caso.' },
};

export function describeLifecycle(status: string): { title: string; detail: string } {
  return LIFECYCLE_COPY[status] ?? { title: 'Registro en curso', detail: 'Continúa donde lo dejaste.' };
}

/**
 * Estado de la cuenta, dicho en el idioma del cliente.
 *
 * El backend devuelve su enumerado (`active`, `suspended`…) y la pantalla lo estaba mostrando tal
 * cual: en el perfil se leia «ACTIVE», que es vocabulario del sistema, no del producto. Una palabra
 * en ingles y en mayusculas dentro de una pantalla en espanol es lo que delata que la interfaz esta
 * ensenando su base de datos.
 *
 * Lo que no reconoce se devuelve sin traducir en lugar de inventarse un nombre: un estado nuevo del
 * servidor debe verse raro, no verse mal.
 */
const CUSTOMER_STATUS_COPY: Record<string, string> = {
  active: 'activa',
  pending: 'pendiente',
  pending_verification: 'por verificar',
  under_review: 'en revisión',
  suspended: 'suspendida',
  blocked: 'bloqueada',
  closed: 'cerrada',
  rejected: 'rechazada',
};

export function describeCustomerStatus(status: string | undefined): string {
  if (!status) return 'sin estado';
  return CUSTOMER_STATUS_COPY[status] ?? status;
}
