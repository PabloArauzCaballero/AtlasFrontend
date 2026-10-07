/**
 * Lo que una persona puede pedir sobre sus datos, dicho como lo entiende ella, y cómo se arma la solicitud.
 *
 * Hasta el 2026-10-04 la app mandaba sólo «quiero corregir» o «quiero borrar», sin decir qué: la cola recibía solicitudes
 * imposibles de atender. Ahora una corrección dice QUÉ dato y CUÁL es el valor correcto, y un borrado explica antes de
 * enviarse qué se borra y qué la ley obliga a conservar. Mismas claves que el backend (`RECTIFICATION_FIELDS`).
 */
import type { OpcionSelect } from '../ui/form-controls';

export type CampoCorregible =
  | 'address'
  | 'zone'
  | 'city'
  | 'address_reference'
  | 'occupation'
  | 'employer'
  | 'declared_income'
  | 'first_name'
  | 'last_name'
  | 'birth_date'
  | 'document_number'
  | 'phone'
  | 'email'
  | 'other';

export const CAMPOS_CORREGIBLES: OpcionSelect<CampoCorregible>[] = [
  { valor: 'address', etiqueta: 'Dirección', detalle: 'La calle y el número donde vives.' },
  { valor: 'zone', etiqueta: 'Zona o barrio', detalle: 'El barrio o la zona de tu domicilio, p. ej. Equipetrol.' },
  { valor: 'city', etiqueta: 'Ciudad', detalle: 'La ciudad donde vives.' },
  { valor: 'address_reference', etiqueta: 'Referencia del domicilio', detalle: 'Cómo encontrar tu casa: «frente a la plaza», «portón verde».' },
  { valor: 'occupation', etiqueta: 'Ocupación', detalle: 'A qué te dedicas. Puede cambiar tu línea de crédito: lo revisa una persona.' },
  { valor: 'employer', etiqueta: 'Dónde trabajas', detalle: 'El nombre de tu empleador o negocio. Lo revisa una persona.' },
  { valor: 'declared_income', etiqueta: 'Ingreso mensual', detalle: 'Cuánto ganas al mes. Puede cambiar tu línea: lo revisa una persona.' },
  { valor: 'first_name', etiqueta: 'Nombres', detalle: 'Tal como figuran en tu carnet. Lo revisa una persona con tu documento.' },
  { valor: 'last_name', etiqueta: 'Apellidos', detalle: 'Tal como figuran en tu carnet. Lo revisa una persona con tu documento.' },
  { valor: 'birth_date', etiqueta: 'Fecha de nacimiento', detalle: 'La de tu carnet. Lo revisa una persona con tu documento.' },
  { valor: 'document_number', etiqueta: 'Número de carnet', detalle: 'Tu número de cédula. Lo revisa una persona con tu documento.' },
  { valor: 'phone', etiqueta: 'Teléfono', detalle: 'Se cambia tú mismo desde Perfil, con un código al número nuevo.' },
  { valor: 'email', etiqueta: 'Correo', detalle: 'Se cambia tú mismo desde Perfil, con un código al correo nuevo.' },
  { valor: 'other', etiqueta: 'Otro dato', detalle: 'Algo que no está en la lista: cuéntanos cuál y lo revisa una persona.' },
];

/** Teléfono y correo tienen su propio camino seguro (código al contacto nuevo). Por una solicitud se lo saltarían. */
export const esAutoservicio = (campo: CampoCorregible | null) => campo === 'phone' || campo === 'email';

/** Cambiar quién es la persona exige revisar su documento (diligencia debida). */
export const esIdentidad = (campo: CampoCorregible | null) =>
  campo === 'first_name' || campo === 'last_name' || campo === 'birth_date' || campo === 'document_number';

/**
 * Qué implica borrar la cuenta, en palabras de persona y con la norma detrás.
 *
 * Bolivia no tiene ley general de datos; el derecho a pedir que se borren viene de la Constitución (art. 130). Pero la Ley
 * 393 (art. 34) y el reglamento de la UIF (DS 4904, art. 18) obligan a conservar 10 años los registros de operaciones y la
 * diligencia debida, contados desde que termina la relación. Decirlo ANTES de enviar evita que la persona crea que todo
 * desaparece y se entere después.
 */
export const QUE_IMPLICA_BORRAR = {
  seBorra: 'Cerramos tu cuenta y borramos lo que no estamos obligados a guardar: tus preferencias, tu agenda, tu ubicación y los datos de tus dispositivos.',
  seConserva:
    'Lo que la ley nos obliga a guardar —tu identidad, tus compras, cuotas y pagos, y tus reclamos— se conserva 10 años desde que se cierra la cuenta (Ley 393 de Servicios Financieros y reglamento de la UIF) y no se usa para nada más.',
  conDeuda: 'Si tienes un saldo o un pago por conciliar, primero hay que dejarlo en cero.',
  plazo: 'Te respondemos en un máximo de 15 días.',
};

export type FormularioSolicitud = {
  tipo: 'rectification' | 'deletion' | null;
  campo: CampoCorregible | null;
  valor: string;
  comentario: string;
};

export const FORMULARIO_VACIO: FormularioSolicitud = { tipo: null, campo: null, valor: '', comentario: '' };

/** El primer motivo por el que todavía no se puede enviar, o null si se puede. Lo enseña el botón. */
export function motivoParaNoEnviar(f: FormularioSolicitud): string | null {
  if (!f.tipo) return 'Elige qué quieres pedir.';
  if (f.tipo === 'deletion') return null;
  if (!f.campo) return 'Elige qué dato quieres corregir.';
  if (esAutoservicio(f.campo)) return 'El teléfono y el correo los cambias tú mismo desde Perfil.';
  if (f.campo === 'other') return f.comentario.trim().length >= 5 ? null : 'Cuéntanos qué dato quieres corregir.';
  if (!f.valor.trim()) return 'Escribe el dato correcto.';
  return null;
}

/** El cuerpo que se manda al servidor. Sólo lo que hace falta: nada de campos vacíos. */
export function cuerpoDeSolicitud(f: FormularioSolicitud): {
  requestType: 'rectification' | 'deletion';
  description?: string;
  field?: CampoCorregible;
  proposedValue?: string;
} {
  if (!f.tipo) throw new Error('Falta el tipo de solicitud.');
  const comentario = f.comentario.trim();
  const base = { requestType: f.tipo, ...(comentario.length >= 5 ? { description: comentario } : {}) };
  if (f.tipo === 'deletion' || !f.campo) return base;
  const valor = f.valor.trim();
  return { ...base, field: f.campo, ...(valor ? { proposedValue: valor } : {}) };
}
