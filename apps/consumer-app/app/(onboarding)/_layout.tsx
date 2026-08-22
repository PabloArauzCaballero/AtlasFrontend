/**
 * Area de registro.
 *
 * `registro` es publico —ahi es donde nace la cuenta— y el resto exige sesion. Sin esta guarda, un
 * enlace profundo a cualquier paso intermedio abriria una pantalla que pide datos de un cliente que
 * todavia no existe.
 */
import { Redirect, Stack, usePathname } from 'expo-router';
import { useSession } from '../../src/session/session';
import { color } from '../../src/theme/tokens';

const PUBLIC_STEPS = ['/registro'];

export default function OnboardingLayout() {
  const session = useSession();
  const pathname = usePathname();

  if (session.status === 'restoring') return null;

  const isPublicStep = PUBLIC_STEPS.some((step) => pathname.endsWith(step));
  if (session.status !== 'authenticated' && !isPublicStep) return <Redirect href="/(public)/bienvenida" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.surface.primary },
        // Misma correccion que en la raiz: `slide_from_right` es solo Android en Expo 57 y renuncia
        // al empuje nativo de iOS. En un formulario de ocho pasos es donde mas se nota, porque el
        // gesto interactivo de volver es como se corrige un dato del paso anterior.
        animation: 'default',
      }}
    />
  );
}
