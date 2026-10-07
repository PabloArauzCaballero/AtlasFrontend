/**
 * Qué decirle a quien intentó comprar cuando el crédito no se pudo evaluar.
 *
 * La pantalla decía siempre «El servicio de decisión no respondió (CÓDIGO)… vuelve a intentarlo en un
 * momento». Con `NO_PRODUCT_FOR_AMOUNT` eso es falso: el servicio respondió bien, no hay ningún producto de
 * crédito activo que admita ese monto, y reintentar no lo arregla (2026-10-07, TEST con la base limpia: la
 * persona reintentaba una compra de Bs 250 que no podía salir). Cada causa dice lo que de verdad pasa y qué hacer.
 */
export type ExplicacionDeFalla = { titulo: string; detalle: string };

export function explicarFallaDeDecision(codigo: string): ExplicacionDeFalla {
  switch (codigo) {
    case 'NO_PRODUCT_FOR_AMOUNT':
      return {
        titulo: 'Este monto no tiene un crédito disponible',
        detalle:
          'Por ahora ningún producto de crédito de Atlas admite la parte financiada de esta compra. Reintentar no lo cambia: prueba con otro monto o avisa al equipo de Atlas. Tu compra sigue abierta y nadie la rechazó.',
      };
    case 'CREDIT_PRODUCTS_UNAVAILABLE':
      return {
        titulo: 'Sin conexión',
        detalle: 'No pudimos consultar los créditos disponibles. Revisa tu conexión y vuelve a intentarlo. Tu compra sigue abierta y nadie la rechazó.',
      };
    default:
      return {
        titulo: 'No pudimos evaluar tu compra',
        detalle: `El servicio de decisión no respondió (${codigo}). Tu compra sigue abierta y nadie la rechazó. Vuelve a intentarlo en un momento.`,
      };
  }
}
