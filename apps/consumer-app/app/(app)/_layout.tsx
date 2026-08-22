/**
 * Area autenticada.
 *
 * Guarda de acceso: nadie entra aqui sin sesion valida y sin cuenta activa. La comprobacion se hace
 * contra el estado que devolvio el servidor, no contra una bandera guardada en el dispositivo.
 *
 * Es defensa en profundidad de interfaz, no de seguridad: la autorizacion real la aplica el backend
 * en cada peticion. Ocultar un boton nunca es un control de acceso.
 */
import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';
import { areaFor, useSession } from '../../src/session/session';
import { color } from '../../src/theme/tokens';

/**
 * Opciones de las pantallas que se presentan como tarea acotada.
 *
 * `presentation: 'modal'` es lo unico que hace falta en iOS: UIKit presenta una hoja que sube,
 * deja ver la pantalla de debajo detras y **se cierra arrastrandola**. Declarar ademas
 * `animation: 'slide_from_bottom'` no la mejora: la SUSTITUYE por un empujon desde abajo, y con el
 * se pierde el gesto de arrastre, que es como la mayoria de la gente cierra una hoja sin buscar el
 * boton.
 *
 * En Android `modal` equivale a `push`, asi que ahi el deslizamiento desde abajo si aporta: es lo
 * unico que distingue «esto se abre y se cierra» de «esto es un paso mas del flujo».
 */
const TAREA_ACOTADA = {
  presentation: 'modal',
  animation: Platform.OS === 'android' ? ('slide_from_bottom' as const) : ('default' as const),
} as const;

export default function AppLayout() {
  const session = useSession();

  if (session.status === 'restoring') return null;

  const area = areaFor(session);
  if (area === 'auth') return <Redirect href="/(public)/bienvenida" />;
  if (area === 'onboarding') return <Redirect href="/(onboarding)/progreso" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.surface.primary },
        // Misma correccion que en la raiz y en el registro: `slide_from_right` esta documentado como
        // solo-Android en Expo 57, y forzarlo aqui cambia el empuje nativo de iOS —paralaje de la
        // pantalla de abajo, sombra, y sobre todo el gesto INTERACTIVO de volver— por un
        // deslizamiento plano. `default` devuelve a cada plataforma la suya.
        animation: 'default',
      }}
    >
      <Stack.Screen name="(tabs)" />
      {/* El flujo de compra se presenta como modal: es una tarea acotada que se abre y se cierra. */}
      <Stack.Screen name="compra/monto" options={TAREA_ACOTADA} />
      <Stack.Screen name="compra/[orderId]" />
      <Stack.Screen name="pago/[itemId]" options={TAREA_ACOTADA} />
    </Stack>
  );
}
