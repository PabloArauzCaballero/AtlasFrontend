/**
 * El escudo de un NIVEL: lo que se enseña al subir de escalón, hermano del trofeo de las insignias.
 *
 * Mismo metal por rango (`METAL`), distinta pieza: un trofeo se GANA por algo que hiciste; un escudo es lo que ERES.
 * Lleva el icono del escalón arriba y el número de nivel grande al centro, que es lo que la persona quiere leer.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { fuente, luz, objeto } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { AtlasText } from './primitives';
import { METAL, type Rango } from './trofeo';

const ESCUDO = 'M48 5 L84 17 V47 C84 67 69 83 48 91 C27 83 12 67 12 47 V17 Z';
const INTERIOR = 'M48 12 L77 22 V47 C77 63 65 76 48 83 C31 76 19 63 19 47 V22 Z';

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
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={lado} height={lado} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={m.luz} />
            <Stop offset="0.45" stopColor={m.medio} />
            <Stop offset="1" stopColor={m.sombra} />
          </LinearGradient>
          <LinearGradient id={`${id}-i`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={m.tinta} stopOpacity={0.92} />
            <Stop offset="1" stopColor={objeto.escudoInterior} stopOpacity={0.98} />
          </LinearGradient>
          <RadialGradient id={`${id}-h`} cx="48" cy="46" r="52" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={m.halo} stopOpacity={0.5} />
            <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={48} cy={46} r={52} fill={`url(#${id}-h)`} />
        <Path d={ESCUDO} fill={`url(#${id}-m)`} stroke={m.luz} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d={INTERIOR} fill={`url(#${id}-i)`} stroke={m.medio} strokeWidth={1} strokeLinejoin="round" />
        <Path d="M48 12 L77 22 V30 C62 27 54 20 48 12 Z" fill={luz.blanco} opacity={0.14} />
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
