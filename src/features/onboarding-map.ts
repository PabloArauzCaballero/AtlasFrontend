/**
 * Traduccion entre el vocabulario del servidor y el de la interfaz.
 *
 * El backend manda: el `nextStep` y el estado de cada seccion vienen calculados alli. La app solo
 * necesita saber a que pantalla corresponde cada codigo y como nombrarlo en espanol para una
 * persona que no sabe que es un "reference_contact".
 */
import type { Blocker, OnboardingSectionCode } from '../api/endpoints/onboarding';

export type OnboardingRoute =
  | '/(onboarding)/verificar-contacto'
  | '/(onboarding)/perfil'
  | '/(onboarding)/economia'
  | '/(onboarding)/domicilio'
  | '/(onboarding)/identidad'
  | '/(onboarding)/referencias'
  | '/(onboarding)/revision';

export const SECTION_ROUTE: Record<OnboardingSectionCode, OnboardingRoute> = {
  contact_verification: '/(onboarding)/verificar-contacto',
  personal_data: '/(onboarding)/perfil',
  financial_profile: '/(onboarding)/economia',
  address: '/(onboarding)/domicilio',
  identity_documents: '/(onboarding)/identidad',
  reference_contacts: '/(onboarding)/referencias',
};

export const SECTION_LABEL: Record<OnboardingSectionCode, { title: string; detail: string }> = {
  contact_verification: { title: 'Verifica tu telefono', detail: 'Te enviamos un codigo para confirmar que es tuyo.' },
  personal_data: { title: 'Tus datos personales', detail: 'Nombre, apellido y fecha de nacimiento.' },
  financial_profile: { title: 'Tu situacion economica', detail: 'Trabajo, ingresos y gastos declarados.' },
  address: { title: 'Tu domicilio', detail: 'Donde vives actualmente.' },
  identity_documents: { title: 'Tu documento de identidad', detail: 'Foto del carnet por ambos lados y una selfie.' },
  reference_contacts: { title: 'Tus referencias', detail: 'Dos personas que puedan dar referencia de ti.' },
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
  ACCOUNT_NOT_ACTIVE: { title: 'Cuenta en proceso', detail: 'Tu cuenta todavia no esta activa.', actionable: false },
  CONTACT_NOT_VERIFIED: { title: 'Telefono sin verificar', detail: 'Confirma el codigo que te enviamos.', actionable: true },
  FINANCIAL_PROFILE_INCOMPLETE: { title: 'Falta tu informacion economica', detail: 'Completa trabajo, ingresos y gastos.', actionable: true },
  ADDRESS_MISSING: { title: 'Falta tu domicilio', detail: 'Indica donde vives.', actionable: true },
  REFERENCES_INSUFFICIENT: { title: 'Faltan referencias', detail: 'Necesitamos dos contactos de referencia.', actionable: true },
  IDENTITY_DOCUMENT_MISSING: { title: 'Falta tu documento', detail: 'Sube tu carnet de identidad.', actionable: true },
  IDENTITY_NOT_VERIFIED: { title: 'Documento en verificacion', detail: 'Estamos validando tu identidad.', actionable: false },
  EVIDENCE_PENDING_REVIEW: { title: 'Documentos en revision', detail: 'Un analista esta revisando lo que enviaste.', actionable: false },
  RISK_NOT_APPROVED: { title: 'Evaluacion en curso', detail: 'Estamos evaluando tu solicitud.', actionable: false },
};

export function describeBlocker(blocker: Blocker): { title: string; detail: string; actionable: boolean } {
  return BLOCKER_COPY[blocker.code] ?? { title: 'Requisito pendiente', detail: 'Estamos revisando tu solicitud.', actionable: false };
}

/** Bloqueadores sobre los que la persona puede actuar hoy. El resto solo se informa. */
export function actionableBlockers(blockers: Blocker[]): Blocker[] {
  return blockers.filter((blocker) => describeBlocker(blocker).actionable);
}

const LIFECYCLE_COPY: Record<string, { title: string; detail: string }> = {
  registered: { title: 'Cuenta creada', detail: 'Termina de completar tus datos para pedir tu linea.' },
  onboarding_in_progress: { title: 'Registro en curso', detail: 'Te falta poco para terminar.' },
  under_review: { title: 'Solicitud en revision', detail: 'Estamos validando tu informacion. Te avisamos apenas tengamos respuesta.' },
  observed: { title: 'Necesitamos una correccion', detail: 'Revisa las observaciones y vuelve a enviar.' },
  active: { title: 'Cuenta activa', detail: 'Ya puedes comprar con Atlas.' },
  rejected: { title: 'Solicitud no aprobada', detail: 'Por ahora no podemos habilitar tu linea.' },
  suspended: { title: 'Cuenta suspendida', detail: 'Comunicate con soporte para revisar tu caso.' },
};

export function describeLifecycle(status: string): { title: string; detail: string } {
  return LIFECYCLE_COPY[status] ?? { title: 'Registro en curso', detail: 'Continua donde lo dejaste.' };
}
