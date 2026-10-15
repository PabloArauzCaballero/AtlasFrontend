/**
 * La insignia: una medalla-escudo de ESMALTE DE MARCA. Es SVG: nítida a 96 px en la vitrina, 190 en la carta y 230 en la
 * celebración.
 *
 * ## El material (2026-10-15)
 *
 * Pablo: «más premium, más serio, y con el MISMO estilo de colores» que el resto de la app. Fuera los cinco metales de
 * colores, los destellos de cuatro puntas y el brillo de vidrio: todas las insignias son del mismo esmalte, el tono
 * profundo de la marca (`theme/esmalte.ts`), con un aro satinado —mate, sin reflejo de espejo— y un filete del acento.
 * Es el lenguaje de la tarjeta navy de la app: un objeto oscuro y sobrio, igual en claro y en oscuro.
 *
 * ## Cómo se lee el rango
 *
 * Por las MARCAS grabadas bajo el icono: de una (bronce) a cinco (diamante), como las estrellas de una condecoración. Y,
 * desde platino, un segundo filete interior. El nombre del rango va escrito al lado (la vitrina, la carta, la ceremonia).
 *
 * ## Las capas, de atrás adelante
 *
 * Sombra de contacto (el objeto se apoya) → aro satinado → canto (luz arriba a la izquierda, sombra abajo) → cara de
 * esmalte con grabado guilloché muy tenue → filete (dos desde platino) → marcas del rango → icono en relieve.
 *
 * Sin ganar: la misma pieza en RELIEVE APAGADO de marca —la superficie del tema con el contorno y el hueco teñidos del
 * acento—, y la cara se llena según el avance. Dentro de la carta (`sobreOscuro`), el relieve es del propio esmalte.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { esmalte } from '../theme/esmalte';
import { alpha, color, esquema, luz } from '../theme/tokens';
import { Icon } from './icons';
import { iconoDe, RANGO, type Rango } from './trofeo';

const LADO = 96;

/** El escudo: hombros rectos, flancos que se cierran en punta. Un solo trazo para el aro, la cara y el recorte. */
const ESCUDO = 'M48 8 L80 19 V45 C80 63 66 77 48 87 C30 77 16 63 16 45 V19 Z';
const CARA = 'M48 14 L74 23 V45 C74 59 62 71 48 79 C34 71 22 59 22 45 V23 Z';
/** El recorte de un barrido de luz: la silueta entera del escudo. */
export const SILUETA_MEDALLA = ESCUDO;
/** La cara, encogida alrededor de su centro óptico. */
const DENTRO = 'translate(48 46) scale(0.9) translate(-48 -46)';
const FILETE_2 = 'translate(48 46) scale(0.82) translate(-48 -46)';
const ANILLOS = Array.from({ length: 11 }, (_, i) => 4 + i * 3.2);

/** Las marcas del rango: rombos pequeños en fila, centrados bajo el icono. */
function Marcas({ cuantas, tinta, opacidad }: { cuantas: number; tinta: string; opacidad: number }) {
  return (
    <>
      {Array.from({ length: cuantas }, (_, g) => {
        const x = 48 + (g - (cuantas - 1) / 2) * 6;
        return <Path key={g} d={`M${x} 64.6 l2 2.6 -2 2.6 -2 -2.6 Z`} fill={tinta} opacity={opacidad} />;
      })}
    </>
  );
}

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
  /** Va sobre el esmalte (la carta): la pendiente se dibuja en relieve del propio esmalte, no con la superficie del tema. */
  sobreOscuro?: boolean;
  /** Capas propias de la escena (el barrido de luz) pintadas DENTRO del mismo SVG, sobre el esmalte. */
  children?: React.ReactNode;
}) {
  const id = `md-${codigo}-${lado}`;
  const k = lado / LADO;
  const marcas = RANGO[rango].marcas;
  const claro = esquema === 'claro' && !sobreOscuro;
  const apagado = sobreOscuro
    ? { arriba: esmalte.cara, abajo: esmalte.caraProfunda, filo: alpha(esmalte.filete, 0.28), hueco: esmalte.caraProfunda, icono: esmalte.tinta.terciaria, marca: esmalte.tinta.terciaria, lleno: esmalte.filete }
    : { arriba: color.surface.raised, abajo: color.surface.secondary, filo: color.accent.border, hueco: color.accent.soft, icono: color.accent.muted, marca: color.accent.muted, lleno: color.accent.base };
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={lado} height={lado} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={`${id}-aro`} x1="0.15" y1="0" x2="0.85" y2="1">
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
          <RadialGradient id={`${id}-cara`} cx="44" cy="32" r="52" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={esmalte.caraAlta} />
            <Stop offset="0.55" stopColor={esmalte.cara} />
            <Stop offset="1" stopColor={esmalte.caraProfunda} />
          </RadialGradient>
          <RadialGradient id={`${id}-contacto`} cx="48" cy="90" r="24" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={luz.negro} stopOpacity={claro ? 0.18 : 0.45} />
            <Stop offset="1" stopColor={luz.negro} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${id}-apagado`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={apagado.arriba} />
            <Stop offset="1" stopColor={apagado.abajo} />
          </LinearGradient>
          <ClipPath id={`${id}-corte`}>
            <Path d={CARA} />
          </ClipPath>
        </Defs>

        <Ellipse cx={48} cy={90} rx={22} ry={3.2} fill={`url(#${id}-contacto)`} />

        {ganado ? (
          <>
            <Path d={ESCUDO} fill={`url(#${id}-aro)`} />
            <Path d={ESCUDO} fill="none" stroke={`url(#${id}-canto)`} strokeWidth={1.2} strokeLinejoin="round" />
            <G transform={DENTRO}>
              <Path d={CARA} fill={`url(#${id}-cara)`} />
              <G clipPath={`url(#${id}-corte)`}>
                {ANILLOS.map((r) => (
                  <Circle key={r} cx={48} cy={44} r={r} fill="none" stroke={esmalte.filete} strokeWidth={0.3} opacity={0.07} />
                ))}
              </G>
              <Path d={CARA} fill="none" stroke={esmalte.filete} strokeWidth={0.7} opacity={0.75} />
            </G>
            {marcas >= 4 ? (
              <G transform={FILETE_2}>
                <Path d={CARA} fill="none" stroke={esmalte.filete} strokeWidth={0.5} opacity={0.4} />
              </G>
            ) : null}
            <Marcas cuantas={marcas} tinta={esmalte.filete} opacidad={0.95} />
            {children}
          </>
        ) : (
          <>
            <Path d={ESCUDO} fill={`url(#${id}-apagado)`} stroke={apagado.filo} strokeWidth={1} strokeLinejoin="round" />
            <G transform={DENTRO}>
              <Path d={CARA} fill={apagado.hueco} stroke={apagado.filo} strokeWidth={0.7} />
            </G>
            {/* El avance: la cara se llena de abajo arriba con el acento, con su línea de nivel. */}
            {avance > 0 ? (
              <G transform={DENTRO} clipPath={`url(#${id}-corte)`}>
                <Rect x={20} y={14 + 66 * (1 - avance)} width={56} height={66 * avance} fill={apagado.lleno} opacity={0.18} />
                <Rect x={20} y={14 + 66 * (1 - avance)} width={56} height={0.9} fill={apagado.lleno} opacity={0.8} />
              </G>
            ) : null}
            <Marcas cuantas={marcas} tinta={apagado.marca} opacidad={0.7} />
          </>
        )}
      </Svg>
      {/* El icono, en relieve: una sombra medio punto abajo y el filete encima. */}
      {ganado ? (
        <View style={[styles.centro, { top: 25 * k + 1 * k, width: 38 * k, height: 38 * k }]} pointerEvents="none">
          <Icon name={iconoDe(icono)} size={22 * k} tint={alpha(luz.negro, 0.5)} />
        </View>
      ) : null}
      <View style={[styles.centro, { top: 25 * k, width: 38 * k, height: 38 * k }]} pointerEvents="none">
        <Icon name={iconoDe(icono)} size={22 * k} tint={ganado ? esmalte.filete : apagado.icono} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
