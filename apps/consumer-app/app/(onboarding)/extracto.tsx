/**
 * Último paso del alta: el estado de cuenta de los últimos meses.
 *
 * Es el pedido de mayor fricción y confianza de toda la lista, por eso va al final y no bloquea el
 * envío. Lo lee el worker de extractos del Motor, que clasifica los movimientos y deja guardada la
 * capacidad de pago (`bank_statement_reviews`) que usa la línea. Ver `pantalla-extracto.tsx`.
 */
import { PantallaExtracto } from '../../src/features/onboarding/pantalla-extracto';

export default function ExtractoDelAlta() {
  return <PantallaExtracto enAlta />;
}
