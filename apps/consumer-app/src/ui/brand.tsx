/**
 * Marca ATLAS en movil.
 *
 * El logotipo se dibuja con SVG y el degradado de marca en vez de incrustar un PNG: escala sin
 * perder nitidez en cualquier densidad y no obliga a mantener seis tamanos del mismo archivo.
 * El degradado teal -> menta es el mismo de `AtlasLandingPage`.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color, space } from '../theme/tokens';
import { AtlasText, Overline } from './primitives';
import { webData } from '../web/estilo';
import { DegradadosLetraA, LETRA_A } from './marca-letra';

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
            <Stop offset="0" stopColor={color.brand.b400} stopOpacity="0.30" />
            <Stop offset="0.45" stopColor={color.brand.b500} stopOpacity="0.12" />
            <Stop offset="1" stopColor={color.brand.b500} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#atlas-halo)" />
      </Svg>
    </View>
  );
}

export { DegradadosLetraA, LETRA_A } from './marca-letra';

export function AtlasMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Logotipo de Atlas">
      <Defs>
        <DegradadosLetraA prefijo="atlas-marca" />
      </Defs>
      <Path d={LETRA_A.caraLuz} fill="url(#atlas-marca-luz)" />
      <Path d={LETRA_A.caraSombra} fill="url(#atlas-marca-sombra)" />
      <Path d={LETRA_A.travesano} fill="url(#atlas-marca-travesano)" />
      <Path d={LETRA_A.cantoTravesano} stroke={color.brand.b300} strokeWidth={0.35} opacity={0.8} />
      <Path d={LETRA_A.filo} stroke={color.fixed.white} strokeWidth={0.35} strokeLinecap="round" opacity={0.55} />
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

const styles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logoText: { gap: space.xxs },
  wordmark: { letterSpacing: 2.4 },
});
