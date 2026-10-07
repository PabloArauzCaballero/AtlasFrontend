/**
 * Lo que una persona puede pedir sobre sus datos, dicho como lo entiende ella, y cómo se arma la solicitud.
 *
 * Hasta el 2026-10-04 la app mandaba sólo «quiero corregir» o «quiero borrar», sin decir qué: la cola recibía solicitudes
 * imposibles de atender. Ahora una corrección dice QUÉ dato y CUÁL es el valor correcto, y un borrado explica antes de
 * enviarse qué se borra y qué la ley obliga a conservar. Mismas claves que el backend (`RECTIFICATION_FIELDS`).
 */
import type { OpcionSelect } from '../ui/form-controls';
import { ACTIVIDADES, OTRA_ACTIVIDAD } from './actividades';
import { DEPARTAMENTOS, OTRA_ZONA, zonasDe } from './geografia';
import { BANDAS } from './ingresos';

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

/**
 * Los datos que tienen lista cerrada en el resto de la app, con las MISMAS listas que el alta: así lo corregido es
 * comparable con lo declarado y nadie escribe «Sta Cruz» donde antes se eligió «Santa Cruz de la Sierra».
 *
 * `valor` es el texto que viaja como valor correcto: el servidor lo guarda cifrado y una persona lo lee al revisar, así que
 * es la etiqueta («Comercio y ventas»), no un código interno. Lo «otro» de cada lista no se ofrece: para eso está «Otro
 * dato», que pide contarlo. Los campos que no salen aquí (dirección, referencia, empleador, nombres, carnet) son texto
 * libre y la fecha de nacimiento usa el calendario.
 */
export const OPCIONES_POR_CAMPO: Partial<Record<CampoCorregible, OpcionSelect[]>> = {
  occupation: ACTIVIDADES.filter((a) => a.codigo !== OTRA_ACTIVIDAD).map((a) => ({
    valor: a.nombre,
    etiqueta: a.nombre,
    detalle: a.detalle,
  })),
  city: DEPARTAMENTOS.flatMap((d) =>
    d.ciudades.map((c) => ({ valor: c.nombre, etiqueta: c.nombre, detalle: `Ciudad del departamento de ${d.nombre}.` })),
  ),
  zone: DEPARTAMENTOS.flatMap((d) =>
    d.ciudades.flatMap((c) =>
      zonasDe(c.codigo)
        .filter((z) => z.codigo !== OTRA_ZONA.codigo)
        .map((z) => ({ valor: `${z.nombre}, ${c.nombre}`, etiqueta: z.nombre, detalle: `Zona de ${c.nombre}, en el departamento de ${d.nombre}.` })),
    ),
  ),
  declared_income: BANDAS.map((b) => ({ valor: b.etiqueta, etiqueta: b.etiqueta, detalle: b.detalle })),
};

/** Los que se eligen con el calendario y viajan como `AAAA-MM-DD`. */
export const esFecha = (campo: CampoCorregible) => campo === 'birth_date';

export type FormularioSolicitud = {
  tipo: 'rectification' | 'deletion' | null;
  /** Todos los datos marcados, en cualquier orden: se envían uno por solicitud, cada uno con su valor. */
  campos: CampoCorregible[];
  valores: Partial<Record<CampoCorregible, string>>;
  comentario: string;
};

export const FORMULARIO_VACIO: FormularioSolicitud = { tipo: null, campos: [], valores: {}, comentario: '' };

const etiquetaDe = (campo: CampoCorregible) => CAMPOS_CORREGIBLES.find((o) => o.valor === campo)?.etiqueta ?? campo;

/** Marca o desmarca un dato; al desmarcar se olvida lo que se había escrito para él. */
export function alternarCampo(f: FormularioSolicitud, campo: CampoCorregible, marcado: boolean): FormularioSolicitud {
  const campos = marcado ? (f.campos.includes(campo) ? f.campos : [...f.campos, campo]) : f.campos.filter((c) => c !== campo);
  const { [campo]: _quitado, ...valores } = f.valores;
  return { ...f, campos, valores: marcado ? f.valores : valores };
}

/** Lo que de verdad se envía como corrección, en el orden de la lista: teléfono y correo van por Perfil, no por aquí. */
export const camposAEnviar = (f: FormularioSolicitud): CampoCorregible[] =>
  CAMPOS_CORREGIBLES.map((o) => o.valor).filter((c) => f.campos.includes(c) && !esAutoservicio(c));

/** El primer motivo por el que todavía no se puede enviar, o null si se puede. Lo enseña el botón. */
export function motivoParaNoEnviar(f: FormularioSolicitud): string | null {
  if (!f.tipo) return 'Elige qué quieres pedir.';
  if (f.tipo === 'deletion') return null;
  if (f.campos.length === 0) return 'Elige qué datos quieres corregir.';
  const enviables = camposAEnviar(f);
  if (enviables.length === 0) return 'El teléfono y el correo los cambias tú mismo desde Perfil.';
  for (const campo of enviables) {
    if (campo === 'other') {
      if (f.comentario.trim().length < 5) return 'Cuéntanos qué dato quieres corregir.';
    } else if (!f.valores[campo]?.trim()) {
      return enviables.length === 1 ? 'Escribe el dato correcto.' : `Falta el dato correcto de «${etiquetaDe(campo)}».`;
    }
  }
  return null;
}

export type CuerpoSolicitud = {
  requestType: 'rectification' | 'deletion';
  description?: string;
  field?: CampoCorregible;
  proposedValue?: string;
};

/**
 * Las solicitudes que se mandan al servidor. Sólo lo que hace falta: nada de campos vacíos.
 *
 * El servidor recibe UN dato por solicitud (su cola, su revisión y su cifrado son por campo), así que marcar varios manda
 * varias, cada una con su valor y con el mismo comentario.
 */
export function cuerposDeSolicitud(f: FormularioSolicitud): CuerpoSolicitud[] {
  if (!f.tipo) throw new Error('Falta el tipo de solicitud.');
  const comentario = f.comentario.trim();
  const base = { requestType: f.tipo, ...(comentario.length >= 5 ? { description: comentario } : {}) };
  if (f.tipo === 'deletion') return [base];
  return camposAEnviar(f).map((campo) => {
    const valor = f.valores[campo]?.trim();
    return { ...base, field: campo, ...(valor ? { proposedValue: valor } : {}) };
  });
}
