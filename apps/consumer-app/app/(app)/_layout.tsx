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
import { Platform, StyleSheet, View } from 'react-native';
import { areaFor, useSession } from '../../src/session/session';
import { color } from '../../src/theme/tokens';
import { AssistFab } from '../../src/ui/assist-fab';
import { CelebracionesHost } from '../../src/ui/celebraciones-host';
import { useTramo } from '../../src/ui/responsive';
import { BarraSuperior } from '../../src/web/Cascara';
import { webData } from '../../src/web/estilo';

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
  const tramo = useTramo();

  if (session.status === 'restoring') return null;

  const area = areaFor(session);
  /*
    Sin sesion, DIRECTO a la pantalla de entrada, y no a «/».

    «/» es ambiguo: lo son la puerta de entrada (`app/index.tsx`) y la pestaña Inicio
    (`app/(app)/(tabs)/index.tsx`). Desde DENTRO del area autenticada el router lo resolvia a Inicio, que
    volvia a montar esta guarda, que volvia a redirigir a «/»: un bucle de redirecciones (el error 185 de React,
    «Maximum update depth exceeded») que dejaba la app colgada en la portada al cerrar sesion o al
    caducar la sesion, hasta matarla (Pablo, 2026-10-09: «para hacer logout tenés que cerrar la app»).
    Reemplazar esta ruta por la de entrada vacia ademas toda la pila del area: hojas, compra, pago.
  */
  if (area === 'auth') return <Redirect href="/(auth)/ingresar" />;
  if (area === 'onboarding') return <Redirect href="/(onboarding)/progreso" />;

  /*
    En la WEB, desde 600 px, toda el area de cliente —pestanas, compra, pago, soporte, cuenta— va
    bajo la barra superior de la landing (`web/Cascara.tsx`) y con el pie del sitio. Por debajo, y
    en el telefono, la pila va sola.
  */
  const conCascara = Platform.OS === 'web' && tramo !== 'telefono';

  const pila = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: conCascara ? 'transparent' : color.surface.primary },
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
      {/* La pantalla de pago REAL (cuota de un préstamo del backend): misma presentación acotada. */}
      <Stack.Screen name="pagar/[installmentId]" options={TAREA_ACOTADA} />
    </Stack>
  );

  /*
    El boton del asistente va DESPUES de la pila y dentro del mismo contenedor: flota encima de
    cualquier pantalla del area autenticada y se monta UNA vez, no una por pantalla. El se quita
    solo donde estorba (soporte, tour, teclado, modales de pago) — ver `ui/assist-fab.tsx`.
  */
  if (!conCascara)
    return (
      <View style={styles.cascara}>
        {pila}
        <AssistFab />
        <CelebracionesHost />
      </View>
    );
  return (
    <View style={styles.cascara} {...webData('cascara', { area: 'app' })}>
      <BarraSuperior />
      {pila}
      <AssistFab />
      <CelebracionesHost />
    </View>
  );
}

const styles = StyleSheet.create({ cascara: { flex: 1 } });
