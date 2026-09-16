/**
 * El área de acceso en el NAVEGADOR: la composición de `login.html`.
 *
 * Dos columnas: el formulario (la misma pantalla del teléfono, sin cambios) a la izquierda con la
 * marca y «Volver al sitio» arriba; a la derecha la tarjeta de cuenta 3D, la cita y las cifras.
 * Por debajo de 940 px la columna derecha desaparece y por debajo de 600 la cabecera también: es
 * la app. Expo Router elige este archivo en web y `_layout.tsx` en iOS/Android.
 */
import { Stack } from 'expo-router';
import { CabeceraDeAcceso, PanelDeAcceso } from '../../src/web/PanelLateral';

export default function AuthLayout() {
  return (
    <div className="auth">
      <div className="auth__main">
        <CabeceraDeAcceso volverA="/bienvenida" etiqueta="Volver a la bienvenida" />
        <div className="auth__pantalla">
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
        </div>
      </div>
      <PanelDeAcceso />
    </div>
  );
}
