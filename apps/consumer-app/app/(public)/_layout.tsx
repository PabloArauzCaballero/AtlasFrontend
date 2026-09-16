/**
 * Limite del area publica: lo unico que se puede ver sin cuenta.
 *
 * Mismo motivo que en `(auth)`: un grupo sin `_layout` no existe como ruta y el `Stack.Screen`
 * de la raiz queda colgando.
 */
import { Stack } from 'expo-router';

export default function PublicLayout() {
  // Fondo transparente: en web el navy lo pone el documento y encima va la atmósfera (aurora, grano).
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
