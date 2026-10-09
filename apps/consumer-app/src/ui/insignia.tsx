/**
 * El logro: un TROFEO que se gana, en bronce, plata, oro, platino o diamante según lo difícil que es.
 *
 * Pablo (2026-10-06): «los logros, más bonitos, más ultra HD, como trofeos, algo premium y sofisticado». Y el
 * 2026-10-07: «más variedad». Hay más de treinta, en siete colecciones, y algunos son SECRETOS: hasta ganarlos sólo
 * enseñan una pista. La curiosidad también engancha.
 *
 * ## Qué muestra
 *
 * Ganada: medalla-escudo de metal con gemas por rango, el icono del logro en el centro y un halo del color del metal.
 * Pendiente: la misma silueta en grafito, con un anillo que se llena según el avance —se ve
 * cuánto falta, no un candado mudo—.
 *
 * El dibujo vive en `medalla.tsx`: la celebración al ganar y la carta usan el mismo, grande. Tocar CUALQUIERA abre su carta.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import type { Badge } from '../api/endpoints/credit-line';
import { avanceDeInsignia } from '../features/puntaje-explicado';
import { color, radius, space, stroke, marca } from '../theme/tokens';
import { AtlasText } from './primitives';
import { Medalla } from './medalla';
import { METAL, rangoDe } from './trofeo';

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
  const m = METAL[rango];
  const ganada = insignia.earned;
  const pie = ganada ? m.nombre.toUpperCase() : cara.oculta ? 'SECRETA' : avanceDeInsignia(insignia);

  const trofeo = <Medalla codigo={insignia.code} rango={rango} icono={cara.icon} ganado={ganada} avance={avance} />;

  const contenido = (
    <>
      {trofeo}
      <AtlasText variant="captionStrong" tone={ganada ? 'primary' : 'secondary'} align="center" numberOfLines={2}>
        {cara.label}
      </AtlasText>
      <View style={[styles.rango, ganada ? { borderColor: m.medio } : null]}>
        <AtlasText variant="micro" tone={ganada ? 'primary' : 'tertiary'} align="center" style={ganada ? { color: m.luz } : undefined}>
          {pie}
        </AtlasText>
      </View>
    </>
  );

  const etiqueta = `Insignia de ${m.nombre.toLowerCase()}: ${cara.label}. ${ganada ? 'Ganado' : cara.oculta ? 'Secreto' : `Pendiente, ${avanceDeInsignia(insignia)}`}. ${cara.detail}`;

  if (onPress)
    return (
      <Pressable
        style={styles.celda}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta} Toca para ver su carta.`}
        testID={`insignia-${insignia.code}`}
      >
        {contenido}
      </Pressable>
    );
  return (
    <View style={styles.celda} accessible accessibilityLabel={etiqueta} testID={`insignia-${insignia.code}`}>
      {contenido}
    </View>
  );
}

const styles = StyleSheet.create({
  celda: { width: '33.33%', alignItems: 'center', gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.xs },
  rango: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: stroke.hairline,
    borderColor: color.border.hairline,
  },
});
