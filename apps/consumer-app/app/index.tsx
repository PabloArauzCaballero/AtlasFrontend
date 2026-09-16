/**
 * Puerta de entrada.
 *
 * Decide a que area entra la persona segun el estado REAL de su cuenta en el servidor, no segun lo
 * que la app recuerde. Mientras la sesion se restaura no redirige a ningun lado: el splash sigue
 * visible y no se ve ningun parpadeo.
 *
 * ## Los permisos van ANTES que todo lo demas
 *
 * Si a esta persona no se le ha preguntado nunca por la ubicacion y los contactos, lo primero que ve
 * es la pantalla que lo explica — antes de la bienvenida y antes del area autenticada. Es la unica
 * forma de que el dialogo del sistema salga con contexto, y iOS solo lo muestra una vez.
 *
 * La espera de esa lectura se trata como parte de la restauracion: se devuelve la misma pantalla
 * vacia, con el splash todavia encima, en vez de redirigir a un sitio para corregirlo un fotograma
 * despues.
 */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { leerDecisionDeArranque, type DecisionDeArranque } from '../src/session/permisos-de-arranque';
import { areaFor, useSession } from '../src/session/session';
import { color } from '../src/theme/tokens';

export default function IndexGate() {
  const session = useSession();
  /* `undefined` es «todavia no se sabe»; `null` es «nunca se le pregunto». No son lo mismo. */
  const [decision, setDecision] = useState<DecisionDeArranque | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    void leerDecisionDeArranque().then((valor) => {
      if (!cancelado) setDecision(valor);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  if (session.status === 'restoring' || decision === undefined) {
    return <View style={{ flex: 1, backgroundColor: color.surface.primary }} />;
  }
  /*
    En el navegador no hay permisos que pedir al arrancar: no existe la ubicacion continua ni la
    agenda, y la camara se pide donde se usa. La pantalla que los explica hablaria de dialogos que
    el navegador nunca va a mostrar, asi que en web se salta y no se guarda ninguna decision: no
    se le pregunto, y si un dia entra desde el telefono se le preguntara ahi.
  */
  if (decision === null && Platform.OS !== 'web') return <Redirect href="/(public)/permisos" />;

  const area = areaFor(session);
  if (area === 'auth') return <Redirect href="/(public)/bienvenida" />;
  if (area === 'onboarding') return <Redirect href="/(onboarding)/progreso" />;
  return <Redirect href="/(app)/(tabs)" />;
}
