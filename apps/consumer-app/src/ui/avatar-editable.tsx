/**
 * El avatar de Perfil, que se toca para poner, cambiar o quitar la foto.
 *
 * Un toque abre las opciones del sistema (galería, cámara, quitar). Mientras sube, el círculo se atenúa con un
 * indicador encima; al terminar, la sesión se recarga y la foto nueva entra con su `?v=` (sin caché vieja). Un fallo se
 * dice con palabras y la foto anterior se queda donde estaba.
 */
import { useState } from 'react';
import { ActivityIndicator, ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { quitarFoto } from '../api/endpoints/customer';
import { elegirFoto, subirFotoDePerfil, useFuenteDeFoto, type Origen } from '../features/foto-de-perfil';
import { color, palette } from '../theme/tokens';
import { Icon } from './icons';
import { Avatar } from './primitives';

const TAMANO = 72;

export function AvatarEditable({
  nombre,
  customerId,
  actualizada,
  onCambio,
}: {
  nombre: string;
  customerId: string | null;
  /** `customer.profilePhotoUpdatedAt` de `me`: si es `null`, no hay foto. */
  actualizada: string | null | undefined;
  /** Tras subir o quitar: quien lo usa recarga la sesión para traer la fecha nueva. */
  onCambio: () => Promise<void> | void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const foto = useFuenteDeFoto(customerId, actualizada);
  const tieneFoto = Boolean(actualizada);

  const subir = async (origen: Origen) => {
    if (!customerId) return;
    try {
      const uri = await elegirFoto(origen);
      if (!uri) return;
      setOcupado(true);
      await subirFotoDePerfil(customerId, uri);
      await onCambio();
    } catch (error) {
      Alert.alert('No pudimos guardar tu foto', error instanceof Error && error.message ? error.message : 'Inténtalo de nuevo en un momento.');
    } finally {
      setOcupado(false);
    }
  };

  const quitar = async () => {
    if (!customerId) return;
    try {
      setOcupado(true);
      await quitarFoto(customerId);
      await onCambio();
    } catch {
      Alert.alert('No pudimos quitar tu foto', 'Inténtalo de nuevo en un momento.');
    } finally {
      setOcupado(false);
    }
  };

  const abrirOpciones = () => {
    if (ocupado || !customerId) return;
    const opciones = ['Elegir de la galería', 'Tomar una foto', ...(tieneFoto ? ['Quitar foto'] : []), 'Cancelar'];
    const elegir = (i: number) => {
      if (i === 0) void subir('galeria');
      else if (i === 1) void subir('camara');
      else if (tieneFoto && i === 2) void quitar();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opciones, cancelButtonIndex: opciones.length - 1, destructiveButtonIndex: tieneFoto ? 2 : undefined, title: 'Tu foto de perfil' },
        elegir,
      );
      return;
    }
    Alert.alert('Tu foto de perfil', undefined, [
      { text: 'Elegir de la galería', onPress: () => elegir(0) },
      { text: 'Tomar una foto', onPress: () => elegir(1) },
      ...(tieneFoto ? [{ text: 'Quitar foto', style: 'destructive' as const, onPress: () => elegir(2) }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  return (
    <Pressable
      onPress={abrirOpciones}
      accessibilityRole="button"
      accessibilityLabel={tieneFoto ? 'Cambiar tu foto de perfil' : 'Poner una foto de perfil'}
      accessibilityState={{ busy: ocupado }}
      hitSlop={6}
      testID="perfil-foto"
      style={({ pressed }) => [pressed && styles.pulsado]}
    >
      <View style={styles.marco}>
        <Avatar name={nombre} size={TAMANO} foto={foto} />
        {ocupado ? (
          <View style={styles.velo}>
            <ActivityIndicator color={palette.white} />
          </View>
        ) : null}
      </View>
      {/* La camarita: dice «esto se toca» sin un texto que lo explique. */}
      <View style={styles.insignia} pointerEvents="none">
        <Icon name={tieneFoto ? 'editar' : 'camara'} size={13} tint={color.text.onBrand} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  marco: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    borderWidth: 2,
    borderColor: 'rgba(92,240,204,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  velo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,10,20,0.55)', alignItems: 'center', justifyContent: 'center' },
  insignia: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand400,
    borderWidth: 2,
    borderColor: color.surface.primary,
  },
  pulsado: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
