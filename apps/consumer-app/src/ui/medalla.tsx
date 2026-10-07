/**
 * La insignia: una medalla-escudo de metal. Sustituye a la copa (`trofeo.tsx`) como dibujo del logro (Pablo,
 * 2026-10-07: «mejor como una insignia que un trofeo, ultra HD, como una carta legendaria»).
 *
 * Es SVG: nítida a cualquier tamaño —96 px en la vitrina, 190 en la carta, 250 en la celebración—. Capas, de fuera a dentro:
 * halo del metal, aro biselado (gradiente diagonal), cara hundida con su propio degradado, filo interior, brillo
 * especular y tantas gemas como escalón del rango (una en bronce, cinco en diamante). El icono del logro va en el centro.
 *
 * Sin ganar: la misma silueta en grafito con la cara que se llena de metal según el avance. El METAL de cada rango sigue
 * viviendo en `trofeo.tsx` (lo usan también el nivel y las celebraciones).
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color, palette, stroke } from '../theme/tokens';
import { Icon } from './icons';
import { iconoDe, METAL, type Rango } from './trofeo';

const LADO = 96;

/** El escudo: hombros rectos, flancos que se cierran en punta. Un solo trazo para el aro, la cara y el recorte del brillo. */
const ESCUDO = 'M48 8 L80 19 V45 C80 63 66 77 48 87 C30 77 16 63 16 45 V19 Z';
const CARA = 'M48 14 L74 23 V45 C74 59 62 71 48 79 C34 71 22 59 22 45 V23 Z';
/** El recorte de un barrido de luz: la silueta entera del escudo. */
export const SILUETA_MEDALLA = ESCUDO;
/** Brillo especular: una faja diagonal que cruza el aro de arriba a la izquierda. */
const BRILLO = 'M16 19 L48 8 L48 14 L22 23 V40 C19 35 16 28 16 19 Z';

const GEMAS = { bronce: 1, plata: 2, oro: 3, platino: 4, diamante: 5 } as const;

export function Medalla({
  codigo,
  rango,
  icono,
  ganado,
  avance = 0,
  lado = LADO,
  children,
}: {
  codigo: string;
  rango: Rango;
  icono: string;
  ganado: boolean;
  /** 0-1: cuánto de la cara se llena, sólo en una insignia sin ganar. */
  avance?: number;
  lado?: number;
  /** Capas propias de la escena (el barrido de luz) pintadas DENTRO del mismo SVG, sobre el metal. */
  children?: React.ReactNode;
}) {
  const m = METAL[rango];
  const id = `md-${codigo}-${lado}`;
  const k = lado / LADO;
  const gemas = GEMAS[rango];
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={lado} height={lado} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={`${id}-aro`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={m.luz} />
            <Stop offset="0.38" stopColor={m.medio} />
            <Stop offset="0.62" stopColor={m.sombra} />
            <Stop offset="1" stopColor={m.medio} />
          </LinearGradient>
          <LinearGradient id={`${id}-bisel`} x1="1" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={m.luz} stopOpacity={0.9} />
            <Stop offset="0.5" stopColor={m.sombra} stopOpacity={0.9} />
            <Stop offset="1" stopColor={m.medio} stopOpacity={0.9} />
          </LinearGradient>
          <RadialGradient id={`${id}-cara`} cx="48" cy="38" r="44" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={m.medio} stopOpacity={0.55} />
            <Stop offset="0.55" stopColor={m.tinta} stopOpacity={1} />
            <Stop offset="1" stopColor="#050B16" stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id={`${id}-halo`} cx="48" cy="46" r="48" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={m.halo} stopOpacity={0.5} />
            <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
          </RadialGradient>
          <ClipPath id={`${id}-corte`}>
            <Path d={CARA} />
          </ClipPath>
          <LinearGradient id={`${id}-vidrio`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {ganado ? (
          <>
            <Circle cx={48} cy={46} r={48} fill={`url(#${id}-halo)`} />
            {/* El aro: el escudo entero en metal, y encima un bisel invertido un punto más adentro. */}
            <Path d={ESCUDO} fill={`url(#${id}-aro)`} stroke={m.sombra} strokeWidth={0.8} strokeLinejoin="round" />
            <Path d={CARA} fill={`url(#${id}-bisel)`} transform="translate(0 0.4)" />
            <G transform="translate(48 46) scale(0.9) translate(-48 -46)">
              <Path d={CARA} fill={`url(#${id}-cara)`} />
            </G>
            <G transform="translate(48 46) scale(0.9) translate(-48 -46)">
              <Path d={CARA} fill="none" stroke={m.luz} strokeWidth={0.8} opacity={0.75} />
            </G>
            {/* Brillo de vidrio en la mitad alta de la cara y faja especular en el aro. */}
            <Path d="M22 23 L48 14 L74 23 V38 C62 33 34 33 22 38 Z" fill={`url(#${id}-vidrio)`} opacity={0.5} />
            <Path d={BRILLO} fill="#FFFFFF" opacity={0.4} />
            {/* Las gemas del rango, centradas bajo el icono. */}
            {Array.from({ length: gemas }, (_, g) => {
              const x = 48 + (g - (gemas - 1) / 2) * 7;
              return <Path key={g} d={`M${x} 66 l2.6 3 -2.6 3.4 -2.6 -3.4 Z`} fill={m.luz} stroke={m.sombra} strokeWidth={0.4} />;
            })}
            <Path d="M82 6 l1.6 4.2 4.2 1.6 -4.2 1.6 -1.6 4.2 -1.6 -4.2 -4.2 -1.6 4.2 -1.6 Z" fill="#FFFFFF" opacity={0.95} />
            <Path d="M10 56 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1 Z" fill="#FFFFFF" opacity={0.7} />
            {children}
          </>
        ) : (
          <>
            <Path d={ESCUDO} fill={palette.bgElevated} stroke={palette.line2} strokeWidth={1.5} strokeLinejoin="round" />
            <G transform="translate(48 46) scale(0.88) translate(-48 -46)">
              <Path d={CARA} fill={palette.bgCard} stroke={palette.line2} strokeWidth={1} />
            </G>
            {/* El avance: la cara se va llenando de abajo hacia arriba con el metal que se ganará. */}
            {avance > 0 ? (
              <G transform="translate(48 46) scale(0.88) translate(-48 -46)" clipPath={`url(#${id}-corte)`}>
                <Rect x={20} y={14 + 66 * (1 - avance)} width={56} height={66 * avance} fill={m.medio} opacity={0.38} />
                <Rect x={20} y={14 + 66 * (1 - avance)} width={56} height={1.2} fill={m.luz} opacity={0.8} />
              </G>
            ) : null}
          </>
        )}
      </Svg>
      {/* El icono del logro, en el centro de la cara. */}
      <View style={[styles.centro, { top: 27 * k, width: 38 * k, height: 38 * k }]} pointerEvents="none">
        <Icon name={iconoDe(icono)} size={24 * k} tint={ganado ? m.luz : color.text.tertiary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: stroke.hairline, borderColor: 'transparent' },
});
