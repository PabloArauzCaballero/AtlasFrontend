/**
 * Si la persona ya vio la presentación de Atlas en este teléfono.
 *
 * La primera vez la app abre la bienvenida, que cuenta qué es Atlas; a partir de ahí, quien no tiene
 * sesión entra directo a Ingresar, con «Crear una cuenta» a la vista (pedido de Pablo, 2026-10-06). Ver la
 * bienvenida cada vez que se cierra la sesión obliga a pasar cuatro páginas para llegar al PIN.
 *
 * Si el almacenamiento falla se prefiere MOSTRAR la bienvenida: repetir una presentación molesta menos que
 * dejar a alguien nuevo en una pantalla de PIN sin saber qué es la app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'atlas.presentacion-vista.v1';

export async function presentacionVista(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE)) !== null;
  } catch {
    return false;
  }
}

export async function marcarPresentacionVista(): Promise<void> {
  await AsyncStorage.setItem(CLAVE, new Date().toISOString()).catch(() => undefined);
}
