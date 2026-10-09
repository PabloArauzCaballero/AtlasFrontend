/**
 * Los motivos de rechazo de las tres colas de Gestión POS, copiados LITERALES de la web.
 *
 * Son tres listas y no una porque la web tiene tres, y no por capricho: cada una la lee alguien
 * distinto. El motivo de una solicitud queda para auditoría (por qué se rechazó lo que el motor
 * aprobó); el de un comprobante y el de un pago inicial los lee el CLIENTE en su app.
 *
 * Ojo con los valores: en solicitudes y comprobantes viajan CÓDIGOS (`SIN_STOCK`), y en el pago
 * inicial viaja la FRASE entera, porque así lo manda la web (`MerchantDownPaymentsPanel`) y así lo
 * guarda el backend para enseñárselo al cliente. Unificarlos aquí cambiaría lo que ve el cliente.
 *
 * La opción vacía de la web («— Elija el motivo —») no está en la lista: en la app es el
 * `placeholder` del selector, que es lo que se ve mientras no se ha elegido nada.
 */
import type { OpcionSelect } from '@cliente/ui/form-controls';

export const ELIJA_EL_MOTIVO = '— Elija el motivo —';

/** `MerchantRequestsScreen`: rechazar una compra que el motor aprobó (`reasonCode`). */
export const MOTIVOS_SOLICITUD: OpcionSelect[] = [
  { etiqueta: 'El cliente se arrepintió', valor: 'CLIENTE_DESISTIO' },
  { etiqueta: 'No tengo el producto disponible', valor: 'SIN_STOCK' },
  { etiqueta: 'El importe no corresponde a esta venta', valor: 'IMPORTE_NO_CORRESPONDE' },
  { etiqueta: 'Sospecha de suplantación', valor: 'SOSPECHA_IDENTIDAD' },
  { etiqueta: 'Otro', valor: 'OTRO' },
];

/** `MerchantPaymentProofsScreen`: rechazar el comprobante de una cuota (`reason`). */
export const MOTIVOS_COMPROBANTE: OpcionSelect[] = [
  { etiqueta: 'No encuentro la transferencia en mi cuenta', valor: 'NO_APARECE_EN_CUENTA' },
  { etiqueta: 'El importe no coincide', valor: 'IMPORTE_NO_COINCIDE' },
  { etiqueta: 'El comprobante no se lee o no corresponde', valor: 'COMPROBANTE_ILEGIBLE' },
  { etiqueta: 'La transferencia es de otra operación', valor: 'OTRA_OPERACION' },
  { etiqueta: 'Otro', valor: 'OTRO' },
];

/** `MerchantDownPaymentsPanel`: rechazar un pago inicial (`reason` = la frase; sin «Otro», como en la web). */
export const MOTIVOS_PAGO_INICIAL: OpcionSelect[] = [
  'No encuentro la transferencia en mi cuenta',
  'El importe no coincide',
  'El comprobante no se lee o no corresponde',
  'La transferencia es de otra operación',
].map((frase) => ({ etiqueta: frase, valor: frase }));
