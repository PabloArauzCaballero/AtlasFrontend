/**
 * Una insignia en la vitrina: una BALDOSA tocable con la medalla, su nombre y su rango.
 *
 * Pablo (2026-10-06): «los logros, más bonitos, como trofeos, algo premium y sofisticado». Y el 2026-10-07: «más
 * variedad». Hay más de treinta, en siete colecciones, y algunas son SECRETAS: hasta ganarlas sólo enseñan una pista.
 *
 * ## Que se note que se puede tocar (2026-10-15)
 *
 * Pablo: «la tarjeta tocable no se nota que es cliqueable». La medalla era un dibujo suelto sobre la tarjeta: nada decía
 * que abría algo. Ahora cada insignia es una baldosa —superficie elevada y borde sutil, como un botón—, se HUNDE bajo el
 * dedo con el muelle `press` de los tokens (`PressSurface`), y la vitrina pone encima la línea «Toca una insignia para ver
 * su carta». Para el lector de pantalla es un botón con su pista.
 *
 * ## Qué muestra
 *
 * Ganada: la medalla de esmalte con las marcas de su rango, y el rango escrito. Pendiente: la misma silueta en relieve
 * apagado de marca, llenándose según el avance, y cuánto lleva. El dibujo vive en `medalla.tsx`.
 */
import { StyleSheet, View } from 'react-native';
import type { Badge } from '../api/endpoints/credit-line';
import { avanceDeInsignia } from '../features/puntaje-explicado';
import { color, marca, press, radius, space, stroke } from '../theme/tokens';
import { Medalla } from './medalla';
import { PressSurface } from './motion';
import { AtlasText } from './primitives';
import { RANGO, rangoDe } from './trofeo';

export { rangoDe };
export type { Rango } from './trofeo';

/** Lo que se ve de una insignia: una secreta sin ganar enseña la pista y un candado, no su nombre. */
export function caraDe(insignia: Badge): { label: string; detail: string; icon: string; oculta: boolean } {
  const oculta = !!insignia.secret && !insignia.earned;
  return oculta
    ? { label: 'Insignia secreta', detail: insignia.hint ?? `Sigue usando ${marca.nombre} y la descubrirás.`, icon: 'candado', oculta }
    : { label: insignia.label, detail: insignia.detail, icon: insignia.icon, oculta };
}

export function Insignia({ insignia, onPress }: { insignia: Badge; onPress?: () => void }) {
  const cara = caraDe(insignia);
  const avance = insignia.target > 0 && !cara.oculta ? Math.min(1, insignia.current / insignia.target) : 0;
  const rango = rangoDe(insignia);
  const r = RANGO[rango];
  const ganada = insignia.earned;
  const pie = ganada ? r.nombre.toUpperCase() : cara.oculta ? 'SECRETA' : avanceDeInsignia(insignia);

  const contenido = (
    <>
      <Medalla codigo={insignia.code} rango={rango} icono={cara.icon} ganado={ganada} avance={avance} lado={72} />
      <AtlasText variant="captionStrong" tone={ganada ? 'primary' : 'secondary'} align="center" numberOfLines={2} style={styles.nombre}>
        {cara.label}
      </AtlasText>
      <AtlasText variant="micro" tone={ganada ? 'brand' : 'tertiary'} align="center" numberOfLines={1}>
        {pie}
      </AtlasText>
    </>
  );

  const etiqueta = `Insignia de rango ${r.nombre.toLowerCase()}: ${cara.label}. ${ganada ? 'Ganada' : cara.oculta ? 'Secreta' : `Pendiente, ${avanceDeInsignia(insignia)}`}. ${cara.detail}`;

  return (
    <View style={styles.celda}>
      {onPress ? (
        <PressSurface
          style={styles.baldosa}
          onPress={onPress}
          scaleTo={press.scale}
          accessibilityRole="button"
          accessibilityLabel={etiqueta}
          accessibilityHint="Abre la carta de esta insignia"
          testID={`insignia-${insignia.code}`}
        >
          {contenido}
        </PressSurface>
      ) : (
        <View style={styles.baldosa} accessible accessibilityLabel={etiqueta} testID={`insignia-${insignia.code}`}>
          {contenido}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  celda: { width: '33.33%', padding: space.xs },
  baldosa: {
    alignItems: 'center',
    gap: space.xxs,
    paddingTop: space.sm,
    paddingBottom: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.lg,
    backgroundColor: color.surface.raised,
    borderWidth: stroke.hairline,
    borderColor: color.border.subtle,
  },
  nombre: { minHeight: 32, marginTop: space.xxs },
});
