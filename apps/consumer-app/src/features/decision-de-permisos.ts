/**
 * El consentimiento de la pantalla de permisos, UNO POR FINALIDAD (APP-12).
 *
 * Antes un solo «Permitir» pedía la ubicación y la agenda con el mismo toque: el consentimiento no era
 * específico por finalidad (ISO 27701 7.2.3/7.2.4) y se podía impugnar como prueba. Ahora cada tarjeta
 * tiene su «Permitir» y su «Ahora no», y lo que se registra de cada una es lo que la persona eligió EN
 * ESA tarjeta. El registro en el servidor ya era uno por finalidad (`device-signals.ts`,
 * `registrarConsentimientos`); lo que faltaba era que la elección también lo fuera.
 */
export type Eleccion = 'pendiente' | 'concedido' | 'denegado' | 'omitido';

export type Elecciones = { ubicacion: Eleccion; contactos: Eleccion };

export const SIN_ELEGIR: Elecciones = { ubicacion: 'pendiente', contactos: 'pendiente' };

/** Lo que falta por decidir, dicho para el botón bloqueado; `null` si ya se decidieron las dos. */
export function faltaPorDecidir(elecciones: Elecciones): string | null {
  const ubicacion = elecciones.ubicacion === 'pendiente';
  const contactos = elecciones.contactos === 'pendiente';
  if (ubicacion && contactos) return 'Elige «Permitir» o «Ahora no» en cada tarjeta.';
  if (ubicacion) return 'Falta decidir sobre tu ubicación.';
  if (contactos) return 'Falta decidir sobre tus contactos.';
  return null;
}

/**
 * La decisión que se guarda y se registra. Concedido es lo que el SISTEMA contestó, no el toque:
 * quien pulsa «Permitir» y niega el diálogo queda como denegado. `segundoPlano` es el estado vigente.
 */
export function decisionFinal(
  elecciones: Elecciones,
  segundoPlano: boolean,
): { ubicacion: boolean; ubicacionSiempre: boolean; contactos: boolean } {
  const ubicacion = elecciones.ubicacion === 'concedido';
  return { ubicacion, ubicacionSiempre: ubicacion && segundoPlano, contactos: elecciones.contactos === 'concedido' };
}
