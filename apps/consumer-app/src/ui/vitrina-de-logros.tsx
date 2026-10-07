/**
 * La vitrina de logros: los trofeos agrupados por colección, con cuánto falta para lo más cercano.
 *
 * Dos ideas de conducta mandan aquí. La primera, el gradiente de meta: la gente acelera cuando ve cerca la meta, así que lo
 * más cercano a ganarse va ARRIBA, con su barra, antes que cualquier colección. La segunda, el cierre de colecciones: «2 de
 * 4 en Rachas» da una razón concreta para el siguiente paso. Las insignias secretas cuentan en el total pero no se
 * anticipan: enseñan su pista y un candado.
 *
 * Tocar un trofeo ganado repite su celebración: revivir lo ganado es parte del premio.
 */
import { StyleSheet, View } from 'react-native';
import type { Badge, Progress } from '../api/endpoints/credit-line';
import { logroDeInsignia, NOMBRE_COLECCION } from '../features/celebraciones';
import { repetirCelebracion } from '../features/celebraciones-bus';
import { avanceDeInsignia } from '../features/puntaje-explicado';
import { color, palette, space } from '../theme/tokens';
import { Insignia } from './insignia';
import { AtlasText, Card, ProgressBar, SectionHeader } from './primitives';

/** El trofeo sin ganar, no secreto, con más avance proporcional: lo que está a un paso. */
export function masCercano(badges: readonly Badge[]): Badge | null {
  const candidatas = badges.filter((b) => !b.earned && !b.secret && b.target > 0 && b.current > 0);
  if (candidatas.length === 0) return null;
  return candidatas.reduce((mejor, b) => (b.current / b.target > mejor.current / mejor.target ? b : mejor));
}

/** Las insignias por colección, en el orden de `NOMBRE_COLECCION`; sin `category` (backend anterior), todas en una. */
export function porColeccion(badges: readonly Badge[]): { clave: string; nombre: string; items: Badge[] }[] {
  const orden = Object.keys(NOMBRE_COLECCION);
  const grupos = new Map<string, Badge[]>();
  for (const b of badges) grupos.set(b.category ?? 'todas', [...(grupos.get(b.category ?? 'todas') ?? []), b]);
  return [...grupos.entries()]
    .sort(([a], [b]) => (orden.indexOf(a) === -1 ? 99 : orden.indexOf(a)) - (orden.indexOf(b) === -1 ? 99 : orden.indexOf(b)))
    .map(([clave, items]) => ({ clave, nombre: NOMBRE_COLECCION[clave] ?? 'Tus trofeos', items }));
}

export function VitrinaDeLogros({ progress }: { progress: Progress }) {
  const badges = progress.experience.badges;
  const ganadas = badges.filter((b) => b.earned).length;
  const cercano = masCercano(badges);
  const grupos = porColeccion(badges);
  let indice = 0;

  return (
    <View style={styles.vitrina}>
      <SectionHeader title="Tus trofeos" detail={`${ganadas} de ${badges.length} ganados · de bronce a diamante`} />
      <ProgressBar value={badges.length > 0 ? Math.round((ganadas / badges.length) * 100) : 0} label={`${ganadas} de ${badges.length} trofeos ganados`} />
      {cercano ? (
        <Card tone="brand" testID="logro-mas-cercano">
          <AtlasText variant="overline" tone="brand">
            LO MÁS CERCANO
          </AtlasText>
          <AtlasText variant="bodyStrong">{cercano.label}</AtlasText>
          <AtlasText variant="caption" tone="secondary">{`${cercano.detail} Llevas ${avanceDeInsignia(cercano)}.`}</AtlasText>
          <ProgressBar value={Math.round((cercano.current / cercano.target) * 100)} label={`Avance de ${cercano.label}`} />
        </Card>
      ) : null}
      {grupos.map((grupo) => {
        const hechas = grupo.items.filter((b) => b.earned).length;
        return (
          <View key={grupo.clave} style={styles.grupo} testID={`coleccion-${grupo.clave}`}>
            {grupo.clave === 'todas' ? null : (
              <View style={styles.cabecera}>
                <AtlasText variant="bodyStrong">{grupo.nombre}</AtlasText>
                <AtlasText variant="caption" tone={hechas === grupo.items.length ? 'brand' : 'tertiary'}>
                  {hechas === grupo.items.length ? 'Completa' : `${hechas} de ${grupo.items.length}`}
                </AtlasText>
              </View>
            )}
            {/* La vitrina: un fondo más hondo que el de las tarjetas, para que el metal de los trofeos brille. */}
            <Card style={styles.caja}>
              <View style={styles.rejilla} testID={grupo.clave === 'todas' ? 'insignias' : undefined}>
                {grupo.items.map((insignia) => {
                  const i = indice++;
                  return (
                    <Insignia
                      key={insignia.code}
                      insignia={insignia}
                      indice={i}
                      onPress={insignia.earned ? () => repetirCelebracion(logroDeInsignia(progress, insignia)) : undefined}
                    />
                  );
                })}
              </View>
            </Card>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  vitrina: { gap: space.md },
  grupo: { gap: space.sm },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: space.xs },
  caja: { backgroundColor: palette.bg, borderColor: color.feedbackBorder.brand },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
});
