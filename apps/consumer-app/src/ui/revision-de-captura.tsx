/**
 * La vista previa de una foto del carnet, entre la camara (o el escaner) y la subida.
 *
 * ## Por que existe
 *
 * Antes la foto se subia en el acto y se veia despues, en el carrusel. Mirar la foto ANTES de mandarla
 * es lo que deja corregir a tiempo un reflejo sobre el numero o un borde cortado: la persona todavia
 * tiene el carnet en la mano y repetir cuesta un toque. Es el «revisa antes de enviar» de cualquier app
 * de banco.
 *
 * ## La pregunta «¿seguro que es tu carnet?»
 *
 * Si la foto no parece un carnet (`features/parece-carnet.ts`), «Usar esta foto» no sube: abre
 * `DudaDeCarnet`, que dice POR QUE sospechamos y deja elegir. La salida principal es repetir, porque
 * es lo que arregla el caso comun; «Si, es mi carnet» sube igual, porque la sospecha no es el juez.
 */
import { Image, StyleSheet, View } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { BottomSheet } from './help-sheet';
import { Icon } from './icons';
import { Screen, ScreenHeader } from './layout';
import { AtlasText, Button, Card } from './primitives';
import type { EvaluacionDeFoto } from '../features/parece-carnet';
import { PROPORCION_CARNET } from '../features/captura-del-carnet';

/** Alto maximo de la foto: deja ver la lista de chequeo sin desplazar en un telefono comun. */
const ALTO_MAXIMO_FOTO = 460;

export function RevisionDeCaptura({
  titulo,
  uri,
  ancho,
  alto,
  comprobaciones,
  ocupado = false,
  onUsar,
  onRepetir,
}: {
  titulo: string;
  uri: string;
  /** Medidas de la foto si la cámara o el escáner las dieron; si no, se miden aquí. */
  ancho?: number;
  alto?: number;
  /** Lo que la persona tiene que poder ver en la foto, dicho como lista de chequeo. */
  comprobaciones: readonly string[];
  ocupado?: boolean;
  onUsar: () => void;
  onRepetir: () => void;
}) {
  // Sin medidas (algunas cámaras web no las dan) la foto se enseña con la forma del carnet y `contain`:
  // se ve entera aunque la proporción no sea exacta.
  const proporcion = ancho && alto ? ancho / alto : PROPORCION_CARNET;

  return (
    <Screen
      footer={
        <>
          <Button label="Usar esta foto" icon="check" onPress={onUsar} loading={ocupado} disabled={ocupado} testID="revision-usar" />
          <Button label="Repetir" icon="camara" variant="secondary" onPress={onRepetir} disabled={ocupado} testID="revision-repetir" />
        </>
      }
    >
      <ScreenHeader title={titulo} subtitle="Revisa la foto antes de enviarla." onBack={onRepetir} />
      <View style={styles.marco} testID="revision-de-captura">
        <Image
          source={{ uri }}
          style={[styles.foto, { aspectRatio: proporcion }]}
          resizeMode="contain"
          accessibilityLabel={`Vista previa: ${titulo}`}
        />
      </View>
      <Card>
        <AtlasText variant="label">Antes de seguir, comprueba que:</AtlasText>
        <View style={styles.lista}>
          {comprobaciones.map((texto) => (
            <View key={texto} style={styles.fila}>
              <Icon name="check" size={16} tint={color.action.primary} />
              <AtlasText variant="body" tone="secondary" style={styles.texto}>
                {texto}
              </AtlasText>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

/**
 * La pregunta cuando la foto no parece un carnet. Es una hoja y no un `Alert` porque tiene que decir
 * el motivo con espacio y funcionar igual en el telefono y en la web.
 */
export function DudaDeCarnet({
  evaluacion,
  onRepetir,
  onUsarIgual,
  onCerrar,
  alCerrarse,
}: {
  evaluacion: EvaluacionDeFoto | null;
  onRepetir: () => void;
  onUsarIgual: () => void;
  onCerrar: () => void;
  alCerrarse?: () => void;
}) {
  return (
    <BottomSheet visible={evaluacion !== null} titulo="¿Seguro que esta foto es tu carnet?" cierre="Cerrar" onClose={onCerrar} alCerrarse={alCerrarse}>
      <View style={styles.hoja} testID="duda-de-carnet">
        <AtlasText variant="body" tone="secondary">
          Nos parece que la imagen podría no ser tu carnet de identidad. Si la envías así, es probable que la verificación la rechace y tengas que
          repetir el paso.
        </AtlasText>
        {evaluacion?.motivos.map((motivo) => (
          <View key={motivo.senal} style={styles.fila}>
            <Icon name="info" size={16} tint={color.feedback.warning} />
            <AtlasText variant="body" style={styles.texto}>
              {motivo.texto}
            </AtlasText>
          </View>
        ))}
        <Button label="Tomar otra foto" icon="camara" onPress={onRepetir} testID="duda-repetir" />
        <Button label="Sí, es mi carnet: usar esta foto" variant="ghost" onPress={onUsarIgual} testID="duda-usar-igual" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  marco: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: color.surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight: ALTO_MAXIMO_FOTO,
  },
  foto: { width: '100%', maxHeight: ALTO_MAXIMO_FOTO },
  lista: { gap: space.sm, marginTop: space.sm },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  texto: { flex: 1 },
  hoja: { gap: space.md, padding: space.lg, paddingBottom: space.xl },
});
