/**
 * Cierra la sesión tras 15 minutos sin actividad, avisando un minuto antes: `CierrePorInactividad`
 * del portal web, con los mismos textos.
 *
 * Actividad = cualquier toque en la app (se escucha en captura, sin quitarle el toque a nadie).
 * Volver a abrir la app NO cuenta como actividad: en el teléfono los relojes de JS se paran en
 * segundo plano, así que al volver se mide primero cuánto pasó y, si fueron más de 15 minutos, se
 * cierra. Es lo que hace la web en una pestaña que quedó abierta: su reloj sigue corriendo.
 *
 * Cerrar es un logout REAL (revoca la cookie de refresco), no olvidar el token: con la cookie viva,
 * reabrir la app devolvería la sesión entera. «Cerrar» o deslizar la hoja equivalen a «Seguir
 * trabajando»: la salida por omisión de un aviso no puede tirar el trabajo a medias.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { BottomSheet } from '@cliente/ui/help-sheet';
import { AtlasText, Button } from '@cliente/ui/primitives';
import { faseDeSesion } from './limites';
import { useSession } from './session';

export function ZonaConCierrePorInactividad({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, logout } = useSession();
  const activa = status === 'authenticated';
  const ultimaActividad = useRef(Date.now());
  const cerrando = useRef(false);
  const [segundos, setSegundos] = useState<number | null>(null);

  const tocar = useCallback(() => {
    ultimaActividad.current = Date.now();
  }, []);

  const seguir = useCallback(() => {
    tocar();
    setSegundos(null);
  }, [tocar]);

  const cerrar = useCallback(
    (motivo: 'inactividad' | 'usuario') => {
      if (cerrando.current) return;
      cerrando.current = true;
      setSegundos(null);
      void logout().finally(() => {
        cerrando.current = false;
        router.replace(motivo === 'inactividad' ? { pathname: '/ingresar', params: { aviso: 'inactividad' } } : '/ingresar');
      });
    },
    [logout, router],
  );

  const evaluar = useCallback(() => {
    const estado = faseDeSesion(ultimaActividad.current, Date.now());
    if (estado.fase === 'cerrar') cerrar('inactividad');
    else setSegundos(estado.fase === 'aviso' ? estado.segundos : null);
  }, [cerrar]);

  useEffect(() => {
    if (!activa) return;
    tocar();
    const reloj = setInterval(evaluar, 1_000);
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') evaluar();
    });
    return () => {
      clearInterval(reloj);
      suscripcion.remove();
    };
  }, [activa, evaluar, tocar]);

  return (
    <View
      style={styles.zona}
      onStartShouldSetResponderCapture={() => {
        tocar();
        return false;
      }}
    >
      {children}
      <BottomSheet visible={segundos !== null} titulo="Tu sesión va a cerrarse" onClose={seguir} cierre="Cerrar">
        <View style={styles.cuerpo}>
          <AtlasText variant="body" tone="secondary">
            Por seguridad, la sesión se cierra tras 15 minutos sin actividad.
          </AtlasText>
          <AtlasText variant="body" accessibilityRole="timer">
            {`Se cerrará en ${segundos ?? 0} s. Lo que no hayas guardado se perderá.`}
          </AtlasText>
          <Button label="Seguir trabajando" onPress={seguir} testID="seguir-trabajando" />
          <Button label="Cerrar sesión ahora" variant="secondary" icon="salir" onPress={() => cerrar('usuario')} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  zona: { flex: 1 },
  cuerpo: { gap: space.md },
});
