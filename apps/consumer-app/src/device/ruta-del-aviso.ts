/**
 * La ruta interna que un aviso pide abrir, o `null` si no pide ninguna válida.
 *
 * Vive aparte del hook que navega porque es la regla de seguridad y tiene que poder probarse sin
 * cargar el router: sólo rutas de la propia app (`/pagos`), nunca una URL ni un salto con `..`. El
 * `data` de un push lo puede escribir cualquiera que tenga el token del dispositivo.
 */
const RUTA_INTERNA = /^\/[A-Za-z0-9/_\-()[\].?=&]{0,299}$/;

/** Una ruta de la propia app: empieza por una sola `/`, sin `..` ni caracteres fuera de la lista. */
export function esRutaInterna(enlace: unknown): enlace is string {
  return typeof enlace === 'string' && RUTA_INTERNA.test(enlace) && !enlace.includes('..') && !enlace.startsWith('//');
}

export function rutaDelAviso(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const enlace = (data as Record<string, unknown>).deepLink;
  return esRutaInterna(enlace) ? enlace : null;
}
