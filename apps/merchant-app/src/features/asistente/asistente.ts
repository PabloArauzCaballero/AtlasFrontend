/**
 * El asistente del comercio dentro de la app: lo que no es pantalla.
 *
 * Sale de `AtlasERPFrontend/lib/asistente.ts` con la superficie `merchant-portal` fija (en el teléfono
 * no hay otra). Qué catálogo le contesta NO lo decide este código: lo fija el backend del ERP por el
 * tipo de sesión. Aquí sólo se decide lo que se ve: el nombre de la sección donde está la persona,
 * qué se le dice cuando algo falla y a dónde lleva «hablar con una persona» (`/soporte`, que en la
 * web es `/portal-comercio/soporte`).
 */
import { ApiError } from '@/api/client';

export const MAX_PREGUNTA = 2000;

export const AVISO_DATOS = 'No escribas contraseñas, códigos ni datos personales.';

/** A dónde lleva «hablar con una persona»: el soporte del comercio, con su chat y sus casos. */
export const RUTA_DE_SOPORTE = '/soporte';

/**
 * Las preguntas del estado vacío, para que la primera pantalla no sea un campo en blanco frente a un
 * robot. Son de lo que el comercio hace a diario en la app (la web no las tiene: allí el panel abre
 * con una frase y nada más).
 */
export const PREGUNTAS_FRECUENTES = [
  '¿Cómo respondo una solicitud de compra?',
  '¿Dónde veo lo que Atlas me tiene que pagar?',
  '¿Cómo descargo mi QR de cobro?',
] as const;

/**
 * Las secciones de la app con el MISMO nombre que tienen en el menú del portal web
 * (`PORTAL_COMERCIO_NAV`): el catálogo del asistente habla de esas secciones con esos nombres.
 */
const SECCIONES: readonly (readonly [string, string])[] = [
  ['/gestion-pos', 'Gestión POS'],
  ['/cartera', 'Mi cartera'],
  ['/empresa', 'Mi empresa'],
  ['/soporte', 'Soporte y tutoriales'],
  ['/conversacion', 'Soporte y tutoriales'],
  ['/cuenta', 'Mi cuenta'],
];

function esRutaActiva(pathname: string, ruta: string): boolean {
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

/** Lo que el backend acepta en `screen`: letras, números, espacios y `›/·_-().,`, hasta 80. */
export function limpiarPantalla(texto: string): string {
  return texto
    .replace(/[^\p{L}\p{N} ›/·_\-().,]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
}

/** El nombre visible de la sección donde está la persona, para que «aquí» signifique algo. */
export function pantallaDelAsistente(pathname: string | null | undefined): string {
  const seccion = SECCIONES.find(([ruta]) => esRutaActiva(pathname ?? '', ruta));
  return limpiarPantalla(seccion?.[1] ?? 'Portal del comercio');
}

/**
 * El 404 es el interruptor, no un fallo: con el asistente apagado (o con un backend del ERP que aún
 * no trae la pasarela) todo contesta 404, y el botón flotante desaparece entero.
 */
export function esApagado(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.code === 'ASSIST_DISABLED');
}

/**
 * Qué se le dice a la persona cuando el asistente no contesta. Cada código pide algo distinto:
 * «ocupado» se arregla esperando, un rechazo trae ya su propio texto redactado para leerse, y «sin
 * respuesta» se reintenta tranquilo porque la pregunta va con la misma llave.
 */
export function describirErrorDelAsistente(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Algo falló al hablar con el asistente. Inténtalo otra vez.';
  if (error.status === 0) {
    return 'No hubo respuesta del sistema. Revisa tu conexión y toca «Reintentar»: tu pregunta no se duplica.';
  }
  if (error.code === 'ASSIST_REJECTED' && error.message) return error.message;
  if (error.status === 409) {
    return 'Tu pregunta anterior todavía se está respondiendo. Espera unos segundos y vuelve a intentarlo.';
  }
  if (error.status === 429) return 'El asistente está atendiendo muchas consultas. Espera un momento y vuelve a intentarlo.';
  if (error.status === 401) return 'Tu sesión caducó. Vuelve a iniciar sesión.';
  if (error.status === 403) return 'Tu usuario no tiene acceso al asistente.';
  if (error.status === 400) return 'No pudimos enviar tu pregunta así. Revisa el texto y vuelve a intentarlo.';
  return 'El asistente no está disponible en este momento. Inténtalo en unos minutos o habla con una persona desde Soporte.';
}

/** La fecha de una conversación en español de persona: «Hace 5 min», «Ayer», «12 sep». */
export function fechaRelativa(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  const diff = ahora.getTime() - fecha.getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(ahora) - inicio(fecha)) / 86_400_000);
  if (dias <= 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dia = `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
  return fecha.getFullYear() === ahora.getFullYear() ? dia : `${dia} ${fecha.getFullYear()}`;
}
