/**
 * «Prefiero explicarlo con mi voz»: un audio corto contando a que se dedica la persona.
 *
 * Copiado de quien lo hacia bien. Es accesible —hay gente que explica mejor hablando que
 * escribiendo— y es dificil de guionar: la voz de alguien contando su trabajo con sus palabras es
 * una señal de coherencia que un formulario no da. Lo escucha el analista (decision R3 del plan del
 * 2026-09-17: sin transcripcion automatica en v1).
 *
 * Tope de 60 s: mas que eso no cabe en «cuentanos a que te dedicas» y pesa demasiado para subirlo
 * desde una red movil. Se graba en m4a (AAC), que es lo que el servidor verifica por firma.
 */
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { describeError } from '../api/errors';
import { subirEvidenciaDeApoyo } from '../features/evidencia-de-apoyo';
import { bitacora } from '../features/bitacora';
import { space } from '../theme/tokens';
import { AtlasText, Badge, Button, Card, CardHeader } from './primitives';

const TOPE_SEGUNDOS = 60;

export function GrabadorDeOcupacion({ customerId }: { customerId: string }) {
  const grabador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const estado = useAudioRecorderState(grabador, 500);
  const [subiendo, setSubiendo] = useState(false);
  const [subido, setSubido] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sinPermiso, setSinPermiso] = useState(false);

  const segundos = Math.floor((estado.durationMillis ?? 0) / 1000);

  // Al llegar al tope se detiene sola: el tope es del producto, no del sistema.
  useEffect(() => {
    if (estado.isRecording && segundos >= TOPE_SEGUNDOS) void detener();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.isRecording, segundos]);

  const empezar = async () => {
    setError(null);
    setSinPermiso(false);
    try {
      const permiso = await AudioModule.requestRecordingPermissionsAsync();
      bitacora.permiso('microfono', permiso.granted ? 'concedido' : 'denegado');
      if (!permiso.granted) {
        setSinPermiso(true);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await grabador.prepareToRecordAsync();
      grabador.record();
      bitacora.captura('liveness', 'abre');
    } catch (caught) {
      setError(caught);
    }
  };

  const detener = async () => {
    try {
      await grabador.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = grabador.uri;
      if (!uri) return;
      setSubiendo(true);
      await subirEvidenciaDeApoyo({ customerId, kind: 'occupation_audio', localUri: uri, note: 'ocupacion en voz' });
      setSubido(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubiendo(false);
    }
  };

  const described = error ? describeError(error) : null;

  // En el navegador se graba en webm/opus, que el servidor no verifica: la tarjeta no se ofrece.
  if (Platform.OS === 'web') return null;

  return (
    <Card>
      <CardHeader
        icon="telefono"
        title="Prefiero explicarlo con mi voz"
        detail="Graba hasta un minuto contando a qué te dedicas y cómo generas ingresos. Lo escucha la persona que revisa tu solicitud."
        divider={false}
        trailing={subido ? <Badge label="grabado" tone="success" /> : undefined}
      />
      <View style={styles.acciones}>
        {sinPermiso ? (
          <AtlasText variant="caption" tone="warning">
            Sin permiso de micrófono no se puede grabar. Puedes escribirlo arriba.
          </AtlasText>
        ) : null}
        {described ? (
          <AtlasText variant="caption" tone="warning">
            {described.title}: {described.detail}
          </AtlasText>
        ) : null}
        {estado.isRecording ? (
          <>
            <AtlasText variant="amountSmall" tone={segundos > TOPE_SEGUNDOS - 10 ? 'warning' : 'primary'}>
              {`0:${String(segundos).padStart(2, '0')}`}
            </AtlasText>
            <Button label="Detener y enviar" bitacora="grabar_audio" onPress={() => void detener()} loading={subiendo} />
          </>
        ) : (
          <Button label={subido ? 'Grabar de nuevo' : 'Grabar audio'} bitacora="grabar_audio" variant={subido ? 'ghost' : 'secondary'} onPress={() => void empezar()} loading={subiendo} disabled={subiendo} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  acciones: { gap: space.sm, marginTop: space.sm },
});
