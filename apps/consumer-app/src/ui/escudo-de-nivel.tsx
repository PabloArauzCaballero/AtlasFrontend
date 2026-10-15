/**
 * El escudo de un NIVEL: lo que se enseña al subir de escalón, hermano del trofeo de las insignias.
 *
 * Mismo metal por rango (`METAL`), distinta pieza: un trofeo se GANA por algo que hiciste; un escudo es lo que ERES.
 * Lleva el icono del escalón arriba y el número de nivel grande al centro, que es lo que la persona quiere leer.
 *
 * Mismo oficio que `medalla.tsx` (2026-10-15): sombra de contacto, canto con luz y sombra, grabado guilloché en el
 * interior y un reflejo suave recortado a la silueta.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { esquema, fuente, luz, objeto } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { AtlasText } from './primitives';
import { METAL, type Rango } from './trofeo';

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
  rango: Rango;
  icono: IconName;
  numero: number;
  de: number;
  lado?: number;
  /** Capas de la escena (el barrido de luz) pintadas dentro del mismo SVG, sobre el metal. */
  children?: React.ReactNode;
}) {
  const m = METAL[rango];
  const k = lado / 96;
  const id = `esc-${rango}-${numero}-${lado}`;
  const claro = esquema === 'claro';
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={lado} height={lado} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={m.luz} />
            <Stop offset="0.35" stopColor={m.medio} />
            <Stop offset="0.65" stopColor={m.sombra} />
            <Stop offset="0.85" stopColor={m.medio} />
            <Stop offset="1" stopColor={m.sombra} />
          </LinearGradient>
          <LinearGradient id={`${id}-canto`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={luz.blanco} stopOpacity={0.95} />
            <Stop offset="0.45" stopColor={luz.blanco} stopOpacity={0} />
            <Stop offset="0.6" stopColor={luz.negro} stopOpacity={0} />
            <Stop offset="1" stopColor={luz.negro} stopOpacity={0.45} />
          </LinearGradient>
          <LinearGradient id={`${id}-reflejo`} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={luz.blanco} stopOpacity={0.45} />
            <Stop offset="1" stopColor={luz.blanco} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id={`${id}-contacto`} cx="48" cy="92" r="26" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={luz.negro} stopOpacity={claro ? 0.22 : 0.5} />
            <Stop offset="1" stopColor={luz.negro} stopOpacity={0} />
          </RadialGradient>
          <ClipPath id={`${id}-dentro`}>
            <Path d={INTERIOR} />
          </ClipPath>
          <ClipPath id={`${id}-silueta`}>
            <Path d={ESCUDO} />
          </ClipPath>
          <LinearGradient id={`${id}-i`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={m.tinta} stopOpacity={0.92} />
            <Stop offset="1" stopColor={objeto.escudoInterior} stopOpacity={0.98} />
          </LinearGradient>
          <RadialGradient id={`${id}-h`} cx="48" cy="46" r="52" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={m.halo} stopOpacity={claro ? 0.32 : 0.5} />
            <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={48} cy={92} rx={26} ry={3.6} fill={`url(#${id}-contacto)`} />
        <Circle cx={48} cy={46} r={52} fill={`url(#${id}-h)`} />
        <Path d={ESCUDO} fill={`url(#${id}-m)`} />
        <Path d={ESCUDO} fill="none" stroke={`url(#${id}-canto)`} strokeWidth={1.4} strokeLinejoin="round" />
        <Path d={INTERIOR} fill={`url(#${id}-i)`} stroke={m.medio} strokeWidth={1} strokeLinejoin="round" />
        <G clipPath={`url(#${id}-dentro)`}>
          {ANILLOS.map((r) => (
            <Circle key={r} cx={48} cy={50} r={r} fill="none" stroke={m.luz} strokeWidth={0.35} opacity={0.12} />
          ))}
        </G>
        <G clipPath={`url(#${id}-silueta)`}>
          <Ellipse cx={32} cy={20} rx={28} ry={12} fill={`url(#${id}-reflejo)`} transform="rotate(-24 32 20)" />
        </G>
        {children}
      </Svg>
      <View style={[styles.icono, { top: 12 * k }]} pointerEvents="none">
        <Icon name={icono} size={18 * k} tint={m.luz} />
      </View>
      <View style={[styles.numero, { top: 30 * k }]} pointerEvents="none">
        <AtlasText variant="micro" tone="secondary" style={{ color: m.luz, fontSize: 8 * k, lineHeight: 10 * k }}>
          NIVEL
        </AtlasText>
        <AtlasText
          variant="display"
          accessibilityElementsHidden
          style={{ color: luz.blanco, ...fuente('displayBlack'), fontSize: 28 * k, lineHeight: 30 * k, includeFontPadding: false }}
        >
          {numero}
        </AtlasText>
        <AtlasText variant="micro" tone="secondary" style={{ color: m.medio, fontSize: 8 * k, lineHeight: 10 * k }}>
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
