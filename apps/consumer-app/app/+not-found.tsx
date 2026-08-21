/**
 * Ruta no encontrada.
 *
 * Existe sobre todo para los enlaces profundos: un enlace viejo de un correo o de una notificacion
 * no puede terminar en una pantalla en blanco.
 */
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader } from '../src/ui/layout';
import { Button, EmptyState } from '../src/ui/primitives';

export default function NotFound() {
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader title="No encontramos esa pantalla" />
      <EmptyState
        title="El enlace no es válido"
        detail="Puede que haya vencido o que ya no exista. Vuelve al inicio y continua desde ahi."
        action={<Button label="Ir al inicio" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
