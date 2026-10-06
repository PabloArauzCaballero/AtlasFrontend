/**
 * El registro en el NAVEGADOR: la composición de `registro.html`.
 *
 * Misma guarda que `_layout.tsx` (sólo `registro` es público) y misma pila; alrededor, las dos
 * columnas: el paso a la izquierda y, a la derecha, el panel pegajoso con la tarjeta que se arma,
 * los pasos y lo que ya está listo. Expo Router elige este archivo en web.
 */
import { Redirect, Stack, usePathname } from 'expo-router';
import { useSession } from '../../src/session/session';
import { CabeceraDeAcceso, PanelDelRegistro } from '../../src/web/PanelLateral';

const PUBLIC_STEPS = ['/registro'];

export default function OnboardingLayout() {
  const session = useSession();
  const pathname = usePathname();

  if (session.status === 'restoring') return null;

  const isPublicStep = PUBLIC_STEPS.some((step) => pathname.endsWith(step));
  if (session.status !== 'authenticated' && !isPublicStep) return <Redirect href="/" />;

  const nombre = session.me?.profile?.firstName ?? session.profile?.displayName ?? null;

  return (
    <div className="auth">
      <div className="auth__main">
        <CabeceraDeAcceso />
        <div className="auth__pantalla">
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'default' }} />
        </div>
      </div>
      <PanelDelRegistro pathname={pathname} nombre={nombre} />
    </div>
  );
}
