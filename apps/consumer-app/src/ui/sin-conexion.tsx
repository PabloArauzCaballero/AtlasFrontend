/**
 * La pantalla de «sin conexión»: el logo de Atlas girando, como el cargando de siempre, y una frase que dice qué pasa
 * y que se reintenta sola (Pablo, 2026-10-08). Se monta sobre toda la ventana mientras `conexion.ts` confirma que no
 * hay red, y se va sola cuando vuelve: la persona no tiene que tocar nada.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { escucharConexion, haySinConexion } from '../api/conexion';
import { color, space } from '../theme/tokens';
import { AnilloAtlas } from './cargador-atlas';
import { AtlasText } from './primitives';

export function useSinConexion(): boolean {
  const [sin, setSin] = useState(haySinConexion);
  useEffect(() => escucharConexion(setSin), []);
  return sin;
}

export function CapaSinConexion() {
  const sin = useSinConexion();
  if (!sin) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(220)}
      style={styles.capa}
      accessibilityRole="alert"
      accessibilityLabel="Sin conexión a internet. Reintentando solo."
      testID="sin-conexion"
    >
      <View style={styles.centro}>
        <AnilloAtlas tamano="bloque" />
        <AtlasText variant="h2" style={styles.texto}>
          Sin conexión
        </AtlasText>
        <AtlasText variant="body" tone="secondary" style={styles.texto}>
          Revisa tu internet. Seguimos intentando y en cuanto vuelva la conexión, sigues donde estabas.
        </AtlasText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  capa: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: color.surface.primary, zIndex: 1000, elevation: 1000 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.xl },
  texto: { textAlign: 'center' },
});
