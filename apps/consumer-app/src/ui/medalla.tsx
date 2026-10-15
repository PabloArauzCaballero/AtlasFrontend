/**
 * La insignia: una medalla-escudo de metal. Sustituye a la copa (`trofeo.tsx`) como dibujo del logro (Pablo,
 * 2026-10-07: «mejor como una insignia que un trofeo, ultra HD, como una carta legendaria»).
 *
 * Es SVG: nítida a cualquier tamaño —96 px en la vitrina, 190 en la carta, 250 en la celebración—.
 *
 * ## Las capas, de atrás adelante (y por qué cada una)
 *
 * Pablo, 2026-10-15: «se ven pobres». Lo que las hacía pobres era que el metal era un degradado plano con un borde: sin
 * apoyo, sin canto y sin textura, se leía como un icono coloreado. Ahora:
 *
 * 1. **Sombra de contacto** bajo la punta: el objeto se APOYA en algo. Es lo que más separa un objeto de un dibujo.
 * 2. **Aro** con degradado diagonal y **bisel**: un filo claro arriba a la izquierda y uno oscuro abajo a la derecha,
 *    la misma luz que el resto de la escena.
 * 3. **Cara hundida** con su propio degradado y un **grabado guilloché** (anillos finos), la textura de una moneda.
 * 4. **Reflejo especular** suave y recortado a la silueta, no una faja de polígono duro.
 * 5. **Gemas** del rango (una en bronce, cinco en diamante), cada una con su brillo.
 * 6. El **icono en relieve**: dos capas, una sombra un punto abajo y el metal encima.
 *
 * Sin ganar: la MISMA pieza en relieve apagado —aro de superficie con bisel, cara hundida e icono grabado—, y la cara se
 * llena de metal según el avance. No un gris plano: algo que se puede ganar, no un hueco.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { alpha, color, esquema, luz, objeto } from '../theme/tokens';
import { Icon } from './icons';
import { iconoDe, METAL, type Rango } from './trofeo';

const LADO = 96;

/** El escudo: hombros rectos, flancos que se cierran en punta. Un solo trazo para el aro, la cara y el recorte del brillo. */
const ESCUDO = 'M48 8 L80 19 V45 C80 63 66 77 48 87 C30 77 16 63 16 45 V19 Z';
const CARA = 'M48 14 L74 23 V45 C74 59 62 71 48 79 C34 71 22 59 22 45 V23 Z';
/** El recorte de un barrido de luz: la silueta entera del escudo. */
export const SILUETA_MEDALLA = ESCUDO;
/** La cara, encogida al 90 % alrededor de su centro óptico: el hueco donde va el icono. */
const DENTRO = 'translate(48 46) scale(0.9) translate(-48 -46)';

const GEMAS = { bronce: 1, plata: 2, oro: 3, platino: 4, diamante: 5 } as const;
/** El grabado de la cara: anillos concéntricos cada 3,2 unidades. */
const ANILLOS = Array.from({ length: 11 }, (_, i) => 4 + i * 3.2);

export function Medalla({
  codigo,
  rango,
  icono,
  ganado,
  avance = 0,
  lado = LADO,
  sobreOscuro = false,
  children,
}: {
  codigo: string;
  rango: Rango;
  icono: string;
  ganado: boolean;
  /** 0-1: cuánto de la cara se llena, sólo en una insignia sin ganar. */
  avance?: number;
  lado?: number;
  /**
   * Va sobre un objeto oscuro en los dos temas (la carta). La pendiente no puede usar las superficies del tema: en claro
   * salía un escudo blanco que deslumbraba sobre el azul noche de la carta.
   */
  sobreOscuro?: boolean;
  /** Capas propias de la escena (el barrido de luz) pintadas DENTRO del mismo SVG, sobre el metal. */
  children?: React.ReactNode;
}) {
  const m = METAL[rango];
  const id = `md-${codigo}-${lado}`;
  const k = lado / LADO;
  const gemas = GEMAS[rango];
  const claro = esquema === 'claro' && !sobreOscuro;
  const apagado = sobreOscuro
    ? { arriba: objeto.carta.rotuloApagado.centro, abajo: objeto.carta.rotuloApagado.borde, cara: objeto.carta.pista, filo: alpha(luz.blanco, 0.16), icono: objeto.carta.tinta.terciaria }
    : { arriba: color.surface.raised, abajo: color.surface.secondary, cara: color.surface.raisedStrong, filo: color.border.strong, icono: color.text.tertiary };
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={lado} height={lado} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={`${id}-aro`} x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={m.luz} />
            <Stop offset="0.32" stopColor={m.medio} />
            <Stop offset="0.58" stopColor={m.sombra} />
            <Stop offset="0.8" stopColor={m.medio} />
            <Stop offset="1" stopColor={m.sombra} />
          </LinearGradient>
          {/* El canto: claro donde le da la luz (arriba a la izquierda), oscuro en la sombra. */}
          <LinearGradient id={`${id}-canto`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={luz.blanco} stopOpacity={0.95} />
            <Stop offset="0.45" stopColor={luz.blanco} stopOpacity={0} />
            <Stop offset="0.6" stopColor={luz.negro} stopOpacity={0} />
            <Stop offset="1" stopColor={luz.negro} stopOpacity={0.45} />
          </LinearGradient>
          <LinearGradient id={`${id}-bisel`} x1="1" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={m.luz} />
            <Stop offset="0.5" stopColor={m.sombra} />
            <Stop offset="1" stopColor={m.sombra} />
          </LinearGradient>
          <RadialGradient id={`${id}-cara`} cx="44" cy="34" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={m.medio} stopOpacity={0.7} />
            <Stop offset="0.45" stopColor={m.tinta} stopOpacity={1} />
            <Stop offset="1" stopColor={objeto.fondoProfundo} stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id={`${id}-halo`} cx="48" cy="46" r="48" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={m.halo} stopOpacity={claro ? 0.32 : 0.45} />
            <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}-contacto`} cx="48" cy="90" r="24" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={luz.negro} stopOpacity={claro ? 0.22 : 0.5} />
            <Stop offset="1" stopColor={luz.negro} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${id}-reflejo`} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={luz.blanco} stopOpacity={0.55} />
            <Stop offset="1" stopColor={luz.blanco} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={`${id}-apagado`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={apagado.arriba} />
            <Stop offset="1" stopColor={apagado.abajo} />
          </LinearGradient>
          <LinearGradient id={`${id}-llenado`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={m.luz} stopOpacity={0.75} />
            <Stop offset="1" stopColor={m.medio} stopOpacity={0.55} />
          </LinearGradient>
          <ClipPath id={`${id}-corte`}>
            <Path d={CARA} />
          </ClipPath>
          <ClipPath id={`${id}-silueta`}>
            <Path d={ESCUDO} />
          </ClipPath>
        </Defs>

        <Ellipse cx={48} cy={90} rx={24} ry={3.6} fill={`url(#${id}-contacto)`} />

        {ganado ? (
          <>
            <Circle cx={48} cy={46} r={48} fill={`url(#${id}-halo)`} />
            <Path d={ESCUDO} fill={`url(#${id}-aro)`} />
            <Path d={ESCUDO} fill="none" stroke={`url(#${id}-canto)`} strokeWidth={1.4} strokeLinejoin="round" />
            <Path d={CARA} fill={`url(#${id}-bisel)`} />
            <G transform={DENTRO}>
              <Path d={CARA} fill={`url(#${id}-cara)`} />
              {/* El guilloché: anillos finos recortados a la cara, la textura de una moneda acuñada. */}
              <G clipPath={`url(#${id}-corte)`}>
                {ANILLOS.map((r) => (
                  <Circle key={r} cx={48} cy={44} r={r} fill="none" stroke={m.luz} strokeWidth={0.35} opacity={0.14} />
                ))}
              </G>
              <Path d={CARA} fill="none" stroke={m.luz} strokeWidth={0.7} opacity={0.8} />
            </G>
            {/* El reflejo: una elipse inclinada, suave, recortada a la silueta. */}
            <G clipPath={`url(#${id}-silueta)`}>
              <Ellipse cx={34} cy={24} rx={26} ry={13} fill={`url(#${id}-reflejo)`} transform="rotate(-24 34 24)" />
            </G>
            {Array.from({ length: gemas }, (_, g) => {
              const x = 48 + (g - (gemas - 1) / 2) * 7;
              return (
                <G key={g}>
                  <Path d={`M${x} 66 l2.6 3 -2.6 3.4 -2.6 -3.4 Z`} fill={m.luz} stroke={m.sombra} strokeWidth={0.4} />
                  <Path d={`M${x} 66.6 l1.2 1.8 -1.2 0.6 -1.2 -0.6 Z`} fill={luz.blanco} opacity={0.85} />
                </G>
              );
            })}
            {children}
          </>
        ) : (
          <>
            {/* Relieve apagado: el mismo canto que la ganada, en los tonos de la superficie. */}
            <Path d={ESCUDO} fill={`url(#${id}-apagado)`} stroke={apagado.filo} strokeWidth={1} strokeLinejoin="round" />
            <Path d={ESCUDO} fill="none" stroke={`url(#${id}-canto)`} strokeWidth={1.2} strokeLinejoin="round" opacity={claro ? 0.5 : 0.35} />
            <G transform={DENTRO}>
              <Path d={CARA} fill={apagado.cara} stroke={apagado.filo} strokeWidth={0.8} />
              <Path d={CARA} fill="none" stroke={claro ? luz.blanco : luz.negro} strokeWidth={0.8} opacity={0.6} transform="translate(0 0.8)" />
            </G>
            {/* El avance: la cara se llena de abajo arriba con el metal que se ganará, con su línea de nivel. */}
            {avance > 0 ? (
              <G transform={DENTRO} clipPath={`url(#${id}-corte)`}>
                <Rect x={20} y={14 + 66 * (1 - avance)} width={56} height={66 * avance} fill={`url(#${id}-llenado)`} />
                <Rect x={20} y={14 + 66 * (1 - avance)} width={56} height={1} fill={m.luz} />
              </G>
            ) : null}
          </>
        )}
      </Svg>
      {/* El icono del logro, en relieve: una sombra un punto abajo y el metal encima. */}
      <View style={[styles.centro, { top: 27 * k + 1.2 * k, width: 38 * k, height: 38 * k }]} pointerEvents="none">
        <Icon name={iconoDe(icono)} size={24 * k} tint={ganado ? alpha(luz.negro, 0.55) : claro ? luz.blanco : alpha(luz.negro, 0.6)} />
      </View>
      <View style={[styles.centro, { top: 27 * k, width: 38 * k, height: 38 * k }]} pointerEvents="none">
        <Icon name={iconoDe(icono)} size={24 * k} tint={ganado ? m.luz : apagado.icono} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
