/**
 * Cómo se enseñan los datos de una persona en «Mis datos»: en lenguaje de persona, no de base de datos.
 *
 * La pantalla pintaba el estado como `active`, la fecha como `6/12/2001`, el correo como `…—`, un domicilio vacío como
 * un guion, y el identificador interno del cliente. Eso es el dato crudo, no «lo que Atlas sabe de ti». Aquí vive la
 * traducción, en funciones puras para poder probarla sin montar la pantalla.
 *
 * El identificador interno (`CUS-…`) NO se enseña nunca: es una clave de la base, no un dato que la persona necesite, y
 * en una captura de pantalla identifica la cuenta ante quien no debe.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * `2001-12-06` → `6 de diciembre de 2001`.
 *
 * Una fecha SIN hora (`YYYY-MM-DD`) se lee por sus partes y no con `new Date(...)`: el motor la toma como medianoche UTC y
 * en Bolivia (UTC−4) la mostraría un día antes. Una fecha con hora (un instante) sí pasa por `Date`.
 */
export function fechaLarga(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soloFecha) {
    const mes = MESES[Number(soloFecha[2]) - 1];
    return mes ? `${Number(soloFecha[3])} de ${mes} de ${soloFecha[1]}` : null;
  }
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) return null;
  return `${instante.getDate()} de ${MESES[instante.getMonth()]} de ${instante.getFullYear()}`;
}

/** Un texto que puede faltar → su valor, o «Sin registrar» (no un guion que parece un error). */
export const oSinRegistrar = (valor: string | null | undefined): string => (valor && valor.trim() ? valor.trim() : 'Sin registrar');

type Tono = 'success' | 'warning' | 'danger' | 'primary';

const ESTADOS: Record<string, { texto: string; tono: Tono }> = {
  active: { texto: 'Activa', tono: 'success' },
  approved: { texto: 'Activa', tono: 'success' },
  pending: { texto: 'En revisión', tono: 'warning' },
  pending_review: { texto: 'En revisión', tono: 'warning' },
  under_review: { texto: 'En revisión', tono: 'warning' },
  onboarding: { texto: 'Completando el registro', tono: 'warning' },
  suspended: { texto: 'Suspendida', tono: 'danger' },
  blocked: { texto: 'Bloqueada', tono: 'danger' },
  rejected: { texto: 'No aprobada', tono: 'danger' },
  closed: { texto: 'Cerrada', tono: 'primary' },
  inactive: { texto: 'Inactiva', tono: 'primary' },
};

/** El estado de la cuenta como lo diría una persona. Un código que no conocemos se humaniza, no se enseña tal cual. */
export function estadoDeCuenta(codigo: string | null | undefined): { texto: string; tono: Tono } {
  if (!codigo) return { texto: 'Sin estado', tono: 'primary' };
  return ESTADOS[codigo] ?? { texto: humanizar(codigo), tono: 'primary' };
}

/** `employment_type` → `Employment type` sólo como último recurso: primera mayúscula y sin guiones bajos. */
export function humanizar(codigo: string): string {
  const texto = codigo.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim().toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

type Contacto = { contactType: string; status: string; isPrimary: boolean; valueLast4: string | null; maskedValue?: string | null };

/** Un contacto como una fila: «Teléfono principal  ••••7232 · Verificado». */
export function contactoLegible(contacto: Contacto): { etiqueta: string; valor: string } {
  const tipo = contacto.contactType === 'phone' ? 'Teléfono' : contacto.contactType === 'email' ? 'Correo' : humanizar(contacto.contactType);
  const etiqueta = contacto.isPrimary ? `${tipo} principal` : tipo;
  let valor: string;
  if (contacto.contactType === 'email') valor = contacto.maskedValue ?? 'Correo registrado';
  else valor = contacto.valueLast4 ? `•••• ${contacto.valueLast4}` : 'Registrado';
  const verificado = contacto.status === 'verified' ? 'Verificado' : 'Sin verificar';
  return { etiqueta, valor: `${valor} · ${verificado}` };
}

const ETIQUETA_ECONOMIA: Record<string, string> = {
  employmentStatus: 'Situación laboral',
  employerName: 'Dónde trabajas',
  employmentSeniorityMonths: 'Antigüedad en tu trabajo',
  incomeBand: 'Rango de ingreso mensual',
  incomeFrequency: 'Cada cuánto cobras',
  monthlyIncomeDeclared: 'Ingreso mensual declarado',
  monthlyIncome: 'Ingreso mensual',
  incomeSource: 'De dónde viene tu ingreso',
  employmentType: 'Tipo de trabajo',
  monthlyExpenses: 'Gastos mensuales',
  dependents: 'Personas que dependen de ti',
};

export const etiquetaEconomia = (clave: string): string => ETIQUETA_ECONOMIA[clave] ?? humanizar(clave);

const DINERO = new Set(['monthlyIncome', 'monthlyExpenses', 'monthlyIncomeDeclared']);

/** Los códigos cerrados del formulario de economía, dichos como los dice el formulario. Mismos códigos que `economia.tsx`. */
const SITUACION_LABORAL: Record<string, string> = {
  employee: 'Trabajo en relación de dependencia',
  self_employed: 'Trabajo por cuenta propia',
  business_owner: 'Tengo mi propio negocio',
  unemployed: 'Sin empleo por ahora',
  student: 'Estudiante',
};
const FRECUENCIA_DE_COBRO: Record<string, string> = {
  monthly: 'Cada mes',
  biweekly: 'Cada quincena',
  weekly: 'Cada semana',
  irregular: 'Sin fecha fija',
};

const miles = (n: number) => n.toLocaleString('es-BO');

/** `bs_3000_5000` → `Bs 3.000 a 5.000`; `bs_0_3000` → `Menos de Bs 3.000`; `bs_20000_plus` → `Más de Bs 20.000`. */
export function bandaDeIngreso(codigo: string): string | null {
  const plus = /^bs_(\d+)_plus$/.exec(codigo);
  if (plus) return `Más de Bs ${miles(Number(plus[1]))}`;
  const rango = /^bs_(\d+)_(\d+)$/.exec(codigo);
  if (!rango) return null;
  const [desde, hasta] = [Number(rango[1]), Number(rango[2])];
  return desde === 0 ? `Menos de Bs ${miles(hasta)}` : `Bs ${miles(desde)} a ${miles(hasta)}`;
}

/** `30` → `2 años y 6 meses`; `12` → `1 año`; `5` → `5 meses`. */
export function antiguedadEnMeses(meses: number): string {
  if (!Number.isFinite(meses) || meses < 0) return 'Sin registrar';
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const unAnio = anios === 1 ? '1 año' : `${anios} años`;
  if (anios === 0) return resto === 1 ? '1 mes' : `${resto} meses`;
  if (resto === 0) return unAnio;
  return `${unAnio} y ${resto === 1 ? '1 mes' : `${resto} meses`}`;
}

/** Un dato económico declarado: el dinero en Bs con miles, los códigos del formulario en palabras, el resto legible. */
export function valorEconomia(clave: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'Sin registrar';
  if (DINERO.has(clave)) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? `Bs ${miles(numero)}` : String(valor);
  }
  const texto = String(valor);
  if (clave === 'employmentStatus') return SITUACION_LABORAL[texto] ?? humanizar(texto);
  if (clave === 'incomeFrequency') return FRECUENCIA_DE_COBRO[texto] ?? humanizar(texto);
  if (clave === 'incomeBand') return bandaDeIngreso(texto) ?? humanizar(texto);
  if (clave === 'employmentSeniorityMonths') return antiguedadEnMeses(Number(valor));
  if (typeof valor === 'number') return String(valor);
  // Un código en snake_case se humaniza; una frase escrita por la persona se respeta tal cual.
  return /^[a-z]+(_[a-z]+)+$/.test(texto) ? humanizar(texto) : texto;
}
