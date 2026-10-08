/**
 * Tu nivel Atlas: dónde estás, de dónde salen tus puntos, qué hacer para subir y cómo has evolucionado.
 *
 * Está partida en cuatro pestañas (Puntaje, Calificación, Logros, Historia) en `src/ui/progreso-pestanas.tsx`. Puntaje (puntos por
 * compra pagada, con la tarjeta) y Calificación (qué tan buen pagador) van SEPARADAS: son dos números distintos.
 *
 * ## La idea
 *
 * El puntaje de crédito suele ser un número opaco que sube o baja sin explicación. Aquí es un camino con
 * escalones: se ve el nivel, cuánto falta para el siguiente, qué conductas dan puntos y cuáles ya se cumplieron.
 *
 * ## Dos reglas
 *
 * 1. Nada aquí premia endeudarse. Los puntos vienen de pagar a tiempo, verificarse, cumplir compras y la
 *    antigüedad; pedir más crédito no suma ninguno, y la pantalla lo dice.
 * 2. El nivel existe aunque la línea de crédito todavía no se haya calculado: no depende del motor, así que
 *    nadie ve una pantalla vacía que parezca un fallo.
 */
import { StyleSheet, View } from 'react-native';
import { space } from '../../src/theme/tokens';
import { useState } from 'react';
import { useCreditBook } from '../../src/features/use-credit-book';
import { useAlVolver } from '../../src/features/al-volver';
import { useProgress } from '../../src/features/use-progress';
import { useSession } from '../../src/session/session';
import { Screen, ScreenHeader } from '../../src/ui/layout';
import { PestanaCalificacion, PestanaHistoria, PestanaLogros, PestanaPuntaje } from '../../src/ui/progreso-pestanas';
import { Chip, ChipBar, ErrorState, SkeletonLista } from '../../src/ui/primitives';

type Pestana = 'puntaje' | 'calificacion' | 'logros' | 'historia';

/**
 * Cada pestaña responde una pregunta. Sin icono a propósito: con icono los cuatro chips medían ~380 px y en un móvil de
 * 390 el cuarto caía solo a una segunda fila; sin él caben en una.
 */
const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'puntaje', label: 'Puntaje' },
  { id: 'calificacion', label: 'Calificación' },
  { id: 'logros', label: 'Logros' },
  { id: 'historia', label: 'Historia' },
];

export default function Progreso() {
  const session = useSession();
  const { fase, progress, recargar } = useProgress(session.customerId);
  const book = useCreditBook(session.customerId);
  // Al volver: puntos y calificación al día, y la pestaña abierta vuelve a contar sus cifras.
  const vuelta = useAlVolver(() => Promise.all([recargar(), book.reload()]));
  const [pestana, setPestana] = useState<Pestana>('puntaje');

  if (fase === 'cargando') {
    return (
      <Screen>
        <ScreenHeader title="Tu nivel Atlas" subtitle="Cómo subir y qué te falta." onBack="auto" />
        <SkeletonLista filas={4} alto={110} pantalla />
      </Screen>
    );
  }
  if (fase === 'fallo') {
    return (
      <Screen>
        <ScreenHeader title="Tu nivel Atlas" subtitle="Cómo subir y qué te falta." onBack="auto" />
        <ErrorState title="No pudimos cargar tu nivel" detail="Revisa tu conexión y vuelve a intentar." onRetry={() => void recargar()} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void recargar()}>
      <ScreenHeader title="Tu nivel Atlas" subtitle="Cómo subir y qué te falta." onBack="auto" />

      <ChipBar>
        {PESTANAS.map((p) => (
          <Chip key={p.id} label={p.label} selected={pestana === p.id} onPress={() => setPestana(p.id)} accessibilityLabel={`Pestaña ${p.label}`} />
        ))}
      </ChipBar>

      {/* `key` reinicia la entrada escalonada de cada pestaña al cambiar. */}
      <View key={pestana} style={styles.contenido}>
        {pestana === 'puntaje' ? <PestanaPuntaje key={`puntaje-${vuelta}`} progress={progress} /> : null}
        {pestana === 'calificacion' ? <PestanaCalificacion key={`calificacion-${vuelta}`} progress={progress} creditLine={book.creditLine ?? null} /> : null}
        {pestana === 'logros' ? <PestanaLogros progress={progress} /> : null}
        {pestana === 'historia' ? <PestanaHistoria progress={progress} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // La separación entre secciones la ponía el `gap` de `Screen`; al envolverlas hay que repetirla.
  contenido: { gap: space.base },
});
