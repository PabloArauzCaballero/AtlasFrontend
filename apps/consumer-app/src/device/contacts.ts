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
import { Contact, Fields, getContactsAsync, requestPermissionsAsync } from 'expo-contacts';
import { Platform } from 'react-native';
import {
  agendaNoCompartida,
  contarAgenda,
  normalizarTelefono,
  VERSION_ALGORITMO,
  type ResumenDeAgenda,
} from '../features/agenda';
import { hashSensitiveText } from './device';

export type ContactoElegido = { nombre: string | null; telefono: string | null };

/**
 * Solo digitos: la agenda guarda «+591 7 650-0122» y el formulario espera el numero nacional.
 *
 * Delega en `features/agenda.ts` para que la normalizacion sea UNA en toda la app. Tuvo dos copias
 * —esta y la del resumen de agenda— y basta con que se separen para que el hash de una referencia
 * deje de cruzar con el de su propio contacto: el cruce no encuentra nada, la señal queda en cero y
 * nada lo delata.
 */
const soloDigitos = normalizarTelefono;

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

/* ------------------------------------------------------------------ agenda */

/**
 * El RESUMEN de la agenda, calculado aqui y no en el servidor.
 *
 * ## Por que existe, si arriba se dice que la app no recorre la agenda
 *
 * Porque son dos cosas distintas y solo una de ellas se manda. `elegirContacto` lee UNA ficha para
 * rellenar dos campos. Esto recorre la agenda entera y **no manda ni un solo contacto**: manda
 * cuentas y proporciones. La agenda no sale del telefono; sale su forma.
 *
 * La diferencia importa porque las personas de tu agenda no consintieron nada, no son clientes
 * nuestros y muchas ni saben que existimos. Copiar sus nombres y telefonos «para analizar el
 * riesgo» es recoger datos de cientos de terceros para decidir sobre uno. Contar cuantos hay no lo
 * es.
 *
 * ## Que se calcula aqui y por que no puede calcularlo el servidor
 *
 * `referencesFoundInAddressBook` — cuantas de las referencias que la persona declaro estan
 * realmente en su agenda. Es la señal que mas informa de todas: quien declara como referencia a
 * alguien cuyo telefono no tiene guardado esta declarando a alguien con quien no habla. Calcularla
 * en el servidor exigiria mandarle los telefonos de la agenda. Aqui es una comparacion local y lo
 * que viaja es un numero entre cero y dos.
 *
 * ## Los hashes, que son la unica excepcion
 *
 * Hay una señal que el telefono no puede calcular solo: si en la agenda hay numeros que el sistema
 * ya conoce por otros expedientes. Eso exige cruzar contra datos del servidor, asi que se mandan
 * SHA-256 de cada numero normalizado. El servidor los cruza, se queda con la CUENTA y los descarta
 * —no los persiste, no los registra—. Un hash de telefono es reversible por fuerza bruta, y por eso
 * ese descarte no es una optimizacion sino el control que hace defendible pedirlos.
 *
 * ## Donde vive el CRITERIO
 *
 * En `features/agenda.ts`, que es puro y tiene pruebas. Aqui queda solo lo que habla con el
 * telefono: pedir el permiso, recorrer las fichas y calcular los hashes. Es el mismo reparto que
 * `device/` y `features/` mantienen en el resto de la app, y aqui ademas es lo unico que permite
 * probar la normalizacion sin doblar cinco modulos nativos.
 */
export type { ResumenDeAgenda } from '../features/agenda';

/**
 * Recorre la agenda y devuelve su forma. Nunca devuelve un contacto.
 *
 * `telefonosDeReferencias` son los numeros que la persona acaba de declarar en el formulario, tal
 * como los escribio: se normalizan con la MISMA funcion que los de la agenda para que la
 * comparacion signifique algo.
 *
 * Si la persona dice que no, devuelve el vacio explicito y **eso tambien se manda**: negarse es una
 * respuesta legitima, y registrarla es lo que permite distinguirla de una version de la app que ni
 * lo preguntaba.
 */
export async function resumirAgenda(
  telefonosDeReferencias: readonly string[],
): Promise<ResumenDeAgenda> {
  const declaradas = telefonosDeReferencias.filter(
    (valor) => normalizarTelefono(valor) !== null,
  ).length;
  const ahora = new Date().toISOString();

  try {
    const permiso = await requestPermissionsAsync();
    if (!permiso.granted) return agendaNoCompartida(declaradas, ahora);

    /*
      Solo el campo de TELEFONOS. `expo-contacts` permite pedir la ficha entera —nombre, correo,
      direccion, fecha de nacimiento, notas— y no se pide nada de eso: lo que no se lee no se puede
      filtrar mal, no ocupa memoria y no aparece en un volcado si la app se cae.
    */
    const { data } = await getContactsAsync({ fields: [Fields.PhoneNumbers] });

    const porContacto = data.map((contacto) =>
      (contacto.phoneNumbers ?? [])
        .map((entrada) => normalizarTelefono(entrada.number))
        .filter((numero): numero is string => numero !== null),
    );
    const { contactsWithPhone, uniques, bolivianPhoneCount } = contarAgenda(porContacto);

    /*
      Los hashes se calculan con la MISMA convencion que el servidor usa para guardar un telefono
      (`hashSensitiveText` = sha256 sobre el valor recortado y en minusculas). Si divergieran, el
      cruce no encontraria nunca nada y la señal quedaria muerta sin que nada lo delatara.
    */
    const hashes = await Promise.all(uniques.map((numero) => hashSensitiveText(numero)));
    const hashesDeclarados = await Promise.all(
      telefonosDeReferencias
        .map((valor) => normalizarTelefono(valor))
        .filter((numero): numero is string => numero !== null)
        .map((numero) => hashSensitiveText(numero)),
    );
    const enAgenda = new Set(hashes);

    return {
      permiso: true,
      algorithmVersion: VERSION_ALGORITMO,
      computedAt: ahora,
      totalContacts: data.length,
      contactsWithPhone,
      uniquePhoneCount: uniques.length,
      bolivianPhoneCount,
      referencesFoundInAddressBook: hashesDeclarados.filter((hash) => enAgenda.has(hash)).length,
      referencesDeclared: declaradas,
      phoneHashes: hashes,
    };
  } catch {
    /*
      Un fallo del modulo no puede tumbar el alta. Se devuelve el vacio explicito, que el servidor
      registra como «no disponible» y el artefacto pondera como menos evidencia — nunca como
      evidencia en contra de la persona.
    */
    return agendaNoCompartida(declaradas, ahora);
  }
}
