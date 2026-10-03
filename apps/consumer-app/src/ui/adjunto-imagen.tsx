/**
 * La imagen de un adjunto, dentro de la burbuja.
 *
 * Antes se pintaba sólo un chip con el nombre del archivo («FOTO.JPG»): quien envió la foto no podía
 * comprobar que había salido bien. Se descarga con la sesión (`readAttachment`: la ruta es autenticada
 * y un `<Image uri>` no manda cabeceras) y se guarda en memoria por id, porque el chat consulta cada
 * 4 s y sin caché bajaría la misma foto una y otra vez.
 */
import { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, View } from 'react-native';
import { readAttachment, type SupportAttachment } from '../api/endpoints/support';
import { color, radius, space } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface } from './motion';
import { AtlasText, Badge, Skeleton } from './primitives';

const CACHE = new Map<string, string>();
/** Sólo para pruebas: cada caso parte sin imágenes guardadas. */
export const vaciarCacheDeAdjuntos = () => CACHE.clear();

type Estado = { fase: 'cargando' } | { fase: 'lista'; uri: string } | { fase: 'fallo' };

export function AdjuntoImagen({ adjunto }: { adjunto: SupportAttachment }) {
  const [estado, setEstado] = useState<Estado>(() => {
    const guardada = CACHE.get(adjunto.attachmentId);
    return guardada ? { fase: 'lista', uri: guardada } : { fase: 'cargando' };
  });
  const [grande, setGrande] = useState(false);
  const revisada = adjunto.scanStatus !== 'pending' && adjunto.scanStatus !== 'infected' && adjunto.scanStatus !== 'rejected';

  useEffect(() => {
    if (!revisada || estado.fase === 'lista') return;
    let cancelado = false;
    void readAttachment(adjunto.attachmentId).then((uri) => {
      if (cancelado) return;
      if (uri) {
        CACHE.set(adjunto.attachmentId, uri);
        setEstado({ fase: 'lista', uri });
      } else {
        setEstado({ fase: 'fallo' });
      }
    });
    return () => {
      cancelado = true;
    };
  }, [adjunto.attachmentId, revisada, estado.fase]);

  // Una imagen todavía en revisión (o rechazada) NO se pinta: el servidor no la entrega y el motivo se dice.
  if (!revisada) {
    const motivo = adjunto.scanStatus === 'pending' ? 'Revisando la imagen…' : 'No se pudo mostrar esta imagen';
    return <Badge label={`${motivo}`} tone={adjunto.scanStatus === 'pending' ? 'info' : 'warning'} />;
  }
  if (estado.fase === 'cargando') return <Skeleton height={160} width={220} />;
  if (estado.fase === 'fallo') return <Badge label={`📎 ${adjunto.filename}`} tone="info" />;

  return (
    <>
      <PressSurface
        onPress={() => setGrande(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Ver la foto ${adjunto.filename} en grande`}
        testID="adjunto-imagen"
      >
        <Image source={{ uri: estado.uri }} style={styles.imagen} resizeMode="cover" accessibilityLabel={`Foto ${adjunto.filename}`} />
      </PressSurface>
      <Modal visible={grande} transparent animationType="fade" onRequestClose={() => setGrande(false)}>
        <View style={styles.velo}>
          <Image source={{ uri: estado.uri }} style={styles.completa} resizeMode="contain" accessibilityLabel={`Foto ${adjunto.filename}`} />
          <PressSurface
            onPress={() => setGrande(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar la foto"
            style={styles.cerrar}
            testID="adjunto-cerrar"
          >
            <Icon name="cerrar" size={20} tint={color.text.primary} />
            <AtlasText variant="bodyStrong">Cerrar</AtlasText>
          </PressSurface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  imagen: { width: 220, height: 160, borderRadius: radius.md, backgroundColor: color.surface.raised },
  velo: { flex: 1, backgroundColor: color.overlay.scrim, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  completa: { width: '100%', height: '80%' },
  cerrar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.surface.raisedStrong,
  },
});
