/**
 * El texto de la compra en demostracion.
 *
 * El plan de la compra que arma la app (60 % hoy, 40 % en tres cuotas cada 14 dias, sin recargos)
 * es una constante local: `src/domain/policy.ts` en modo `sandbox`. NO es lo que Core cobra: el
 * credito real lo arma Core con la tasa que fija el Motor por solicitud y cuotas mensuales, y la
 * pantalla de credito (`credito/[loanId]`) es la verdad. Por eso todo lo que describa ese plan lleva,
 * en la misma pantalla, este rotulo. Vive en un solo sitio para que no se vuelva a escribir «sin
 * intereses» al lado de un numero de demostracion.
 */

/** Lo que se le dice al cliente cuando la compra es simulada y toca un botón de dinero. */
export const AVISO_DEMOSTRACION =
  'Esta compra es de demostración: el aviso no se envía a ningún comercio. Los pagos reales se avisan desde Pagos, abriendo la cuota.';

/** Debajo de cualquier desglose de cuotas de la simulacion. */
export const AVISO_PLAN_SIMULADO =
  'Pagas el 60 % directo al comercio y financias el 40 % con Atlas. El plazo, las cuotas y la tasa definitivos los fija Atlas al aprobar tu solicitud, y los ves en la pantalla de tu crédito.';
