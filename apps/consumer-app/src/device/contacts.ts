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
import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { Platform } from 'react-native';
import {
  agendaNoCompartida,
  contarAgenda,
  normalizarTelefono,
  VERSION_ALGORITMO,
  type ResumenDeAgenda,
} from '../features/agenda';
import {
  aContactoParaEnviar,
  type ContactoDelTelefono,
  type ContactoParaEnviar,
} from '../features/rastreo';
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
      Solo el campo de TELEFONOS. La API permite pedir la ficha entera —nombre, correo, direccion,
      fecha de nacimiento, notas— y aqui no se pide nada de eso: lo que no se lee no se puede
      filtrar mal, no ocupa memoria y no aparece en un volcado si la app se cae. Quien pide mas
      campos es `leerAgendaCompleta`, que es otra cosa y exige otro consentimiento.

      `Contact.getAllDetails` y no `getContactsAsync`: en el SDK 57 la vieja esta deprecada y su
      propia declaracion avisa de que «will throw in runtime». Como esta funcion envuelve todo en un
      try/catch, ese fallo no se veia: devolvia el vacio explicito y el expediente quedaba con la
      agenda marcada como «no compartida» para TODO el mundo, hubiera dado permiso o no.
    */
    const fichas = await Contact.getAllDetails([ContactField.PHONES]);

    const porContacto = fichas.map((contacto) =>
      (contacto.phones ?? [])
        .map((entrada) => normalizarTelefono(entrada?.number))
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
      totalContacts: fichas.length,
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

/* --------------------------------------------------------- agenda completa */

/**
 * La agenda ENTERA, con una ficha MINIMA de cada contacto.
 *
 * ## Esto no es lo mismo que `resumirAgenda`, y la diferencia es toda
 *
 * `resumirAgenda` recorre la agenda y manda CUENTAS: la agenda no sale del telefono, sale su forma.
 * Esto SI saca contactos del telefono: nombre visible, numeros, si es favorito, el tipo y tres
 * banderas (tiene correo, tiene cumpleaños, tiene empresa), y los devuelve para que se suban y se
 * guarden. Ni el correo, ni la fecha, ni la razon social, ni cargo ni direcciones salen del telefono
 * (auditoria 2026-10-09, APP-03; ver `features/rastreo.ts`).
 *
 * Las dos siguen existiendo porque contestan preguntas distintas y porque una puede correr sin la
 * otra: el resumen viaja aunque la persona no autorice guardar las fichas, y es lo que evita que
 * negarse deje el expediente sin ninguna señal.
 *
 * ## Lo que esto exige, y no es solo el permiso del sistema
 *
 * Exige CONSENTIMIENTO para la finalidad `device_address_book`, que es otra cosa: el dialogo de iOS
 * solo prueba que alguien pulso «Permitir» en una caja que redacta Apple, sin decir que se le
 * prometio a cambio. El servidor rechaza la subida con 422 si no hay consentimiento vigente, asi que
 * el orden correcto —consentimiento primero, lectura despues— no depende de que el cliente se porte
 * bien. Ver `api/endpoints/device-signals.ts`.
 *
 * ## El acceso LIMITADO de iOS 18, que es la trampa de esta funcion
 *
 * Desde iOS 18 la persona puede conceder acceso a contactos SUELTOS. En ese caso el permiso sale
 * concedido —`granted` es cierto— pero `getAllDetails` devuelve solo los que eligio. Si eso se
 * subiera sin decirlo, el expediente diria «esta persona tiene 6 contactos» cuando lo cierto es
 * «esta persona nos dejo ver 6», y el motor leeria una señal sobre la persona donde hay una decision
 * sobre el permiso. Por eso se devuelve tambien el ALCANCE, y viaja al servidor.
 *
 * ## La foto del contacto NO se lee
 *
 * `ContactField.IMAGE` y `THUMBNAIL` existen y no se piden. Es el campo mas pesado con diferencia
 * —multiplicaria por veinte el tamaño de una sincronizacion— y el que menos dice sobre el riesgo de
 * nadie. El `id` no hay que pedirlo: `getAllDetails` lo devuelve siempre.
 */
export type AgendaLeida = {
  contactos: ContactoParaEnviar[];
  /** `limited` cuando iOS 18 concedio acceso solo a los contactos elegidos. */
  alcance: 'all' | 'limited';
};

export async function leerAgendaCompleta(): Promise<AgendaLeida | null> {
  try {
    const permiso = await requestPermissionsAsync();
    if (!permiso.granted) return null;

    /*
      Solo lo que la ficha minima necesita (`features/rastreo.ts`). Lo que no se lee no se puede subir
      por descuido: direcciones, cargo, notas y fotos no se piden al sistema.

      COMPANY, EMAILS y BIRTHDAY si se piden, pero SOLO para saber si existen: expo-contacts no tiene
      una consulta de «tiene o no tiene», asi que hay que leer el valor. `aContactoParaEnviar` lo
      reduce a un booleano en el acto; el valor no se guarda, no se registra y no viaja.
    */
    const fichas = await Contact.getAllDetails([
      ContactField.FULL_NAME,
      ContactField.GIVEN_NAME,
      ContactField.FAMILY_NAME,
      ContactField.COMPANY,
      ContactField.PHONES,
      ContactField.IS_FAVOURITE,
      ContactField.EMAILS,
      ContactField.BIRTHDAY,
    ]);

    return {
      contactos: fichas
        .map((contacto) => aContactoParaEnviar(contacto as ContactoDelTelefono))
        .filter((contacto): contacto is ContactoParaEnviar => contacto !== null),
      // `accessPrivileges` solo lo trae iOS; donde no existe, un permiso concedido es completo.
      alcance: permiso.accessPrivileges === 'limited' ? 'limited' : 'all',
    };
  } catch {
    /*
      Un fallo del modulo devuelve `null` y no una lista vacia, porque son cosas distintas: una lista
      vacia es «esta persona no tiene contactos» y `null` es «no se pudo leer». Confundirlas
      guardaria una agenda vacia como si fuera un hecho sobre esa persona.
    */
    return null;
  }
}
