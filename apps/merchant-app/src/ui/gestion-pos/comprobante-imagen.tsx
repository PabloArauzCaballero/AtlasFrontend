/**
 * El comprobante, en pantalla. Porte de `ComprobanteImagen` (`MerchantPaymentProofsScreen.tsx`).
 *
 * Sin esto el comercio decidía a ciegas: la tarjeta enseñaba el importe que el cliente DECLARÓ y la
 * referencia que el cliente ESCRIBIÓ —las dos las teclea la parte interesada— y ninguna prueba de la
 * transferencia. «Verificar y dar por pagado» registra un pago real contra el préstamo, así que
 * pulsarlo sin ver el papel no es verificar: es creer.
 *
 * La imagen se trae con la sesión (`apiBlobUrl` → `data:`), porque un `<Image uri>` apuntando a la
 * ruta del backend no lleva las cookies y daría 401, que se vería como una imagen rota —exactamente
 * el fallo que se lee como «el cliente no subió nada»—.
 *
 * Lo que cambia respecto a la web: allí pulsar la imagen la AMPLÍA dentro de la tarjeta (de 14 rem a
 * 36 rem de alto). En un teléfono la tarjeta ya ocupa el ancho entero y crecer en alto no deja leer
 * una cifra pequeña: se abre a pantalla completa, como la foto de un adjunto en el chat de la app del
 * cliente (`ui/adjunto-imagen.tsx`), y se cierra con «Cerrar».
 */
import { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { PressSurface } from '@cliente/ui/motion';
import { AtlasText, Skeleton } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { Aviso } from '@/ui/aviso';

export function ComprobanteImagen({
  partnerId,
  id,
  cargar,
}: {
  partnerId: string;
  /** `claimId` de una cuota, o `applicationId` de un pago inicial. */
  id: string;
  /** De dónde sale la imagen. Debe ser estable (a nivel de módulo): si cambia, se vuelve a pedir. */
  cargar: (partnerId: string, id: string) => Promise<string>;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setUri(null);
    setFallo(null);
    cargar(partnerId, id)
      .then((datos) => {
        // Un `data:` no hay que revocarlo (la web sí revoca su URL de blob): basta con no usarlo.
        if (!cancelado) setUri(datos);
      })
      .catch((error: unknown) => {
        if (!cancelado) setFallo(mensajeDeError(error, 'No se pudo cargar el comprobante.'));
      });
    return () => {
      cancelado = true;
    };
  }, [partnerId, id, cargar]);

  if (fallo) {
    return (
      <Aviso tono="warning" titulo="No se pudo mostrar el comprobante" testID={`comprobante-error-${id}`}>
        {`${fallo} Puede rechazarlo indicando que el comprobante no se lee.`}
      </Aviso>
    );
  }

  if (!uri) {
    return (
      <View accessible accessibilityLabel="Cargando comprobante">
        <Skeleton height={160} />
      </View>
    );
  }

  return (
    <View style={styles.figura}>
      <PressSurface
        onPress={() => setAmpliada(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Comprobante de transferencia ${id}. Ampliar`}
        style={styles.marco}
        testID={`comprobante-imagen-${id}`}
      >
        <Image source={{ uri }} style={styles.imagen} resizeMode="contain" accessibilityLabel={`Comprobante de transferencia ${id}`} />
      </PressSurface>
      <AtlasText variant="caption" tone="secondary">
        Pulse la imagen para ampliarla. Compruebe el monto, la fecha y la cuenta de destino antes de confirmar.
      </AtlasText>

      <Modal visible={ampliada} transparent animationType="fade" onRequestClose={() => setAmpliada(false)}>
        <View style={styles.velo}>
          <Image source={{ uri }} style={styles.completa} resizeMode="contain" accessibilityLabel={`Comprobante de transferencia ${id}`} />
          <PressSurface
            onPress={() => setAmpliada(false)}
            accessibilityRole="button"
            accessibilityLabel="Reducir"
            style={styles.cerrar}
            testID={`comprobante-cerrar-${id}`}
          >
            <Icon name="cerrar" size={20} tint={color.text.primary} />
            <AtlasText variant="bodyStrong">Cerrar</AtlasText>
          </PressSurface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  figura: { gap: space.sm },
  // El marco de la web (`border bg-slate-50 p-2`): la imagen se lee como un papel, no como decoración.
  marco: { padding: space.sm, borderRadius: radius.md, backgroundColor: color.surface.sunken },
  // 224 px = `max-h-56` de la web: cabe el comprobante entero sin empujar los botones fuera de la vista.
  imagen: { width: '100%', height: 224 },
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
