/**
 * El logro: un TROFEO que se gana, en bronce, plata, oro o platino según lo difícil que es.
 *
 * Pablo (2026-10-06): «los logros, más bonitos, más ultra HD, como trofeos, algo premium y sofisticado». Antes era un
 * escudo plano con el degradado de la marca, igual para «Primera compra» que para «5.000 Bs a tiempo»: todos los
 * logros pesaban lo mismo, y uno difícil no se sentía como tal.
 *
 * ## Qué muestra
 *
 * Ganado: copa de metal con su degradado de tres paradas, reflejo especular, peana con placa, el icono del logro en un
 * medallón y un halo del color del metal detrás. Flota despacio (`Vivo`). Pendiente: la misma silueta en grafito, con
 * un anillo que se llena según el avance —se ve cuánto falta, no un candado mudo—.
 *
 * ## Por qué SVG y no una imagen
 *
 * Nítido a cualquier densidad de pantalla («ultra HD» de verdad, sin PNG @3x) y el metal se calcula: el mismo dibujo
 * sirve para los cuatro rangos.
 *
 * Los colores del metal NO son tokens de la interfaz: son de la ilustración, como los de `ilustraciones-bienvenida`.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Badge } from '../api/endpoints/credit-line';
import { avanceDeInsignia } from '../features/puntaje-explicado';
import { color, palette, radius, space, stroke } from '../theme/tokens';
import { Icon, ICON_NAMES, type IconName } from './icons';
import { Vivo } from './motion';
import { AtlasText } from './primitives';

const LADO = 96;
const RADIO_ANILLO = 44;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO_ANILLO;

export type Rango = 'bronce' | 'plata' | 'oro' | 'platino';

/** El metal de cada rango: claro (luz), medio y profundo (sombra), más el tono del halo. */
const METAL: Record<Rango, { luz: string; medio: string; sombra: string; halo: string; tinta: string; nombre: string }> = {
  bronce: { luz: '#F6C79B', medio: '#C9834B', sombra: '#7A4522', halo: '#E19A5C', tinta: '#3B1F0C', nombre: 'Bronce' },
  plata: { luz: '#FFFFFF', medio: '#C3CEDB', sombra: '#6E7D91', halo: '#D5E1EE', tinta: '#253244', nombre: 'Plata' },
  oro: { luz: '#FFF4B8', medio: '#F2C14E', sombra: '#9A6A12', halo: '#FFD36A', tinta: '#3D2A04', nombre: 'Oro' },
  platino: { luz: '#F2FFFC', medio: palette.brand300, sombra: palette.brand700, halo: palette.brand400, tinta: palette.brand900, nombre: 'Platino' },
};

/** Qué tan difícil es cada logro. Uno desconocido (llega del servidor) es de plata. */
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

export const rangoDe = (code: string): Rango => RANGO_DE[code] ?? 'plata';

const iconoDe = (nombre: string): IconName => ((ICON_NAMES as readonly string[]).includes(nombre) ? (nombre as IconName) : 'estrella');

/** La copa: boca ancha, cuerpo que se cierra hacia el tallo. Asas aparte para poder sombrearlas. */
const COPA = 'M26 14 H70 V30 C70 46 60 56 48 58 C36 56 26 46 26 30 Z';
const ASA_IZQ = 'M26 19 H17 C14 19 13 22 13 25 C13 34 19 40 27 41';
const ASA_DER = 'M70 19 H79 C82 19 83 22 83 25 C83 34 77 40 69 41';
const TALLO = 'M44 58 H52 L54 68 H42 Z';
/** Reflejo especular: una franja curva en el lado izquierdo de la copa. */
const REFLEJO = 'M31 17 H37 V30 C37 40 40 47 45 52 C37 50 31 42 31 30 Z';

export function Insignia({ insignia, indice = 0 }: { insignia: Badge; indice?: number }) {
  const avance = insignia.target > 0 ? Math.min(1, insignia.current / insignia.target) : 0;
  const rango = rangoDe(insignia.code);
  const m = METAL[rango];
  const id = `tr-${insignia.code}`;
  const ganada = insignia.earned;

  const trofeo = (
    <View style={styles.trofeo} accessible={false}>
      <Svg width={LADO} height={LADO} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={m.sombra} />
            <Stop offset="0.35" stopColor={m.luz} />
            <Stop offset="0.6" stopColor={m.medio} />
            <Stop offset="1" stopColor={m.sombra} />
          </LinearGradient>
          <LinearGradient id={`${id}-peana`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E2C40" />
            <Stop offset="1" stopColor="#0A1424" />
          </LinearGradient>
          <RadialGradient id={`${id}-halo`} cx="48" cy="38" r="46" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={m.halo} stopOpacity={0.45} />
            <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {ganada ? (
          <>
            <Circle cx={48} cy={38} r={46} fill={`url(#${id}-halo)`} />
            <Path d={ASA_IZQ} fill="none" stroke={`url(#${id}-metal)`} strokeWidth={4} strokeLinecap="round" />
            <Path d={ASA_DER} fill="none" stroke={`url(#${id}-metal)`} strokeWidth={4} strokeLinecap="round" />
            <Path d={COPA} fill={`url(#${id}-metal)`} />
            {/* El labio de la copa: una elipse más clara que da el volumen de la boca. */}
            <Ellipse cx={48} cy={14} rx={22} ry={3} fill={m.luz} opacity={0.9} />
            <Path d={REFLEJO} fill="#FFFFFF" opacity={0.35} />
            <Path d={TALLO} fill={`url(#${id}-metal)`} />
            <Rect x={32} y={68} width={32} height={6} rx={2} fill={`url(#${id}-metal)`} />
            <Rect x={28} y={74} width={40} height={12} rx={3} fill={`url(#${id}-peana)`} stroke={m.medio} strokeWidth={1} />
            {/* La placa de la peana. */}
            <Rect x={38} y={78} width={20} height={4} rx={1} fill={m.medio} opacity={0.85} />
            {/* Los destellos: el que vende «recién pulido». */}
            <Path d="M78 6 l1.6 4.2 4.2 1.6 -4.2 1.6 -1.6 4.2 -1.6 -4.2 -4.2 -1.6 4.2 -1.6 Z" fill="#FFFFFF" opacity={0.95} />
            <Path d="M16 50 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1 Z" fill="#FFFFFF" opacity={0.7} />
          </>
        ) : (
          <>
            <Path d={ASA_IZQ} fill="none" stroke={palette.line2} strokeWidth={3} strokeLinecap="round" />
            <Path d={ASA_DER} fill="none" stroke={palette.line2} strokeWidth={3} strokeLinecap="round" />
            <Path d={COPA} fill={palette.bgElevated} stroke={palette.line2} strokeWidth={1.5} />
            <Path d={TALLO} fill={palette.bgElevated} stroke={palette.line2} strokeWidth={1} />
            <Rect x={28} y={70} width={40} height={14} rx={3} fill={palette.bgElevated} stroke={palette.line2} strokeWidth={1} />
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
      <View style={[styles.medallon, ganada ? { backgroundColor: m.tinta, borderColor: m.luz } : styles.medallonApagado]} pointerEvents="none">
        <Icon name={iconoDe(insignia.icon)} size={16} tint={ganada ? m.luz : color.text.tertiary} />
      </View>
    </View>
  );

  return (
    <View
      style={styles.celda}
      accessible
      accessibilityLabel={`Trofeo de ${m.nombre.toLowerCase()}: ${insignia.label}. ${ganada ? 'Ganado' : `Pendiente, ${avanceDeInsignia(insignia)}`}. ${insignia.detail}`}
      testID={`insignia-${insignia.code}`}
    >
      {/* Ganados flotan (descompasados); el que está más cerca de ganarse se mece para invitarte. */}
      {ganada ? (
        <Vivo tipo="flota" retardo={indice * 330} periodo={3000}>
          {trofeo}
        </Vivo>
      ) : avance >= 0.5 ? (
        <Vivo tipo="oscila" retardo={indice * 330} periodo={2200}>
          {trofeo}
        </Vivo>
      ) : (
        trofeo
      )}
      <AtlasText variant="captionStrong" tone={ganada ? 'primary' : 'secondary'} align="center" numberOfLines={2}>
        {insignia.label}
      </AtlasText>
      <View style={[styles.rango, ganada ? { borderColor: m.medio } : null]}>
        <AtlasText variant="micro" tone={ganada ? 'primary' : 'tertiary'} align="center" style={ganada ? { color: m.luz } : undefined}>
          {ganada ? m.nombre.toUpperCase() : avanceDeInsignia(insignia)}
        </AtlasText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  celda: { width: '33.33%', alignItems: 'center', gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.xs },
  trofeo: { width: LADO, height: LADO, alignItems: 'center', justifyContent: 'center' },
  medallon: {
    position: 'absolute',
    top: 24,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: stroke.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallonApagado: { backgroundColor: palette.bgCard, borderColor: palette.line2 },
  rango: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: stroke.hairline,
    borderColor: color.border.hairline,
  },
});
