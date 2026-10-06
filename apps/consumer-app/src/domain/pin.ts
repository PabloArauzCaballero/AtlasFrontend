/**
 * Que le pasa a este PIN, dicho como se lo dirias a la persona.
 *
 * La lista de prohibidos es la MISMA que valida el servidor (`isCustomerPinValid` en AtlasBackend).
 * Se repite aqui a proposito: que el telefono lo diga al teclear evita un viaje de ida y vuelta para
 * enterarse de que `1234` no vale, y el servidor sigue siendo quien manda —esto es comodidad, no
 * control.
 *
 * Vive aqui y no en una pantalla porque lo usan dos: el registro, que fija el primer PIN, y la
 * recuperacion, que fija el siguiente. Con dos copias, la del dia que se separen dejaria pasar en
 * una pantalla lo que la otra rechaza.
 */
const PIN_PROHIBIDOS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '2345', '3456', '4567', '5678', '6789', '7890',
  '4321', '5432', '6543', '7654', '8765', '9876', '0987',
  '1212', '1122', '1004', '2000', '6969', '1313', '2001', '1010',
]);

export function pinProblem(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'Tu PIN debe ser de 4 dígitos.';
  if (PIN_PROHIBIDOS.has(pin)) return 'Ese PIN es demasiado fácil de adivinar. Elige otro.';
  return null;
}
