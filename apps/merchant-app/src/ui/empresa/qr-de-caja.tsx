/**
 * El QR de una caja en la pantalla (`QrCanvas` de la web), dibujado con react-native-qrcode-svg.
 *
 * Lleva el SERIAL del terminal y nada más (`contenidoDelQrDeCaja`), con el nivel de corrección de
 * la web (M), módulos #0f172a sobre blanco y su zona tranquila: sin ella un lector con el QR pegado
 * al borde de un fondo oscuro no encuentra los localizadores, y la app puede estar en modo oscuro.
 * Se genera en el teléfono y no se pide al backend: es una función pura del serial, y hacerla viajar
 * sólo añadiría una imagen que puede fallar justo cuando hay que enseñarla.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { color, radius, space } from '@cliente/theme/tokens';
import { AtlasText } from '@cliente/ui/primitives';
import { contenidoDelQrDeCaja, NIVEL_DE_CORRECCION } from '@/features/empresa/qr';
import { COLORES } from '@/features/empresa/cartel';

export function QrDeCaja({ serial, size }: { serial: string; size: number }) {
  const [invalido, setInvalido] = useState(false);
  if (invalido) {
    return (
      <View style={[styles.invalido, { width: size, height: size }]} testID="qr-invalido">
        <AtlasText variant="micro" tone="tertiary" align="center">
          No se pudo generar el código para este terminal.
        </AtlasText>
      </View>
    );
  }
  // Zona tranquila de ~4 módulos: un QR de versión 2 tiene 25; 4/33 del lado es lo que deja la web.
  const zona = Math.round((size * 4) / 33);
  return (
    <View testID="qr-terminal" accessibilityLabel={`QR de la caja ${serial}`} accessible>
      <QRCode
        value={contenidoDelQrDeCaja({ terminalSerial: serial })}
        size={size - zona * 2}
        quietZone={zona}
        ecl={NIVEL_DE_CORRECCION}
        color={COLORES.modulo}
        backgroundColor="#ffffff"
        onError={() => setInvalido(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  invalido: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border.subtle,
  },
});
