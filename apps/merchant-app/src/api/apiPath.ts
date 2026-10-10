const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida un identificador usado dentro de una ruta antes de disparar fetch.
 * Evita llamadas como /campaigns//status que terminan en 404 operativos.
 */
export function requireUuidPathParam(value: string, label: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Debe indicar ${label} antes de continuar.`);
  }

  if (!uuidPattern.test(trimmedValue)) {
    throw new Error(`${label} debe ser un UUID válido.`);
  }

  return encodeURIComponent(trimmedValue);
}
