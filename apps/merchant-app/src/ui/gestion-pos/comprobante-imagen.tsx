/**
 * El comprobante, en la tarjeta. Porte de `ComprobanteImagen` (`MerchantPaymentProofsScreen.tsx`).
 *
 * Sin esto el comercio decidía a ciegas: la tarjeta enseñaba el importe que el cliente DECLARÓ y la
 * referencia que el cliente ESCRIBIÓ —las dos las teclea la parte interesada— y ninguna prueba de la
 * transferencia. «Confirmar» registra un pago real contra el préstamo, así que pulsarlo sin ver el
 * papel no es verificar: es creer.
 *
 * La imagen se trae con la sesión (`apiBlobUrl` → `data:`), porque un `<Image uri>` apuntando a la
 * ruta del backend no lleva las cookies y daría 401, que se vería como una imagen rota —exactamente
 * el fallo que se lee como «el cliente no subió nada»—.
 *
 * Lo que cambia respecto a la web: allí la imagen va a lo ancho de la tarjeta (14 rem de alto) y
 * pulsarla la amplía DENTRO de la tarjeta. En el teléfono eso hacía de cada comprobante un bloque de
 * pantalla entera (Pablo, 2026-10-10: «mucho más claras»): aquí es una MINIATURA a la derecha del
 * importe, y pulsarla la abre a pantalla completa —como la foto de un adjunto en el chat de la app
 * del cliente (`ui/adjunto-imagen.tsx`)— con el aviso de la web debajo y «Cerrar».
 */
import { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { PressSurface } from '@cliente/ui/motion';
import { AtlasText, Skeleton } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';

/** El lado de la miniatura: lo bastante para reconocer un comprobante, no para leerlo (para eso se abre). */
const LADO = 72;

/** Trae la imagen. `cargar` debe ser estable (a nivel de módulo): si cambia, se vuelve a pedir. */
export function useImagenDeComprobante(partnerId: string, id: string, cargar: (partnerId: string, id: string) => Promise<string>, activa: boolean) {
  const [uri, setUri] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    if (!activa) return undefined;
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
  }, [partnerId, id, cargar, activa]);

  return { uri, fallo };
}

/**
 * La miniatura: cargando, la imagen (pulsable), o un hueco con el ícono de alerta si no se pudo traer
 * (el porqué lo dice la tarjeta debajo del importe, con el texto de la web).
 */
export function MiniaturaDeComprobante({ uri, fallo, id }: { uri: string | null; fallo: string | null; id: string }) {
  const [ampliada, setAmpliada] = useState(false);

  if (fallo) {
    return (
      <View style={[styles.miniatura, styles.hueco]} testID={`comprobante-error-${id}`} accessible accessibilityLabel="No se pudo mostrar el comprobante">
        <Icon name="alerta" size={22} tint={color.feedback.warning} />
      </View>
    );
  }

  if (!uri) {
    return (
      <View accessible accessibilityLabel="Cargando comprobante">
        <Skeleton height={LADO} width={LADO} />
      </View>
    );
  }

  return (
    <>
      <PressSurface
        onPress={() => setAmpliada(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Ver comprobante"
        style={styles.miniatura}
        testID={`comprobante-imagen-${id}`}
      >
        <Image source={{ uri }} style={styles.imagenMiniatura} resizeMode="cover" accessibilityLabel={`Comprobante de transferencia ${id}`} />
        <View style={styles.lupa}>
          <AtlasText variant="micro" tone="onBrand">
            Ver
          </AtlasText>
        </View>
      </PressSurface>

      <Modal visible={ampliada} transparent animationType="fade" onRequestClose={() => setAmpliada(false)}>
        <View style={styles.velo}>
          <Image source={{ uri }} style={styles.completa} resizeMode="contain" accessibilityLabel={`Comprobante de transferencia ${id}`} />
          <AtlasText variant="caption" tone="onBrand" align="center" style={styles.pie}>
            Compruebe el monto, la fecha y la cuenta de destino antes de confirmar.
          </AtlasText>
          <PressSurface
            onPress={() => setAmpliada(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={styles.cerrar}
            testID={`comprobante-cerrar-${id}`}
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
  miniatura: {
    width: LADO,
    height: LADO,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface.sunken,
  },
  hueco: { alignItems: 'center', justifyContent: 'center' },
  imagenMiniatura: { width: '100%', height: '100%' },
  // La palabra «Ver» sobre la foto: sin ella una miniatura se lee como decoración y no como un botón.
  lupa: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingVertical: space.xxs,
    backgroundColor: color.overlay.scrim,
  },
  velo: { flex: 1, backgroundColor: color.overlay.scrim, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  completa: { width: '100%', height: '75%' },
  pie: { marginTop: space.md },
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
