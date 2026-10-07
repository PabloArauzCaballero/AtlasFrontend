/**
 * La insignia: una medalla que se gana, con carácter.
 *
 * ## Qué muestra
 *
 * Ganada: escudo con el degradado de la marca, un filo de luz arriba, una chispa y el icono de lo que se hizo; flota
 * despacio (`Vivo`). Pendiente: la misma silueta apagada, con un ANILLO que se llena según el avance, para que se vea
 * cuánto falta en vez de un candado mudo.
 *
 * ## Por qué dibujada y no un emoji ni un icono de lista
 *
 * Una insignia sólo motiva si se ve ganada. Un icono plano dentro de un círculo gris no distingue «tengo» de «me falta»
 * más que por el color; la silueta, el brillo y el movimiento sí. Es SVG, así que se ve nítida a cualquier tamaño.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { Badge } from '../api/endpoints/credit-line';
import { avanceDeInsignia } from '../features/puntaje-explicado';
import { color, palette, space } from '../theme/tokens';
import { Icon, ICON_NAMES, type IconName } from './icons';
import { Vivo } from './motion';
import { AtlasText } from './primitives';

const LADO = 84;
/** Un escudo de seis lados, un poco más ancho arriba: se lee como una medalla y no como un hexágono de mapa. */
const ESCUDO = 'M42 4 L74 18 L74 46 C74 62 60 74 42 80 C24 74 10 62 10 46 L10 18 Z';
const RADIO_ANILLO = 39;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO_ANILLO;

const iconoDe = (nombre: string): IconName => ((ICON_NAMES as readonly string[]).includes(nombre) ? (nombre as IconName) : 'estrella');

export function Insignia({ insignia, indice = 0 }: { insignia: Badge; indice?: number }) {
  const avance = insignia.target > 0 ? Math.min(1, insignia.current / insignia.target) : 0;
  const medalla = (
    <View style={styles.medalla} accessible={false}>
      <Svg width={LADO} height={LADO} viewBox="0 0 84 84">
        <Defs>
          <LinearGradient id={`ins-${insignia.code}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.brand300} />
            <Stop offset="0.55" stopColor={palette.brand400} />
            <Stop offset="1" stopColor={palette.brand500} />
          </LinearGradient>
        </Defs>
        {insignia.earned ? (
          <>
            <Path d={ESCUDO} fill={`url(#ins-${insignia.code})`} />
            {/* El filo de luz de arriba: la luz cae desde arriba, como en el resto de la app. */}
            <Path d="M42 8 L70 20 L70 28 C58 22 28 22 14 28 L14 20 Z" fill="#FFFFFF" opacity={0.28} />
            <Path d={ESCUDO} fill="none" stroke={palette.brand900} strokeWidth={2} opacity={0.35} />
            {/* La chispa. */}
            <Path d="M66 8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#FFFFFF" opacity={0.95} />
          </>
        ) : (
          <>
            <Path d={ESCUDO} fill={palette.bgCard} stroke={palette.edgeLit} strokeWidth={2} strokeDasharray="4 4" />
            {avance > 0 ? (
              <Circle
                cx={42}
                cy={42}
                r={RADIO_ANILLO}
                fill="none"
                stroke={palette.brand400}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${CIRCUNFERENCIA * avance} ${CIRCUNFERENCIA}`}
                transform="rotate(-90 42 42)"
                opacity={0.8}
              />
            ) : null}
          </>
        )}
      </Svg>
      <View style={styles.icono} pointerEvents="none">
        <Icon name={iconoDe(insignia.icon)} size={30} tint={insignia.earned ? palette.brand900 : color.text.tertiary} />
      </View>
    </View>
  );

  return (
    <View
      style={styles.celda}
      accessible
      accessibilityLabel={`${insignia.label}. ${insignia.earned ? 'Ganada' : `Pendiente, ${avanceDeInsignia(insignia)}`}. ${insignia.detail}`}
      testID={`insignia-${insignia.code}`}
    >
      {/* Ganadas flotan (descompasadas); la que está más cerca de ganarse se mece para invitarte. */}
      {insignia.earned ? (
        <Vivo tipo="flota" retardo={indice * 330} periodo={3000}>
          {medalla}
        </Vivo>
      ) : avance >= 0.5 ? (
        <Vivo tipo="oscila" retardo={indice * 330} periodo={2200}>
          {medalla}
        </Vivo>
      ) : (
        medalla
      )}
      <AtlasText variant="captionStrong" tone={insignia.earned ? 'primary' : 'secondary'} align="center" numberOfLines={2}>
        {insignia.label}
      </AtlasText>
      <AtlasText variant="micro" tone={insignia.earned ? 'brand' : 'tertiary'} align="center">
        {avanceDeInsignia(insignia)}
      </AtlasText>
    </View>
  );
}

const styles = StyleSheet.create({
  celda: { width: '33.33%', alignItems: 'center', gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.xs },
  medalla: { width: LADO, height: LADO, alignItems: 'center', justifyContent: 'center' },
  icono: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
