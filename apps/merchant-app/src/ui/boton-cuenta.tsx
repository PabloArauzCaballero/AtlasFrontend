/**
 * El avatar de la cabecera: lleva a «Mi cuenta», como el avatar del portal web.
 */
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Avatar } from '@cliente/ui/primitives';
import { useSession } from '@/session/session';

export function BotonCuenta() {
  const router = useRouter();
  const { merchant } = useSession();
  const nombre = merchant?.fullName || merchant?.email || 'Comercio';
  return (
    <Pressable
      onPress={() => router.push('/cuenta')}
      accessibilityRole="button"
      accessibilityLabel="Mi cuenta"
      hitSlop={8}
      testID="boton-cuenta"
    >
      <Avatar name={nombre} size={36} />
    </Pressable>
  );
}
