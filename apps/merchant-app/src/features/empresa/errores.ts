/**
 * El texto de un fallo, como lo enseña el portal web en «Mi empresa».
 *
 * La web muestra `error.message` de CUALQUIER error, no sólo de los de la API: «El almacenamiento
 * rechazó la subida del archivo (403)» o «La sucursal se registró, pero…» son frases escritas para
 * el comercio y se pierden si sólo se confía en `ApiError` (`mensajeDeError` del cliente). Lo que no
 * es un `Error` —un valor raro lanzado por una librería— cae en el respaldo.
 */
export function mensajeDe(error: unknown, respaldo: string): string {
  return error instanceof Error && error.message ? error.message : respaldo;
}
