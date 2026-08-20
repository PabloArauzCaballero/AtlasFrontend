/**
 * Limite del area de acceso: ingreso y recuperacion de contrasena.
 *
 * Existe porque sin `_layout` un grupo de Expo Router NO es un nodo de navegacion: sus pantallas
 * se aplanan al padre y quedan como `(auth)/ingresar`. El `Stack.Screen name="(auth)"` de la raiz
 * entonces apunta a una ruta que no existe, y el aviso «No route named "(auth)" exists in nested
 * children» sale en cada arranque. Aqui el grupo pasa a existir de verdad.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
