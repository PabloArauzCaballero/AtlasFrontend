/**
 * El `BotonPdf` del portal web: genera el PDF de la pantalla en el servidor (`documents/generate`) y
 * lo entrega con la hoja de compartir del teléfono. Si falla, lo dice en una alerta del sistema
 * (la web usa un toast con el mismo texto).
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { ActivityIndicator } from 'react-native';
import { color } from '@cliente/theme/tokens';
import { Button, IconButton } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { descargarPdf, nombreArchivoPdf, type DocumentoPdf } from '@/features/pdf';

/**
 * `compacto`: sólo el ícono de descarga, para la cabecera de la pantalla junto al avatar. Es la forma
 * por defecto en la app (Pablo, 2026-10-10): el botón gris a lo ancho en cada panel era el elemento
 * más grande de la pantalla para la acción que menos se usa.
 */
export function BotonPdf({ documento, label, filename, disabled, testID, compacto = false }: { documento: () => DocumentoPdf; label?: string; filename?: string; disabled?: boolean; testID?: string; compacto?: boolean }) {
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

  if (compacto) {
    if (generando) return <ActivityIndicator color={color.text.secondary} />;
    return <IconButton icon="descargar" label={label ?? 'Descargar PDF'} onPress={() => (disabled ? undefined : void descargar())} testID={testID ?? 'boton-pdf'} />;
  }

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
