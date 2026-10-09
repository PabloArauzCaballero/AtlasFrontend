/** El hogar del comercio es Gestión POS, como en la web (`HOME_FOR_AUDIENCE.merchant`). */
import { Redirect } from 'expo-router';
import { useSession } from '@/session/session';

export default function Index() {
  const { status } = useSession();
  return <Redirect href={status === 'authenticated' ? '/gestion-pos' : '/ingresar'} />;
}
