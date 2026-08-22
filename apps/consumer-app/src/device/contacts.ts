/**
 * Traer UNA referencia de la agenda del telefono.
 *
 * ## Por que existe
 *
 * Las dos referencias del alta se tecleaban de memoria, y un numero copiado de memoria sale mal a
 * menudo. Una referencia con un digito cambiado no es una referencia con un error: es una llamada
 * perdida el dia que hace falta, y ese dia es el de la gestion de cobranza.
 *
 * ## Que se lee, y que NO
 *
 * Se abre el selector del SISTEMA y se lee **el contacto que la persona elige**. La app no recorre
 * la agenda, no la copia, no la sube y no la guarda: de la ficha elegida se toman nombre y telefono
 * para rellenar dos campos que la persona ve y puede corregir antes de enviar.
 *
 * Esa diferencia —leer uno frente a leerlos todos— es la que separa una comodidad de una recogida
 * de datos, y es la que hace que el permiso se pueda pedir sin incomodar a nadie.
 *
 * ## Cuando se pide el permiso
 *
 * Al pulsar el boton, nunca antes. iOS pregunta **una sola vez**: si se pide al arrancar, cuando la
 * persona todavia no sabe para que, lo normal es que diga que no, y entonces la unica salida es un
 * viaje a los ajustes del sistema. Pedido en el momento en que se entiende el motivo, la respuesta
 * es otra.
 */
import { Contact, requestPermissionsAsync } from 'expo-contacts';
import { Platform } from 'react-native';

export type ContactoElegido = { nombre: string | null; telefono: string | null };

/** Solo digitos: la agenda guarda «+591 7 650-0122» y el formulario espera el numero nacional. */
function soloDigitos(valor: string | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 7) return null;
  /*
    Se quita el prefijo del pais si viene incluido: el campo de telefono de la app guarda solo los
    digitos nacionales —el prefijo vive en su propio selector— y pegarle un `591` delante produce un
    numero de once cifras que el backend rechaza sin explicar por que.
  */
  return digitos.startsWith('591') && digitos.length > 8 ? digitos.slice(3) : digitos;
}

/**
 * Abre el selector del sistema y devuelve el contacto elegido.
 *
 * `null` si la persona cancela o niega el permiso: las dos son decisiones suyas y ninguna es un
 * error que haya que contarle: el formulario sigue ahi para escribirlo a mano.
 */
export async function elegirContacto(): Promise<ContactoElegido | null> {
  try {
    const permiso = await requestPermissionsAsync();
    if (!permiso.granted) return null;

    /*
      `Contact.presentPicker()` es el selector NATIVO, y es la API vigente: la anterior
      —`presentContactPickerAsync`— sigue funcionando pero avisa por consola de que esta deprecada
      en esta version de Expo. Ademas de quitar el aviso, la clase nueva lee cada campo bajo demanda
      en vez de volcar la ficha entera, que encaja con lo unico que aqui se quiere: dos datos.

      En iOS eso importa mas de lo que parece: desde iOS 18 el sistema permite conceder acceso a
      contactos SUELTOS, y el selector es el camino que no obliga a la persona a elegir entre dar
      toda su agenda o nada.
    */
    const contacto = await Contact.presentPicker();
    if (!contacto) return null;

    const [nombrePila, apellido, telefonos] = await Promise.all([
      contacto.getGivenName().catch(() => null),
      contacto.getFamilyName().catch(() => null),
      contacto.getPhones().catch(() => []),
    ]);

    const nombre = [nombrePila, apellido].filter(Boolean).join(' ').trim() || null;
    const telefono = soloDigitos(telefonos[0]?.number);
    return { nombre, telefono };
  } catch {
    // Un fallo del modulo no puede tumbar el alta: el campo se escribe a mano y ya esta.
    return null;
  }
}

/** Si esta plataforma ofrece el selector. Hoy las dos, pero la pantalla no tiene por que saberlo. */
export const HAY_SELECTOR_DE_CONTACTOS = Platform.OS === 'ios' || Platform.OS === 'android';
