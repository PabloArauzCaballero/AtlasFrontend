/**
 * El globo con el que empieza el arranque.
 *
 * ## Que cuenta
 *
 * El mundo gira, frena y se queda mirando a Bolivia; un pulso marca el punto, y el globo entero se
 * recoge hacia el. De ese punto nace la «A». Es la respuesta a «¿de donde sale esta marca?» dicha
 * sin una palabra: de todo el mapa, aqui.
 *
 * ## De donde sale
 *
 * La idea y el mapa de tierras son de «Globe Study 04», de OriginKit (ver `globo-tierra.ts`). El
 * original es un `<canvas>` de navegador que escribe los continentes con letras y gira sin fin; aqui
 * no hay canvas, asi que es un port a `react-native-svg` y Reanimated:
 *
 * - **Puntos, no letras.** Mil `<Text>` de SVG por fotograma no los aguanta ningun telefono. Mil
 *   cuadraditos en UN trazado si: es una sola forma que el motor nativo rellena de una vez.
 * - **Tiempo fijo, no bucle.** El giro lee del reloj comun del arranque y termina. Un globo que gira
 *   solo para siempre es exactamente la decoracion que `atlas-movimiento` pide quitar.
 * - **Se calcula en el hilo de UI.** El trazado se reconstruye en un worklet en cada fotograma: el
 *   hilo de JS esta restaurando la sesion justo ahora, y cualquier cosa que dependiera de el tiraria.
 *
 * ## La nube de puntos
 *
 * Una espiral de Fibonacci reparte los puntos sobre la esfera con densidad uniforme —una rejilla de
 * latitud y longitud los amontona en los polos—. Cada punto cae en tierra o en mar segun el mapa; se
 * quedan todos los de tierra y uno de cada seis de mar, que es lo que da el punteado tenue de los
 * oceanos. Se calcula UNA vez, al cargar el modulo, en coordenadas cartesianas: por fotograma solo
 * queda girar, que son cuatro multiplicaciones por punto.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { palette } from '../theme/tokens';
import { frena, suave, tramo } from './curvas-arranque';
import { TIERRA_ALTO, TIERRA_ANCHO, TIERRA_B64 } from './globo-tierra';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Los tramos del reloj del arranque que le tocan al globo, en milisegundos. */
export type GuionGlobo = {
  /** Aparece: se enciende y se asienta desde un poco mas pequeno. */
  aparece: readonly [number, number];
  /** Gira frenando hasta quedarse de frente a Bolivia. */
  giro: readonly [number, number];
  /** El pulso sobre Bolivia. */
  pulso: readonly [number, number];
  /** Se recoge hacia el punto y desaparece. */
  recoge: readonly [number, number];
};

/** Lado del globo en pantalla. Mas grande que la marca: la «A» nace en su centro. */
export const GLOBO_PX = 250;

/** Lienzo del trazado. El radio deja margen para el pulso, que sale del centro y no del borde. */
const LIENZO = 200;
const CENTRO = LIENZO / 2;
const RADIO = 92;

/** Hacia donde mira el globo al final. Centro de Bolivia, redondeado. */
const BOLIVIA = { lat: -16.5, lon: -64.7 };
const GIRO_FINAL = (BOLIVIA.lon * -Math.PI) / 180;
const INCLINACION_FINAL = (BOLIVIA.lat * Math.PI) / 180;
/**
 * Cuanto gira antes de llegar: tres cuartos de vuelta y un poco.
 *
 * Menos no se lee como un giro sino como un ajuste; mas, con el tiempo que hay, pasa tan rapido que
 * los continentes se emborronan y el ojo no alcanza a reconocer ninguno.
 */
const GIRO_RECORRIDO = Math.PI * 1.3;
/** El globo llega un poco cabeceado y se endereza: sin esto el giro es un torno, no un planeta. */
const CABECEO = 0.38;

/** Base64 sin depender de `atob`, que no todos los motores de JS de React Native traen. */
function decodificar(b64: string): Uint8Array {
  const tabla = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const limpio = b64.replace(/=+$/, '');
  const salida = new Uint8Array(Math.floor((limpio.length * 3) / 4));
  let acumulado = 0;
  let bits = 0;
  let j = 0;
  for (let i = 0; i < limpio.length; i++) {
    acumulado = (acumulado << 6) | tabla.indexOf(limpio.charAt(i));
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      salida[j++] = (acumulado >> bits) & 0xff;
    }
  }
  return salida;
}

/** Los puntos, en triplas x,y,z sobre la esfera unidad. `z` apunta a la persona cuando la longitud es 0. */
const { TIERRA, MAR } = (() => {
  const mapa = decodificar(TIERRA_B64);
  const esTierra = (lon: number, lat: number) => {
    const gx = Math.floor(((lon + 180) / 360) * TIERRA_ANCHO);
    const gy = Math.floor(((90 - lat) / 180) * TIERRA_ALTO);
    if (gx < 0 || gx >= TIERRA_ANCHO || gy < 0 || gy >= TIERRA_ALTO) return false;
    const bit = gy * TIERRA_ANCHO + gx;
    return (((mapa[bit >> 3] ?? 0) >> (bit & 7)) & 1) === 1;
  };
  const PUNTOS = 5200;
  const aureo = Math.PI * (3 - Math.sqrt(5));
  const tierra: number[] = [];
  const mar: number[] = [];
  let enMar = 0;
  for (let i = 0; i < PUNTOS; i++) {
    const y = 1 - (2 * (i + 0.5)) / PUNTOS;
    const r = Math.sqrt(1 - y * y);
    const x = r * Math.sin(aureo * i);
    const z = r * Math.cos(aureo * i);
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (Math.atan2(x, z) * 180) / Math.PI;
    if (esTierra(lon, lat)) tierra.push(x, y, z);
    else if (enMar++ % 6 === 0) mar.push(x, y, z);
  }
  return { TIERRA: tierra, MAR: mar };
})();

/** Por debajo de esta profundidad un punto de tierra esta ya en el borde y se pinta apagado. */
const LIMBO = 0.45;

/** Cuadradito de lado `lado` centrado en (x, y), redondeado a una decima para no inflar el trazado. */
function cuadro(x: number, y: number, lado: number): string {
  'worklet';
  const m = lado / 2;
  return `M${Math.round((x - m) * 10) / 10} ${Math.round((y - m) * 10) / 10}h${lado}v${lado}h-${lado}z`;
}

export function GloboDeArranque({ reloj, guion }: { reloj: SharedValue<number>; guion: GuionGlobo }) {
  /*
    Los tres trazados, en un solo recorrido por fotograma.

    Fuera de su tramo el globo no se ve, y entonces no se calcula nada: el reloj del arranque sigue
    corriendo dos segundos mas despues de que el globo se recoja, y reconstruir mil puntos invisibles
    en cada uno de esos fotogramas es trabajo tirado justo en el golpe de la marca.
  */
  const trazados = useDerivedValue(() => {
    const t = reloj.value;
    if (t >= guion.recoge[1]) return { frente: 'M0 0', borde: 'M0 0', mar: 'M0 0' };

    const avance = frena(tramo(t, guion.giro[0], guion.giro[1]));
    const giro = GIRO_FINAL - GIRO_RECORRIDO * (1 - avance);
    const inclinacion = INCLINACION_FINAL + CABECEO * (1 - avance);
    const cg = Math.cos(giro);
    const sg = Math.sin(giro);
    const ci = Math.cos(inclinacion);
    const si = Math.sin(inclinacion);

    let frente = '';
    let borde = '';
    let mar = '';
    for (let i = 0; i < TIERRA.length; i += 3) {
      const px = TIERRA[i] ?? 0;
      const py = TIERRA[i + 1] ?? 0;
      const pz = TIERRA[i + 2] ?? 0;
      const x = px * cg + pz * sg;
      const z1 = -px * sg + pz * cg;
      const y = py * ci - z1 * si;
      const z = py * si + z1 * ci;
      if (z <= 0) continue;
      if (z > LIMBO) frente += cuadro(CENTRO + RADIO * x, CENTRO - RADIO * y, 2.4);
      else borde += cuadro(CENTRO + RADIO * x, CENTRO - RADIO * y, 2);
    }
    for (let i = 0; i < MAR.length; i += 3) {
      const px = MAR[i] ?? 0;
      const py = MAR[i + 1] ?? 0;
      const pz = MAR[i + 2] ?? 0;
      const x = px * cg + pz * sg;
      const z1 = -px * sg + pz * cg;
      const y = py * ci - z1 * si;
      const z = py * si + z1 * ci;
      if (z <= 0) continue;
      mar += cuadro(CENTRO + RADIO * x, CENTRO - RADIO * y, 1.2);
    }
    return { frente: frente || 'M0 0', borde: borde || 'M0 0', mar: mar || 'M0 0' };
  });

  const frenteProps = useAnimatedProps(() => ({ d: trazados.value.frente }));
  const bordeProps = useAnimatedProps(() => ({ d: trazados.value.borde }));
  const marProps = useAnimatedProps(() => ({ d: trazados.value.mar }));

  /**
   * El globo entero: se enciende asentandose, y al final se recoge hacia su centro.
   *
   * El recogerse arranca y llega suave, y ocupa el tramo entero: con una curva que acelera (cubica)
   * el globo seguia casi entero cuando la «A» ya empezaba a dibujarse encima, y las dos cosas se
   * pisaban. Asi, cuando nace la letra, del globo solo queda el punto hacia el que se recogio.
   */
  const capa = useAnimatedStyle(() => {
    const t = reloj.value;
    const entra = suave(tramo(t, guion.aparece[0], guion.aparece[1]));
    const asienta = frena(tramo(t, guion.aparece[0], guion.giro[1]));
    const recoge = suave(tramo(t, guion.recoge[0], guion.recoge[1]));
    return {
      opacity: entra * (1 - recoge),
      transform: [{ scale: (0.84 + asienta * 0.16) * (1 - recoge * 0.9) }],
    };
  });

  /** El pulso sobre Bolivia: un anillo que se abre y se apaga, y el punto que queda encendido. */
  const anilloProps = useAnimatedProps(() => {
    const p = tramo(reloj.value, guion.pulso[0], guion.pulso[1]);
    const abre = frena(p);
    return {
      r: 2 + abre * 16,
      opacity: 0.9 * (1 - p) * tramo(reloj.value, guion.pulso[0], guion.pulso[0] + 40),
    };
  });
  const puntoProps = useAnimatedProps(() => ({
    opacity: suave(tramo(reloj.value, guion.pulso[0], guion.pulso[0] + 120)),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.globo, capa]}>
      <Svg width={GLOBO_PX} height={GLOBO_PX} viewBox={`0 0 ${LIENZO} ${LIENZO}`}>
        <Defs>
          {/* El cuerpo del planeta: sin el, los puntos de mar flotan y no se lee una esfera. */}
          <RadialGradient id="globo-cuerpo" cx="42%" cy="38%" r="62%">
            <Stop offset="0" stopColor={palette.brand700} stopOpacity="0.32" />
            <Stop offset="0.7" stopColor={palette.brand900} stopOpacity="0.55" />
            <Stop offset="1" stopColor={palette.brand900} stopOpacity="0.2" />
          </RadialGradient>
        </Defs>
        <Circle cx={CENTRO} cy={CENTRO} r={RADIO} fill="url(#globo-cuerpo)" />
        <AnimatedPath d="M0 0" fill={palette.brand500} opacity={0.4} animatedProps={marProps} />
        <AnimatedPath d="M0 0" fill={palette.brand700} animatedProps={bordeProps} />
        <AnimatedPath d="M0 0" fill={palette.brand400} animatedProps={frenteProps} />
        {/* El filo: una linea finisima que cierra la esfera contra el navy. */}
        <Circle
          cx={CENTRO}
          cy={CENTRO}
          r={RADIO}
          fill="none"
          stroke={palette.brand500}
          strokeOpacity={0.3}
          strokeWidth={0.6}
        />
        {/* Con la inclinacion final, Bolivia cae exactamente en el centro del lienzo. */}
        <AnimatedCircle
          cx={CENTRO}
          cy={CENTRO}
          r={0}
          opacity={0}
          fill="none"
          stroke={palette.brand300}
          strokeWidth={1.2}
          animatedProps={anilloProps}
        />
        <AnimatedCircle cx={CENTRO} cy={CENTRO} r={2.6} opacity={0} fill={palette.brand300} animatedProps={puntoProps} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  globo: { position: 'absolute', width: GLOBO_PX, height: GLOBO_PX },
});
