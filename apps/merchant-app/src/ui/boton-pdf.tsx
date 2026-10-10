/**
 * El `BotonPdf` del portal web: genera el PDF de la pantalla en el servidor (`documents/generate`) y
 * lo entrega con la hoja de compartir del teléfono. Si falla, lo dice en una alerta del sistema
 * (la web usa un toast con el mismo texto).
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { descargarPdf, nombreArchivoPdf, type DocumentoPdf } from '@/features/pdf';

export function BotonPdf({ documento, label, filename, disabled, testID }: { documento: () => DocumentoPdf; label?: string; filename?: string; disabled?: boolean; testID?: string }) {
  const [generando, setGenerando] = useState(false);

  const descargar = async () => {
    setGenerando(true);
    try {
      const contenido = documento();
      await descargarPdf(contenido, filename ?? nombreArchivoPdf(contenido.title));
    } catch (error) {
      Alert.alert('No se pudo generar el PDF', mensajeDeError(error, 'Vuelve a intentarlo en un momento.'));
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Button
      label={label ?? 'Descargar PDF'}
      icon="descargar"
      variant="secondary"
      loading={generando}
      disabled={disabled ?? false}
      onPress={() => void descargar()}
      testID={testID ?? 'boton-pdf'}
    />
  );
}
