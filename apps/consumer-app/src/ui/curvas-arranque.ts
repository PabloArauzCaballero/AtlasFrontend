/*
  Curvas de aceleracion del arranque, escritas a mano.

  No son `Easing.out(Easing.cubic)` porque en el arranque cada capa lee de un reloj COMUN y aplica su
  propia curva sobre su propio tramo; `withTiming` solo sabe curvar una animacion entera. Un reloj
  comun es lo que garantiza que el destello, la onda y el sonido caigan exactamente en el mismo
  fotograma: con seis animaciones independientes, cada una con su retardo, basta un fotograma perdido
  en el arranque para que el golpe visual y el sonoro se separen — y separados dejan de ser un golpe.

  Viven aparte porque las lee la secuencia de arranque (`splash.tsx`) y se prueban sin pantalla.
*/

/** Cuanto del tramo `[desde, hasta]` lleva recorrido el reloj, de 0 a 1. */
export function tramo(reloj: number, desde: number, hasta: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (reloj - desde) / (hasta - desde)));
}

export function frena(x: number): number {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
}

export function frenaMucho(x: number): number {
  'worklet';
  return 1 - Math.pow(1 - x, 5);
}

export function acelera(x: number): number {
  'worklet';
  return x * x * x;
}

export function suave(x: number): number {
  'worklet';
  return x * x * (3 - 2 * x);
}
