/**
 * El escudo de un NIVEL: lo que se enseña al subir de escalón, hermano de la medalla de las insignias.
 *
 * Mismo esmalte de marca (`theme/esmalte.ts`), distinta pieza: una insignia se GANA por algo que hiciste; el escudo es lo
 * que ERES. Lleva el icono del escalón arriba y el número de nivel grande al centro, que es lo que la persona quiere leer.
 *
 * 2026-10-15: fuera el metal de color por rango (Pablo: «más serio, con el mismo estilo de colores»). El número de nivel
 * ya dice cuán alto se está; el escudo no necesita además un color por tramo. El bloque «NIVEL · 4 · DE 12» termina en
 * y≈70 de 96, lejos de donde el interior se cierra hacia la punta.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { esmalte } from '../theme/esmalte';
import { esquema, fuente, luz } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { AtlasText } from './primitives';
import type { Rango } from './trofeo';

const ESCUDO = 'M48 5 L84 17 V47 C84 67 69 83 48 91 C27 83 12 67 12 47 V17 Z';
const INTERIOR = 'M48 12 L77 22 V47 C77 63 65 76 48 83 C31 76 19 63 19 47 V22 Z';
const ANILLOS = Array.from({ length: 13 }, (_, i) => 4 + i * 3.2);

export function EscudoDeNivel({
  rango,
  icono,
  numero,
  de,
  lado = 96,
  children,
}: {
  /** Se conserva por compatibilidad de quien llama; el escudo ya no cambia de color por rango. */
  rango: Rango;
  icono: IconName;
  numero: number;
  de: number;
  lado?: number;
  /** Capas de la escena (el barrido de luz) pintadas dentro del mismo SVG, sobre el esmalte. */
  children?: React.ReactNode;
}) {
  const k = lado / 96;
  const id = `esc-${rango}-${numero}-${lado}`;
  const claro = esquema === 'claro';
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={lado} height={lado} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={`${id}-m`} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={esmalte.aroLuz} />
            <Stop offset="0.45" stopColor={esmalte.caraAlta} />
            <Stop offset="1" stopColor={esmalte.aroSombra} />
          </LinearGradient>
          <LinearGradient id={`${id}-canto`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={luz.blanco} stopOpacity={0.45} />
            <Stop offset="0.45" stopColor={luz.blanco} stopOpacity={0} />
            <Stop offset="0.6" stopColor={luz.negro} stopOpacity={0} />
            <Stop offset="1" stopColor={luz.negro} stopOpacity={0.35} />
          </LinearGradient>
          <RadialGradient id={`${id}-i`} cx="44" cy="30" r="60" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={esmalte.caraAlta} />
            <Stop offset="0.55" stopColor={esmalte.cara} />
            <Stop offset="1" stopColor={esmalte.caraProfunda} />
          </RadialGradient>
          <RadialGradient id={`${id}-contacto`} cx="48" cy="92" r="26" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={luz.negro} stopOpacity={claro ? 0.18 : 0.45} />
            <Stop offset="1" stopColor={luz.negro} stopOpacity={0} />
          </RadialGradient>
          <ClipPath id={`${id}-dentro`}>
            <Path d={INTERIOR} />
          </ClipPath>
        </Defs>
        <Ellipse cx={48} cy={92} rx={24} ry={3.2} fill={`url(#${id}-contacto)`} />
        <Path d={ESCUDO} fill={`url(#${id}-m)`} />
        <Path d={ESCUDO} fill="none" stroke={`url(#${id}-canto)`} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d={INTERIOR} fill={`url(#${id}-i)`} stroke={esmalte.filete} strokeWidth={0.7} strokeOpacity={0.75} strokeLinejoin="round" />
        <G clipPath={`url(#${id}-dentro)`}>
          {ANILLOS.map((r) => (
            <Circle key={r} cx={48} cy={50} r={r} fill="none" stroke={esmalte.filete} strokeWidth={0.3} opacity={0.07} />
          ))}
        </G>
        {children}
      </Svg>
      <View style={[styles.icono, { top: 14 * k }]} pointerEvents="none">
        <Icon name={icono} size={15 * k} tint={esmalte.filete} />
      </View>
      <View style={[styles.numero, { top: 29 * k }]} pointerEvents="none">
        <AtlasText variant="micro" style={{ color: esmalte.filete, fontSize: 7 * k, lineHeight: 8 * k }}>
          NIVEL
        </AtlasText>
        <AtlasText
          variant="display"
          accessibilityElementsHidden
          style={{ color: esmalte.tinta.primaria, ...fuente('displayBlack'), fontSize: 25 * k, lineHeight: 26 * k, includeFontPadding: false }}
        >
          {numero}
        </AtlasText>
        <AtlasText variant="micro" style={{ color: esmalte.tinta.secundaria, fontSize: 7 * k, lineHeight: 8 * k }}>
          {`DE ${de}`}
        </AtlasText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  icono: { position: 'absolute', alignItems: 'center' },
  numero: { position: 'absolute', alignItems: 'center' },
});
