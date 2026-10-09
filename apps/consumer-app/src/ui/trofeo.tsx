/**
 * El dibujo del trofeo, aparte de la celda que lo muestra: lo usan la vitrina de logros (96 px) y la celebración al
 * ganar uno (260 px). Es SVG, así que a cualquier tamaño y densidad de pantalla sigue nítido; el metal se calcula.
 *
 * Cinco rangos —bronce, plata, oro, platino y diamante— según lo difícil que es el logro. Los colores del metal NO son
 * tokens de la interfaz: son de la ilustración, como los de `ilustraciones-bienvenida`.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Badge, BadgeRank } from '../api/endpoints/credit-line';
import { color, luz, metal, objeto, stroke } from '../theme/tokens';
import { Icon, ICON_NAMES, type IconName } from './icons';

export type Rango = BadgeRank;

const LADO = 96;
const RADIO_ANILLO = 44;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO_ANILLO;

/** El metal de cada rango: claro (luz), medio y profundo (sombra), el tono del halo y el color de la tinta del medallón. */
export const METAL: Record<Rango, { luz: string; medio: string; sombra: string; halo: string; tinta: string; nombre: string; chispas: string[] }> = {
  bronce: { ...metal.bronce, nombre: 'Bronce', chispas: [metal.bronce.luz, metal.bronce.halo, luz.blanco] },
  plata: { luz: metal.plata.luz, medio: metal.plata.medio, sombra: metal.plata.sombra, halo: metal.plata.halo, tinta: metal.plata.tinta, nombre: 'Plata', chispas: [metal.plata.luz, metal.plata.medio, metal.plata.extra] },
  oro: { luz: metal.oro.luz, medio: metal.oro.medio, sombra: metal.oro.sombra, halo: metal.oro.halo, tinta: metal.oro.tinta, nombre: 'Oro', chispas: [metal.oro.luz, metal.oro.medio, luz.blanco, metal.oro.extra] },
  platino: { luz: metal.platino.luz, medio: color.brand.b300, sombra: color.brand.b700, halo: color.brand.b400, tinta: color.brand.b900, nombre: 'Platino', chispas: [metal.platino.luz, color.brand.b300, color.brand.b400, luz.blanco] },
  diamante: { luz: metal.diamante.luz, medio: metal.diamante.medio, sombra: metal.diamante.sombra, halo: metal.diamante.halo, tinta: metal.diamante.tinta, nombre: 'Diamante', chispas: [metal.diamante.luz, metal.diamante.medio, metal.diamante.violeta, metal.diamante.rosa, luz.blanco] },
};

/** Qué tan difícil es cada logro, para un backend que aún no manda `rank`. Uno desconocido es de plata. */
const RANGO_DE: Record<string, Rango> = {
  primera_compra: 'bronce',
  primer_pago: 'bronce',
  identidad: 'bronce',
  racha_3: 'plata',
  compra_cerrada: 'plata',
  cien_bs: 'plata',
  racha_6: 'oro',
  mil_bs: 'oro',
  un_ano: 'oro',
  cinco_mil_bs: 'platino',
};

export const rangoDe = (insignia: Pick<Badge, 'code' | 'rank'>): Rango => insignia.rank ?? RANGO_DE[insignia.code] ?? 'plata';

export const iconoDe = (nombre: string): IconName => ((ICON_NAMES as readonly string[]).includes(nombre) ? (nombre as IconName) : 'estrella');

/** La copa: boca ancha, cuerpo que se cierra hacia el tallo. Asas aparte para poder sombrearlas. */
const COPA = 'M26 14 H70 V30 C70 46 60 56 48 58 C36 56 26 46 26 30 Z';
const ASA_IZQ = 'M26 19 H17 C14 19 13 22 13 25 C13 34 19 40 27 41';
const ASA_DER = 'M70 19 H79 C82 19 83 22 83 25 C83 34 77 40 69 41';
const TALLO = 'M44 58 H52 L54 68 H42 Z';
/** Reflejo especular: una franja curva en el lado izquierdo de la copa. */
const REFLEJO = 'M31 17 H37 V30 C37 40 40 47 45 52 C37 50 31 42 31 30 Z';
/** El contorno de la copa entera, para que un barrido de luz se recorte a la silueta y no a un rectángulo. */
export const SILUETA_COPA = `${COPA} ${TALLO}`;

export function Trofeo({
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
  /** 0-1: el anillo de lo que falta, sólo en un trofeo sin ganar. */
  avance?: number;
  lado?: number;
  /** Capas propias de la escena (el barrido de luz de la celebración) pintadas DENTRO del mismo SVG, sobre el metal. */
  children?: React.ReactNode;
}) {
  const m = METAL[rango];
  const id = `tr-${codigo}-${lado}`;
  const k = lado / LADO;
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={lado} height={lado} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={m.sombra} />
            <Stop offset="0.35" stopColor={m.luz} />
            <Stop offset="0.6" stopColor={m.medio} />
            <Stop offset="1" stopColor={m.sombra} />
          </LinearGradient>
          <LinearGradient id={`${id}-peana`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={objeto.pedestal.claro} />
            <Stop offset="1" stopColor={objeto.pedestal.oscuro} />
          </LinearGradient>
          <RadialGradient id={`${id}-halo`} cx="48" cy="38" r="46" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={m.halo} stopOpacity={0.45} />
            <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {ganado ? (
          <>
            <Circle cx={48} cy={38} r={46} fill={`url(#${id}-halo)`} />
            <Path d={ASA_IZQ} fill="none" stroke={`url(#${id}-metal)`} strokeWidth={4} strokeLinecap="round" />
            <Path d={ASA_DER} fill="none" stroke={`url(#${id}-metal)`} strokeWidth={4} strokeLinecap="round" />
            <Path d={COPA} fill={`url(#${id}-metal)`} />
            {/* El labio de la copa: una elipse más clara que da el volumen de la boca. */}
            <Ellipse cx={48} cy={14} rx={22} ry={3} fill={m.luz} opacity={0.9} />
            <Path d={REFLEJO} fill={luz.blanco} opacity={0.35} />
            <Path d={TALLO} fill={`url(#${id}-metal)`} />
            <Rect x={32} y={68} width={32} height={6} rx={2} fill={`url(#${id}-metal)`} />
            <Rect x={28} y={74} width={40} height={12} rx={3} fill={`url(#${id}-peana)`} stroke={m.medio} strokeWidth={1} />
            {/* La placa de la peana. */}
            <Rect x={38} y={78} width={20} height={4} rx={1} fill={m.medio} opacity={0.85} />
            {/* Los destellos: el que vende «recién pulido». */}
            <Path d="M78 6 l1.6 4.2 4.2 1.6 -4.2 1.6 -1.6 4.2 -1.6 -4.2 -4.2 -1.6 4.2 -1.6 Z" fill={luz.blanco} opacity={0.95} />
            <Path d="M16 50 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1 Z" fill={luz.blanco} opacity={0.7} />
            {children}
          </>
        ) : (
          <>
            <Path d={ASA_IZQ} fill="none" stroke={color.border.strong} strokeWidth={3} strokeLinecap="round" />
            <Path d={ASA_DER} fill="none" stroke={color.border.strong} strokeWidth={3} strokeLinecap="round" />
            <Path d={COPA} fill={color.surface.secondary} stroke={color.border.strong} strokeWidth={1.5} />
            <Path d={TALLO} fill={color.surface.secondary} stroke={color.border.strong} strokeWidth={1} />
            <Rect x={28} y={70} width={40} height={14} rx={3} fill={color.surface.secondary} stroke={color.border.strong} strokeWidth={1} />
            {avance > 0 ? (
              <Circle
                cx={48}
                cy={48}
                r={RADIO_ANILLO}
                fill="none"
                stroke={m.medio}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${CIRCUNFERENCIA * avance} ${CIRCUNFERENCIA}`}
                transform="rotate(-90 48 48)"
                opacity={0.85}
              />
            ) : null}
          </>
        )}
      </Svg>
      {/* El medallón con el icono del logro, centrado en la copa. */}
      <View
        style={[
          styles.medallon,
          { top: 24 * k, width: 28 * k, height: 28 * k, borderRadius: 14 * k },
          ganado ? { backgroundColor: m.tinta, borderColor: m.luz } : styles.medallonApagado,
        ]}
        pointerEvents="none"
      >
        <Icon name={iconoDe(icono)} size={16 * k} tint={ganado ? m.luz : color.text.tertiary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  medallon: { position: 'absolute', borderWidth: stroke.hairline, alignItems: 'center', justifyContent: 'center' },
  medallonApagado: { backgroundColor: color.surface.raised, borderColor: color.border.strong },
});
