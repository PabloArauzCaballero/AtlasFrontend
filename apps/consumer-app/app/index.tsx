/**
 * Puerta de entrada.
 *
 * Decide a que area entra la persona segun el estado REAL de su cuenta en el servidor, no segun lo
 * que la app recuerde. Mientras la sesion se restaura no redirige a ningun lado: el splash sigue
 * visible y no se ve ningun parpadeo.
 *
 * ## Los permisos YA NO van antes que todo lo demas (2026-09-18)
 *
 * Se pedian al arrancar, antes de la bienvenida: a alguien que todavia no ha hecho nada se le pedian
 * la ubicacion y la agenda. Ahora son una seccion de la fase 3 del alta (`device_permissions`): la
 * persona ya tiene cuenta, ya vio su avance, y la pantalla sigue diciendo para que se piden y que se
 * puede decir que no. El servidor cierra la seccion con la decision, sea cual sea.
 */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { presentacionVista } from '../src/session/primera-vez';
import { areaFor, useSession } from '../src/session/session';
import { color } from '../src/theme/tokens';

export default function IndexGate() {
  const session = useSession();
  // `null` mientras se lee: decidir antes enseñaría la bienvenida un instante a quien ya la vio.
  const [vista, setVista] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void presentacionVista().then((valor) => {
      if (vivo) setVista(valor);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (session.status === 'restoring' || vista === null) {
    return <View style={{ flex: 1, backgroundColor: color.surface.primary }} />;
  }

  const area = areaFor(session);
  // La primera vez, qué es Atlas; después, directo a Ingresar.
  if (area === 'auth') return <Redirect href={vista ? '/(auth)/ingresar' : '/(public)/bienvenida'} />;
  if (area === 'onboarding') return <Redirect href="/(onboarding)/progreso" />;
  return <Redirect href="/(app)/(tabs)" />;
}
