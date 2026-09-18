/**
 * Una tarjeta para ADJUNTAR una evidencia de apoyo: elegirla, subirla y ver que quedo registrada.
 *
 * Es opcional siempre, y la tarjeta lo dice. Tres estados: sin adjuntar (boton), subiendo, y
 * adjuntada (con la opcion de cambiarla). Un fallo se pinta en la propia tarjeta con su motivo, sin
 * bloquear el guardado de la pantalla que la contiene: lo que se guarda alli no depende de esto.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { describeError } from '../api/errors';
import { elegirDocumento, elegirImagen, subirEvidenciaDeApoyo, type EvidenciaDeApoyo } from '../features/evidencia-de-apoyo';
import { space } from '../theme/tokens';
import { AtlasText, Badge, Button, Card, CardHeader } from './primitives';

export function AdjuntoDeApoyo({
  customerId,
  kind,
  titulo,
  detalle,
  bitacora,
  origen,
}: {
  customerId: string;
  kind: 'bank_qr_proof' | 'proof_of_address';
  titulo: string;
  detalle: string;
  /** Codigo del boton en la bitacora del alta. */
  bitacora: 'subir_qr' | 'subir_factura';
  /** De donde sale el archivo: la galeria de fotos o el selector de documentos (PDF o imagen). */
  origen: 'imagen' | 'documento';
}) {
  const [adjunto, setAdjunto] = useState<EvidenciaDeApoyo | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const adjuntar = async () => {
    setError(null);
    try {
      const uri = origen === 'imagen' ? await elegirImagen() : await elegirDocumento();
      if (!uri) return;
      setSubiendo(true);
      setAdjunto(await subirEvidenciaDeApoyo({ customerId, kind, localUri: uri }));
    } catch (caught) {
      setError(caught);
    } finally {
      setSubiendo(false);
    }
  };

  const described = error ? describeError(error) : null;

  return (
    <Card>
      <CardHeader
        icon={kind === 'bank_qr_proof' ? 'billetera' : 'hogar'}
        title={titulo}
        detail={detalle}
        divider={false}
        trailing={adjunto ? <Badge label="adjuntado" tone="success" /> : undefined}
      />
      <View style={styles.acciones}>
        {described ? (
          <AtlasText variant="caption" tone="warning">
            {described.title}: {described.detail}
          </AtlasText>
        ) : null}
        <Button
          label={adjunto ? 'Cambiar archivo' : origen === 'imagen' ? 'Elegir imagen' : 'Elegir archivo'}
          bitacora={bitacora}
          variant={adjunto ? 'ghost' : 'secondary'}
          onPress={() => void adjuntar()}
          loading={subiendo}
          disabled={subiendo}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  acciones: { gap: space.sm, marginTop: space.sm },
});
