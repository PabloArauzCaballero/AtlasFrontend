import { marca } from '../theme/tokens';
/**
 * El texto del consentimiento de UBICACION, en un solo sitio.
 *
 * ## Por que existe
 *
 * La ubicacion se puede consentir desde dos pantallas: la de permisos y el mapa del domicilio. La de
 * permisos enseñaba para que se usa y que no se hace; el domicilio registraba el consentimiento
 * `location_tracking` despues de los dialogos del sistema, sin enseñar nada de eso. El permiso del
 * sistema no es el consentimiento —lo dice el propio modulo de señales—, y en ese camino se igualaban.
 *
 * Aqui vive lo que se le dice a la persona en los dos sitios, para que no puedan divergir.
 */

export const USOS_DE_LA_UBICACION: readonly string[] = [
  'Comprobar que el domicilio que declaras es donde realmente estás.',
  'Avisarte si alguien usa tu cuenta desde otro lugar.',
  'Detectar ubicaciones simuladas, la señal más común de una solicitud falsa.',
];

export const LO_QUE_NO_HACEMOS_CON_LA_UBICACION = 'No la compartimos con los comercios ni la usamos para publicidad.';

/** Lo que pasa si ademas concede «Siempre». Debe coincidir con `features/rastreo-plazo.ts` y `rastreo.ts`. */
export const FRECUENCIA_CON_LA_APP_CERRADA =
  'Si además eliges «Siempre», también con la app cerrada: como mucho cada 15 minutos y durante 30 días, que puedes acortar desde tu perfil.';

export const TITULO_CONSENTIMIENTO_UBICACION = '¿Registramos tu ubicación?';

/** El cuerpo del aviso del domicilio: usos, lo que no se hace y como retirarlo. */
export function textoConsentimientoUbicacion(): string {
  return [
    `Además de marcar tu casa, ${marca.nombre} puede registrar tu ubicación mientras usas la app (cada 5 minutos) para:`,
    ...USOS_DE_LA_UBICACION.map((uso) => `• ${uso}`),
    LO_QUE_NO_HACEMOS_CON_LA_UBICACION,
    FRECUENCIA_CON_LA_APP_CERRADA,
    'Puedes retirarlo cuando quieras desde «Privacidad». Si dices que no, tu domicilio se guarda igual.',
  ].join('\n');
}
