/**
 * Lo que le pasa a una captura entre que sale de la camara (o del escaner) y queda guardada.
 *
 * ## Por que existe
 *
 * Porque la subida era un boton girando. Si el almacenamiento no respondia, el boton giraba ~60 s y
 * acababa en «Sin conexion», sin decir que estaba pasando, sin forma de cortar y con la foto perdida:
 * para reintentar habia que hacerla otra vez. Medido en el emulador el 2026-09-26.
 *
 * Ahora cada estado tiene su texto y su salida:
 *
 * - `subiendo`: que se esta subiendo y de que foto; a los pocos segundos, que tarda mas de lo normal.
 *   Siempre se puede cancelar.
 * - `fallo`: por que no se subio y, si repetir sirve, «Reintentar» con la MISMA foto —sigue en el
 *   telefono—. «Repetir la foto» por si la persona prefiere hacer otra.
 * - `rechazada`: la app no la subio porque sabe que el Motor no la podria leer (pequeña, o no es el
 *   carnet entero). Solo cabe repetirla.
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { AtlasText, Button, ErrorState } from './primitives';

export type EstadoDeSubida =
  | { fase: 'subiendo'; que: string; lenta: boolean }
  | { fase: 'fallo'; titulo: string; detalle: string; referencia?: string | null; puedeReintentar: boolean }
  | { fase: 'rechazada'; mensaje: string };

export function EstadoDeSubidaVista({
  estado,
  onCancelar,
  onReintentar,
  onRepetir,
}: Readonly<{
  estado: EstadoDeSubida;
  /** Corta la subida en curso. Sin el, la vista no pinta boton (la pantalla lo tiene en otro sitio). */
  onCancelar?: () => void;
  onReintentar?: () => void;
  onRepetir?: () => void;
}>) {
  if (estado.fase === 'subiendo') {
    return (
      <View style={styles.caja} accessibilityLiveRegion="polite" accessible accessibilityRole="progressbar">
        <View style={styles.fila}>
          <ActivityIndicator color={color.action.primary} />
          <View style={styles.texto}>
            <AtlasText variant="body">Subiendo {estado.que}…</AtlasText>
            <AtlasText variant="caption" tone="secondary">
              {estado.lenta
                ? 'Está tardando más de lo normal. Puedes esperar o cancelar y volver a intentarlo.'
                : 'Se guarda cifrada en tu expediente.'}
            </AtlasText>
          </View>
        </View>
        {onCancelar ? <Button label="Cancelar la subida" variant="ghost" haptic="none" onPress={onCancelar} /> : null}
      </View>
    );
  }

  if (estado.fase === 'rechazada') {
    return (
      <ErrorState
        title="Repite la foto"
        detail={estado.mensaje}
        actions={onRepetir ? <Button label="Repetir la foto" variant="secondary" onPress={onRepetir} /> : undefined}
      />
    );
  }

  return (
    <ErrorState
      title={estado.titulo}
      detail={estado.detalle}
      reference={estado.referencia}
      actions={
        <>
          {estado.puedeReintentar && onReintentar ? <Button label="Reintentar" icon="refrescar" variant="secondary" onPress={onReintentar} /> : null}
          {onRepetir ? <Button label="Repetir la foto" variant="ghost" onPress={onRepetir} /> : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  caja: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
    padding: space.base,
    gap: space.sm,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  texto: { flex: 1, gap: space.xxs },
});
