/**
 * Marca ATLAS en movil.
 *
 * El logotipo se dibuja con SVG y el degradado de marca en vez de incrustar un PNG: escala sin
 * perder nitidez en cualquier densidad y no obliga a mantener seis tamanos del mismo archivo.
 * El degradado teal -> menta es el mismo de `AtlasLandingPage`.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color, palette, radius, space } from '../theme/tokens';
import { AtlasText, Overline } from './primitives';
import { webData } from '../web/estilo';

/**
 * Halo de marca: la atmosfera del fondo.
 *
 * ## Por que no es una `View` con `borderRadius`
 *
 * Lo era, y se veia. Un circulo de color plano al 16 % sobre el navy no es un resplandor: es un
 * CIRCULO, con su borde perfectamente definido, y en la pantalla de bienvenida se leian dos discos
 * verdes recortados detras del logotipo. El ojo detecta un borde duro incluso a opacidades muy
 * bajas —justo lo que un degradado difumina—, asi que el efecto conseguia lo contrario de lo que
 * buscaba: en vez de dar profundidad, aplanaba la pantalla contra dos formas geometricas.
 *
 * Un degradado radial que termina en alfa cero no tiene borde que detectar. Es la misma idea que
 * `radial-gradient()` en la web, que es como esta resuelto en `AtlasLandingPage`.
 *
 * ## Por que SVG y no `expo-linear-gradient`
 *
 * `LinearGradient` solo interpola en linea recta. Un halo es radial por definicion, y aproximarlo
 * con capas lineales deja bandas. `react-native-svg` ya es dependencia del proyecto —dibuja la
 * marca y todos los iconos—, asi que no anade peso.
 */
export function BrandHalo({ size, style }: { size: number; style?: ViewStyle }) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="atlas-halo" cx="50%" cy="50%" r="50%">
            {/*
              Tres paradas, no dos. Con solo centro y borde la caida es lineal y se ve el disco
              igual, solo que con el contorno emborronado; la parada intermedia al 45 % es la que
              concentra el color en el nucleo y deja que el resto se apague despacio.
            */}
            <Stop offset="0" stopColor={palette.brand400} stopOpacity="0.30" />
            <Stop offset="0.45" stopColor={palette.brand500} stopOpacity="0.12" />
            <Stop offset="1" stopColor={palette.brand500} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#atlas-halo)" />
      </Svg>
    </View>
  );
}

/**
 * La geometria de la «A», en unidades de un `viewBox` de 48 x 48. La leen la marca de aqui y la
 * secuencia de arranque (`splash.tsx`), que la dibuja por partes.
 *
 * La letra se parte por su eje en dos caras: la izquierda recibe la luz y la derecha queda en
 * sombra. Es lo que la saca del plano. Con un solo degradado era una silueta recortada en papel, y
 * junto al rotulo se leia como un icono de sistema, no como una marca.
 */
export const LETRA_A = {
  silueta: 'M24 5 L43 43 H34 L24 21 L14 43 H5 Z',
  caraLuz: 'M24 5 L24 21 L14 43 H5 Z',
  caraSombra: 'M24 5 L43 43 H34 L24 21 Z',
  travesano: 'M17.5 31 H30.5 L34 38 H14 Z',
  /** El filo que recibe la luz: el borde exterior de la cara izquierda. */
  filo: 'M5 43 L24 5',
  /** El canto superior del travesano. */
  cantoTravesano: 'M17.5 31 H30.5',
} as const;

/**
 * Los degradados de las caras. `prefijo` hace unicos los `id`: en la web todos los SVG comparten
 * documento, y dos degradados con el mismo `id` y distinto contenido se pisan.
 */
export function DegradadosLetraA({ prefijo }: { prefijo: string }) {
  return (
    <>
      <LinearGradient id={`${prefijo}-luz`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={palette.brand300} />
        <Stop offset="1" stopColor={palette.brand400} />
      </LinearGradient>
      <LinearGradient id={`${prefijo}-sombra`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={palette.brand500} />
        <Stop offset="1" stopColor={palette.brand700} />
      </LinearGradient>
      {/* El travesano cruza de la luz a la sombra, como las dos caras que une. */}
      <LinearGradient id={`${prefijo}-travesano`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={palette.brand400} />
        <Stop offset="0.5" stopColor={palette.brand500} />
        <Stop offset="1" stopColor={palette.brand700} />
      </LinearGradient>
    </>
  );
}

export function AtlasMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Logotipo de Atlas">
      <Defs>
        <DegradadosLetraA prefijo="atlas-marca" />
      </Defs>
      <Path d={LETRA_A.caraLuz} fill="url(#atlas-marca-luz)" />
      <Path d={LETRA_A.caraSombra} fill="url(#atlas-marca-sombra)" />
      <Path d={LETRA_A.travesano} fill="url(#atlas-marca-travesano)" />
      <Path d={LETRA_A.cantoTravesano} stroke={palette.brand300} strokeWidth={0.35} opacity={0.8} />
      <Path d={LETRA_A.filo} stroke={palette.white} strokeWidth={0.35} strokeLinecap="round" opacity={0.55} />
    </Svg>
  );
}

export function AtlasLogo({ size = 44, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View style={[styles.logo, style]} {...webData('marca-pantalla')}>
      <AtlasMark size={size} />
      <View style={styles.logoText}>
        {/*
          El logotipo va ABIERTO, no con el interletraje de un titular.

          Es la regla contraria a la del resto de la escala —donde los tamanos grandes se cierran—
          y es deliberada: cinco letras sueltas en caja alta no son un titulo, son una MARCA, y lo
          que hace que se lean como marca es el aire entre ellas. Con el -4,5 % de `h2`, «ATLAS» se
          leia como una palabra en mayusculas dentro de una frase.
        */}
        <AtlasText variant="h2" style={styles.wordmark}>
          ATLAS
        </AtlasText>
        <Overline tone="brand">Compra hoy, paga después</Overline>
      </View>
    </View>
  );
}

/**
 * Distintivo del origen de datos de compra.
 *
 * Se muestra siempre que la pantalla no este hablando con el backend real. Es una exigencia del
 * propio metodo de trabajo: nunca presentar datos simulados como si fueran de produccion.
 */
export function DataSourceBadge({ label = 'Entorno sandbox' }: { label?: string }) {
  return (
    <View style={styles.sandbox}>
      <View style={styles.sandboxDot} />
      <AtlasText variant="micro" tone="warning">
        {label}
      </AtlasText>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logoText: { gap: space.xxs },
  wordmark: { letterSpacing: 2.4 },
  sandbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.feedbackBorder.warning,
    backgroundColor: color.feedbackSoft.warning,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  sandboxDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.feedback.warning },
});
