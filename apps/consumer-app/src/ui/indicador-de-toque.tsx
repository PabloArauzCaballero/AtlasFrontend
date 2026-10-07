/**
 * «Toca aquí»: una mano renderizada que baja sobre el botón y lanza ondas de luz desde la punta del dedo.
 *
 * Pablo (2026-10-07), sobre la pantalla de permisos: «que se ponga una figura renderizada ultra estética de adónde debe
 * darle clic». Contesta la pregunta que se hace quien ve la pantalla por primera vez —«¿qué toco?»— señalando EL botón que
 * continúa el flujo, no uno cualquiera de los dos.
 *
 * ## Cómo está hecha
 *
 * Vectores (`SvgXml`), con degradados y brillos: un puntero de mano con volumen, no un icono plano. Nítida a cualquier
 * densidad y de unos pocos KB. La punta del índice cae sobre el borde del botón y de ella nacen dos anillos que se abren y se
 * apagan, como el eco de un toque.
 *
 * ## Cómo se mueve
 *
 * Una sola fase de 0 a 1 gobierna TODO: la mano baja (`golpeDelDedo`) y, justo cuando llega abajo, nacen las ondas
 * (`ondaDelToque`). Con dos temporizadores distintos el dedo y las ondas acabarían descompasados; con una fase no hay manera.
 * Sólo `transform` y `opacity`, en el hilo de UI.
 *
 * Con movimiento reducido (y en la web y en las pruebas, como el brillo del botón: `autonomia`) queda QUIETA: la figura sigue
 * señalando el botón, sin moverse. Es decorativa para el lector de pantalla —el botón ya se anuncia solo—.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { palette } from '../theme/tokens';
import { autonomia } from './button-shine';

/** Un toque completo: baja, ondas y descanso. */
export const CICLO_TOQUE_MS = 2200;
/** Lo que baja la mano al «tocar», en puntos. */
export const RECORRIDO = 9;
/** Tamaño de la mano. */
const ANCHO = 56;
const ALTO = 74;
/** Diámetro máximo de una onda. */
const ONDA = 64;

/**
 * Cuánto ha bajado la mano para una fase `p` de 0 a 1: 0 arriba, 1 tocando.
 *
 * Baja rápido (primer 14 %), se queda un instante y sube despacio; el resto del ciclo descansa arriba. Continua: arranca y
 * termina en 0. Aparte y con `'worklet'` para poder probarla sin montar nada.
 */
export function golpeDelDedo(p: number): number {
  'worklet';
  if (p < 0.14) {
    const t = p / 0.14;
    return t * t * (3 - 2 * t);
  }
  if (p < 0.2) return 1;
  if (p < 0.45) {
    const t = (p - 0.2) / 0.25;
    return 1 - t * t * (3 - 2 * t);
  }
  return 0;
}

/**
 * Cuánto ha avanzado una onda (0 → 1) para la fase `p`, o `-1` si todavía no ha nacido o ya acabó.
 *
 * Nace cuando la mano llega abajo (`p ≈ 0.14`) más su `retardo`, y dura el 55 % del ciclo.
 */
export function ondaDelToque(p: number, retardo: number): number {
  'worklet';
  const t = (p - 0.14 - retardo) / 0.55;
  if (t < 0 || t > 1) return -1;
  return t;
}

/** La mano, apuntando hacia abajo, con su anillo de luz en la punta. Sin fondo: va sobre lo que haya. */
export const MANO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 84">
<defs>
  <linearGradient id="itcu" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#E6FAF2"/><stop offset="1" stop-color="#9ADBC4"/></linearGradient>
  <linearGradient id="itde" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A9E2CF"/><stop offset="0.45" stop-color="#FFFFFF"/><stop offset="1" stop-color="#9FDCC6"/></linearGradient>
  <linearGradient id="itdp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#B7EAD8"/></linearGradient>
  <radialGradient id="itpo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${palette.brand400}" stop-opacity="0.75"/><stop offset="1" stop-color="${palette.brand400}" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="29" cy="76" rx="18" ry="6.5" fill="url(#itpo)"/>
<ellipse cx="29" cy="76" rx="9.5" ry="3.2" fill="none" stroke="${palette.brand300}" stroke-opacity="0.85" stroke-width="0.8"/>
<g transform="translate(0 80) scale(1 -1)">
  <g opacity="0.16" transform="translate(1.4 -1.6)"><rect x="14" y="30" width="44" height="34" rx="13" fill="#000"/><rect x="22" y="2" width="12" height="40" rx="6" fill="#000"/></g>
  <rect x="14" y="30" width="44" height="34" rx="13" fill="url(#itcu)" stroke="#fff" stroke-opacity="0.9" stroke-width="0.7"/>
  <rect x="34" y="20" width="8.4" height="22" rx="4.2" fill="url(#itdp)" stroke="#fff" stroke-opacity="0.9" stroke-width="0.6"/>
  <rect x="42.2" y="22.5" width="8.4" height="20" rx="4.2" fill="url(#itdp)" stroke="#fff" stroke-opacity="0.9" stroke-width="0.6"/>
  <rect x="50.4" y="26" width="7.6" height="17" rx="3.8" fill="url(#itdp)" stroke="#fff" stroke-opacity="0.9" stroke-width="0.6"/>
  <path d="M36 27 L36 36 M44.2 28.6 L44.2 37 M52.2 31 L52.2 38" stroke="#8CD3BA" stroke-opacity="0.55" stroke-width="0.8" stroke-linecap="round"/>
  <rect x="22" y="2" width="12.6" height="46" rx="6.3" fill="url(#itde)" stroke="#fff" stroke-opacity="0.95" stroke-width="0.7"/>
  <path d="M25.4 8 L25.4 42" stroke="#fff" stroke-opacity="0.9" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M31.8 12 L31.8 44" stroke="#8CD3BA" stroke-opacity="0.5" stroke-width="1" stroke-linecap="round"/>
  <path d="M23.4 24 C26 25.4 30.6 25.4 33.2 24" fill="none" stroke="#8CD3BA" stroke-width="0.6" stroke-linecap="round" opacity="0.7"/>
  <ellipse cx="26.4" cy="8" rx="2.2" ry="2.8" fill="#fff" opacity="0.75"/>
  <path d="M15.4 46 C8.6 45 5.6 50.6 8.8 57 C11.2 61.4 15.6 62.4 21 60 L21 48 Z" fill="url(#itcu)" stroke="#fff" stroke-opacity="0.9" stroke-width="0.6"/>
  <path d="M11 50.6 C9.4 53 9.8 56.4 11.6 58.6" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M26 61 C34 63 48 62.6 54 59 C52 63 48 63.4 40 63.4 L28 63.4 C26.6 63.4 25.6 62.4 26 61 Z" fill="#fff" opacity="0.7"/>
</g>
</svg>`;

/** Un anillo que nace en la punta del dedo, se abre y se apaga. */
function Onda({ fase, retardo }: { fase: SharedValue<number>; retardo: number }) {
  const estilo = useAnimatedStyle(() => {
    const t = ondaDelToque(fase.value, retardo);
    if (t < 0) return { opacity: 0, transform: [{ scale: 0.3 }] };
    return { opacity: 0.75 * (1 - t) * (1 - t), transform: [{ scale: 0.3 + t * 1.0 }] };
  });
  return <Animated.View pointerEvents="none" style={[styles.onda, estilo]} />;
}

export function IndicadorDeToque({ testID = 'indicador-de-toque' }: { testID?: string }) {
  const reducido = useReducedMotion();
  const viva = autonomia.activa && !reducido;
  const fase = useSharedValue(0);

  React.useEffect(() => {
    if (!viva) {
      cancelAnimation(fase);
      fase.value = 0;
      return;
    }
    fase.value = 0;
    fase.value = withRepeat(withTiming(1, { duration: CICLO_TOQUE_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(fase);
  }, [fase, viva]);

  const mano = useAnimatedStyle(() => ({ transform: [{ translateY: golpeDelDedo(fase.value) * RECORRIDO }] }));

  return (
    <View
      style={styles.caja}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {viva ? (
        <>
          <Onda fase={fase} retardo={0} />
          <Onda fase={fase} retardo={0.16} />
        </>
      ) : null}
      <Animated.View style={mano}>
        <SvgXml xml={MANO_SVG} width={ANCHO} height={ALTO} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // La punta del índice cae sobre el borde del botón: la caja mide lo justo para que la mano baje 9 pt sobre él.
  caja: { alignSelf: 'center', width: ANCHO + 24, height: ALTO - RECORRIDO, alignItems: 'center', justifyContent: 'flex-start' },
  // El anillo se centra en la punta del dedo (a 44 % del ancho de la mano, abajo del todo).
  onda: {
    position: 'absolute',
    bottom: -ONDA / 2 + 6,
    width: ONDA,
    height: ONDA,
    borderRadius: ONDA / 2,
    borderWidth: 1.6,
    borderColor: palette.brand400,
    left: (ANCHO + 24) / 2 - ONDA / 2 - 3,
  },
});
