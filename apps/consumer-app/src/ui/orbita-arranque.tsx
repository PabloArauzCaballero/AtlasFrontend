/**
 * La orbita que rodea la «A» al final del arranque.
 *
 * ## Que cuenta
 *
 * El arranque empieza con el globo que frena en Bolivia y termina con la marca; la orbita cose las
 * dos puntas. Un punto da una vuelta alrededor de la letra, dejando la orbita dibujada detras de
 * si, y se queda quieto al final como un satelite: el mismo punto que marco Bolivia, ahora girando
 * alrededor de Atlas. Da una vuelta y se para. Un satelite que gira para siempre es exactamente la
 * decoracion que `atlas-movimiento` pide quitar.
 *
 * ## Delante y detras
 *
 * La orbita es una elipse inclinada que abraza la letra: la mitad de arriba pasa por DETRAS y la de
 * abajo por DELANTE. Por eso son dos componentes, `OrbitaDetras` y `OrbitaDelante`, que la secuencia
 * pinta antes y despues de la «A». Una sola elipse encima de todo se lee como un circulo tachando la
 * marca; partida en dos, se lee como algo que la rodea.
 *
 * ## Por que se reparte por longitud y no por angulo
 *
 * En una elipse tan achatada, recorrer el mismo angulo cuesta mucho mas camino arriba y abajo que en
 * los extremos. Si el punto avanzara por angulo y el trazo por longitud —que es lo que entiende
 * `strokeDashoffset`—, el punto se adelantaria al trazo en los extremos y se quedaria atras en el
 * centro. Aqui las dos cosas leen de la misma tabla de longitudes acumuladas, calculada una vez.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { color } from '../theme/tokens';
import { suave, tramo } from './curvas-arranque';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** El tramo del reloj del arranque en que el punto da la vuelta, en milisegundos. */
export type GuionOrbita = readonly [number, number];

/** Unidades del `viewBox` de la marca, y cuanto margen hace falta alrededor para que la orbita quepa. */
const UNIDADES = 48;
const MARGEN = 8;
const LIENZO = UNIDADES + MARGEN * 2;

/** La elipse, en unidades de la marca: centrada un poco por debajo del medio de la letra e inclinada. */
const CENTRO = { x: 24, y: 27 };
const RX = 26;
const RY = 7.5;
const GIRO = (-14 * Math.PI) / 180;

function sobreLaElipse(angulo: number): [number, number] {
  const x = RX * Math.cos(angulo);
  const y = RY * Math.sin(angulo);
  return [
    CENTRO.x + x * Math.cos(GIRO) - y * Math.sin(GIRO),
    CENTRO.y + x * Math.sin(GIRO) + y * Math.cos(GIRO),
  ];
}

/**
 * Una mitad de la elipse, muestreada de `desde` a `hasta`: puntos en pares x,y, su longitud acumulada
 * y el trazado. `sin(angulo) < 0` es la mitad de arriba, la que pasa por detras.
 */
function mitad(desde: number, hasta: number) {
  const MUESTRAS = 64;
  const puntos: number[] = [];
  const acumulado: number[] = [];
  let largo = 0;
  let previo: [number, number] | null = null;
  for (let i = 0; i <= MUESTRAS; i++) {
    const p = sobreLaElipse(desde + ((hasta - desde) * i) / MUESTRAS);
    if (previo) largo += Math.hypot(p[0] - previo[0], p[1] - previo[1]);
    puntos.push(p[0], p[1]);
    acumulado.push(largo);
    previo = p;
  }
  const d = puntos.reduce(
    (texto, valor, i) => texto + (i % 2 === 0 ? `${i === 0 ? 'M' : 'L'}${valor.toFixed(2)}` : ` ${valor.toFixed(2)}`),
    '',
  );
  return { puntos, acumulado, largo, d };
}

/** Empieza en el extremo derecho, pasa por detras hacia la izquierda y vuelve por delante al mismo punto. */
const DETRAS = mitad(2 * Math.PI, Math.PI);
const DELANTE = mitad(Math.PI, 0);
const TOTAL = DETRAS.largo + DELANTE.largo;

/** Donde esta el punto cuando lleva recorrido `camino` de su mitad. */
function puntoEn(puntos: readonly number[], acumulado: readonly number[], camino: number): [number, number] {
  'worklet';
  for (let i = 1; i < acumulado.length; i++) {
    const hasta = acumulado[i] ?? 0;
    if (hasta >= camino) {
      const desde = acumulado[i - 1] ?? 0;
      const f = hasta > desde ? (camino - desde) / (hasta - desde) : 0;
      const x0 = puntos[(i - 1) * 2] ?? 0;
      const y0 = puntos[(i - 1) * 2 + 1] ?? 0;
      return [x0 + ((puntos[i * 2] ?? 0) - x0) * f, y0 + ((puntos[i * 2 + 1] ?? 0) - y0) * f];
    }
  }
  return [puntos[puntos.length - 2] ?? 0, puntos[puntos.length - 1] ?? 0];
}

type Props = { reloj: SharedValue<number>; guion: GuionOrbita; tamano: number };

function Lienzo({ tamano, children }: { tamano: number; children: React.ReactNode }) {
  const lado = (tamano * LIENZO) / UNIDADES;
  const desplazamiento = (-tamano * MARGEN) / UNIDADES;
  return (
    <Svg
      pointerEvents="none"
      width={lado}
      height={lado}
      viewBox={`${-MARGEN} ${-MARGEN} ${LIENZO} ${LIENZO}`}
      style={[styles.lienzo, { left: desplazamiento, top: desplazamiento }]}
    >
      {children}
    </Svg>
  );
}

/** La mitad de arriba y el punto mientras la recorre. Va ANTES de la letra. */
export function OrbitaDetras({ reloj, guion, tamano }: Props) {
  const trazoProps = useAnimatedProps(() => {
    const camino = suave(tramo(reloj.value, guion[0], guion[1])) * TOTAL;
    return { strokeDashoffset: DETRAS.largo - Math.min(camino, DETRAS.largo) };
  });
  const puntoProps = useAnimatedProps(() => {
    const camino = suave(tramo(reloj.value, guion[0], guion[1])) * TOTAL;
    const [cx, cy] = puntoEn(DETRAS.puntos, DETRAS.acumulado, Math.min(camino, DETRAS.largo));
    const encendido = tramo(reloj.value, guion[0], guion[0] + 80);
    return { cx, cy, opacity: camino < DETRAS.largo ? 0.6 * encendido : 0 };
  });
  return (
    <Lienzo tamano={tamano}>
      <AnimatedPath
        d={DETRAS.d}
        fill="none"
        stroke={color.stage.brand.b300}
        strokeOpacity={0.4}
        strokeWidth={0.45}
        strokeDasharray={DETRAS.largo}
        strokeDashoffset={DETRAS.largo}
        animatedProps={trazoProps}
      />
      <AnimatedCircle r={0.95} opacity={0} fill={color.stage.brand.b300} animatedProps={puntoProps} />
    </Lienzo>
  );
}

/** La mitad de abajo y el punto desde que la alcanza hasta que se para. Va DESPUES de la letra. */
export function OrbitaDelante({ reloj, guion, tamano }: Props) {
  const trazoProps = useAnimatedProps(() => {
    const camino = suave(tramo(reloj.value, guion[0], guion[1])) * TOTAL;
    const recorrido = Math.min(Math.max(camino - DETRAS.largo, 0), DELANTE.largo);
    return { strokeDashoffset: DELANTE.largo - recorrido };
  });
  const puntoProps = useAnimatedProps(() => {
    const camino = suave(tramo(reloj.value, guion[0], guion[1])) * TOTAL;
    const recorrido = Math.min(Math.max(camino - DETRAS.largo, 0), DELANTE.largo);
    const [cx, cy] = puntoEn(DELANTE.puntos, DELANTE.acumulado, recorrido);
    return { cx, cy, opacity: camino >= DETRAS.largo ? 1 : 0 };
  });
  return (
    <Lienzo tamano={tamano}>
      <AnimatedPath
        d={DELANTE.d}
        fill="none"
        stroke={color.stage.brand.b300}
        strokeOpacity={0.85}
        strokeWidth={0.55}
        strokeLinecap="round"
        strokeDasharray={DELANTE.largo}
        strokeDashoffset={DELANTE.largo}
        animatedProps={trazoProps}
      />
      <AnimatedCircle r={1.15} opacity={0} fill={color.stage.brand.b300} animatedProps={puntoProps} />
    </Lienzo>
  );
}

const styles = StyleSheet.create({
  lienzo: { position: 'absolute' },
});
