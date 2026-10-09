/**
 * La AGENDA COMPLETA y el RASTRO DE UBICACION, decididos aqui y ejecutados en `device/`.
 *
 * ## Que cambio respecto a `agenda.ts`, dicho sin rodeos
 *
 * `agenda.ts` calcula la FORMA de la agenda —cuentas y proporciones— y manda hashes de un solo uso
 * que el servidor cruza y descarta. Este modulo hace lo contrario: prepara una ficha por contacto
 * para que el servidor la guarde, y prepara posiciones fechadas para que las guarde tambien.
 *
 * ## La ficha es MINIMA (auditoria de seguridad 2026-10-09, APP-03)
 *
 * Son datos de TERCEROS que no consintieron nada. Viaja solo lo que el servidor usa de verdad: el
 * identificador del sistema (que el servidor hashea), el nombre visible, los numeros (de los que el
 * servidor saca los hashes que cruzan referencias y anillos de cuentas), si es favorito, el tipo
 * (persona o empresa, deducido aqui) y TRES BANDERAS: `hasEmail`, `hasBirthday` y `hasCompany`.
 *
 * Las banderas existen porque el servidor si usa algo de esos campos: si la ficha los TIENE. Una
 * agenda donde ninguna ficha tiene correo, cumpleaños ni empresa es la forma tipica de una agenda
 * fabricada (señal `AGENDA_UNIFORME` de AtlasBackend). Para calcularlas, el telefono lee esos campos
 * y los reduce a un si/no en el momento: el correo, la fecha, la razon social, el cargo, las
 * direcciones y las etiquetas de cada numero NO viajan, no se guardan y no se registran.
 *
 * Contrato con el servidor (AtlasBackend #245): con esta version, omitir `emails`, `birthday`,
 * `company`, etc. significa «no se sabe»; mandarlos como `null` o `[]` BORRARIA lo que hubiera
 * guardado de versiones anteriores. Por eso no se mandan de ninguna forma, ni vacios.
 *
 * Los dos siguen existiendo y no se pisan. El resumen viaja siempre, aunque la persona no autorice
 * guardar las fichas; la sincronizacion completa solo si autorizo las dos cosas —el permiso del
 * sistema Y el consentimiento—. Que el resumen siga saliendo es lo que permite que negarse no deje
 * el expediente sin ninguna señal.
 *
 * ## Por que este archivo es puro
 *
 * Por lo mismo que `agenda.ts`: en `device/` no se puede probar nada. Ese modulo importa
 * `expo-contacts`, `expo-location` y `expo-task-manager`, que bajo `jest-expo` ni se cargan. Aqui
 * queda el criterio —que campos viajan, como se trocea, cada cuanto se mide— y alli solo lo que
 * habla con el telefono.
 */

/**
 * Version del algoritmo de sincronizacion. Viaja a la fila del servidor. Sube al cambiar la forma.
 *
 * 2.0.0 (2026-10-09): ficha minima, sin correos, cumpleaños, empresa, cargo ni direcciones, y con las
 * banderas `hasEmail`/`hasBirthday`/`hasCompany` en su lugar. Es lo que deja distinguir en el servidor
 * «esta agenda no tiene correos» de «esta version ya no los manda».
 */
export const VERSION_AGENDA_COMPLETA = 'contacts-address-book-2.0.0';

/**
 * Contactos por peticion.
 *
 * El servidor acepta hasta 500, pero se manda de 100 en 100. Con 500 por peticion, UNA ficha que el
 * servidor rechazara tiraba las otras 499, y el servidor cifra cada ficha antes de contestar: un
 * lote grande en una red lenta pasaba de los 20 s del cliente y la app lo daba por perdido aunque el
 * servidor lo hubiera guardado. Con 100 se pierde poco por fallo y `subida-agenda.ts` aisla la
 * ficha mala.
 */
export const TAMANO_LOTE_AGENDA = 100;

/** Posiciones por peticion. El servidor acepta 200; el mismo tope evita un 400 por pasarse. */
export const TAMANO_LOTE_UBICACION = 200;

/**
 * Cada cuanto se mide con la app ABIERTA.
 *
 * Cinco minutos, y no menos: el GPS es lo que mas bateria consume de todo lo que hace esta app, y
 * medir cada minuto multiplicaria por cinco ese gasto para contar la misma historia. Alguien que
 * esta en su casa sigue en su casa cinco minutos despues.
 */
export const CADENCIA_PRIMER_PLANO_MS = 5 * 60 * 1000;

/**
 * Cada cuanto se mide con la app CERRADA, y cuanto hay que moverse para que cuente.
 *
 * Quince minutos es el minimo que Android respeta de verdad en segundo plano —por debajo, el sistema
 * agrupa los avisos y la cadencia real deja de ser la pedida—. Los cien metros son el filtro que
 * evita que un telefono quieto sobre una mesa genere noventa y seis posiciones identicas al dia.
 */
export const CADENCIA_SEGUNDO_PLANO_MS = 15 * 60 * 1000;
export const DISTANCIA_MINIMA_M = 100;

/**
 * La ficha que viaja al servidor. Es un SUBCONJUNTO de `deviceContactSchema` de AtlasBackend: todo lo
 * demas que ese esquema admite es opcional y aqui no se manda. Ver la cabecera.
 */
export type ContactoParaEnviar = {
  externalId: string;
  displayName: string | null;
  contactType: 'person' | 'company' | 'unknown';
  isFavorite: boolean;
  phones: { number: string }[];
  /** La ficha tiene al menos un correo no vacio. El correo no viaja. */
  hasEmail: boolean;
  /** La ficha tiene cumpleaños (con o sin año). La fecha no viaja. */
  hasBirthday: boolean;
  /** La ficha tiene razon social. La razon social no viaja. */
  hasCompany: boolean;
};

/**
 * La forma MINIMA de lo que devuelve `Contact.getAllDetails`, declarada aqui.
 *
 * Se declara estructuralmente y no importando el tipo de la libreria para que este archivo siga sin
 * tocar nada nativo y se pueda probar. Si la libreria cambia su forma, lo que falla es la
 * compilacion de `device/contacts.ts`, que es donde se debe notar.
 *
 * ## Es la API NUEVA, no la de siempre
 *
 * En el SDK 57 `getContactsAsync` esta deprecada y su propia declaracion avisa de que «will throw in
 * runtime». La vigente es `Contact.getAllDetails`, y su forma NO es la misma: el nombre completo es
 * `fullName` y no `name` y el favorito se escribe `isFavourite` a la britanica.
 */
export type ContactoDelTelefono = {
  id: string;
  fullName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  /** Se lee SOLO para deducir `contactType` y `hasCompany`; no viaja. */
  company?: string | null;
  isFavourite?: boolean | null;
  phones?: readonly ({ label?: string | null; number?: string | null } | null | undefined)[] | null;
  /** Se lee SOLO para `hasEmail`; no viaja. */
  emails?: readonly ({ address?: string | null } | null | undefined)[] | null;
  /** Se lee SOLO para `hasBirthday`; no viaja. */
  birthday?: { year?: number | null; month?: number | null; day?: number | null } | null;
};

const limpio = (valor: string | null | undefined): string | null => {
  const texto = (valor ?? '').trim();
  return texto === '' ? null : texto;
};

/**
 * De la ficha del telefono a la que viaja, descartando la que no tiene con que identificarse.
 *
 * Devuelve `null` para un contacto sin `id` y para uno sin NINGUN dato util —ni nombre ni telefono—. Las agendas reales estan llenas de fichas asi: restos de sincronizaciones de cuentas
 * que se quitaron. Mandarlas engordaria la cuenta de contactos de esa persona sin añadir nada, y esa
 * cuenta es una de las señales que el motor lee.
 *
 * `contactType` NO existe en la API nueva, asi que se deduce: una ficha con empresa y sin nombre de
 * persona es un comercio. Es la misma regla que usaba la libreria vieja y acierta en lo que importa
 * —distinguir «Ferreteria Sur» de «Maria Quispe»— sin pretender ser infalible.
 */
export function aContactoParaEnviar(contacto: ContactoDelTelefono): ContactoParaEnviar | null {
  const externalId = limpio(contacto.id);
  if (!externalId) return null;

  const phones = (contacto.phones ?? [])
    .map((entrada) => ({ number: limpio(entrada?.number) }))
    .filter((entrada): entrada is { number: string } => entrada.number !== null);

  const nombreDePersona = limpio([contacto.givenName, contacto.familyName].filter(Boolean).join(' '));
  const company = limpio(contacto.company);
  // La razon social solo hace de nombre cuando no hay otro: es lo que la persona ve en su agenda.
  const displayName = limpio(contacto.fullName) ?? nombreDePersona ?? company;
  if (!displayName && phones.length === 0) return null;

  return {
    externalId,
    displayName,
    contactType: company !== null && nombreDePersona === null ? 'company' : 'person',
    isFavorite: contacto.isFavourite === true,
    phones,
    // Solo si existen. Los valores se quedan aqui y mueren con esta funcion.
    hasEmail: (contacto.emails ?? []).some((entrada) => limpio(entrada?.address) !== null),
    hasBirthday: tieneFecha(contacto.birthday),
    hasCompany: company !== null,
  };
}

/** Un cumpleaños cuenta si tiene dia y mes; el año es opcional (iOS lo guarda a menudo sin el). */
const tieneFecha = (fecha: ContactoDelTelefono['birthday']): boolean =>
  typeof fecha?.month === 'number' && fecha.month > 0 && typeof fecha.day === 'number' && fecha.day > 0;

/* Los topes del contrato (`deviceContactSchema` de AtlasBackend). Pasarse de UNO rechaza el lote entero. */
const TOPE = { texto: 200, telefono: 40 } as const;
const TOPE_TELEFONOS = 20;

const recortar = (valor: string | null, max: number): string | null => {
  if (valor === null) return null;
  const texto = valor.slice(0, max).trim();
  return texto === '' ? null : texto;
};

/**
 * Ajusta una ficha al contrato del servidor SIN perder el contacto.
 *
 * ## Por que existe
 *
 * El servidor valida el lote entero con Zod: un telefono de dos cifras, una etiqueta de 80
 * caracteres, un nombre de 300 o 21 telefonos en una ficha devuelven un 400 para TODAS las fichas
 * del lote. La app lo tragaba en silencio y el resultado era una agenda guardada a medias, con
 * justo las fichas de las personas con las agendas mas sucias — que son las mas largas.
 *
 * Aqui se recorta lo que sobra y se descarta solo el DATO inservible (un telefono de menos de tres
 * cifras no es un telefono), nunca el contacto: la ficha sigue viajando con lo que si vale.
 *
 * Tambien es la ultima puerta de la minimizacion: devuelve SOLO los campos de `ContactoParaEnviar`.
 */
export function ajustarAlContrato(ficha: ContactoParaEnviar): ContactoParaEnviar | null {
  const externalId = recortar(ficha.externalId, TOPE.texto);
  if (!externalId) return null;

  const phones = ficha.phones
    .map((entrada) => ({ number: recortar(entrada.number, TOPE.telefono) }))
    .filter((entrada): entrada is { number: string } => entrada.number !== null && entrada.number.length >= 3)
    .slice(0, TOPE_TELEFONOS);

  const displayName = recortar(ficha.displayName, TOPE.texto);
  if (!displayName && phones.length === 0) return null;

  // Se arma campo a campo y no con `...ficha`: lo que no este nombrado aqui no viaja, aunque alguien
  // lo añada a la ficha mañana. Es la misma lista blanca que aplica el servidor, del lado del telefono.
  return {
    externalId,
    displayName,
    contactType: ficha.contactType,
    isFavorite: ficha.isFavorite,
    phones,
    hasEmail: ficha.hasEmail === true,
    hasBirthday: ficha.hasBirthday === true,
    hasCompany: ficha.hasCompany === true,
  };
}

/**
 * Una ficha por `externalId`.
 *
 * Dos fichas con el mismo identificador en un mismo lote se insertan las dos —el servidor consulta
 * lo existente ANTES de escribir— y chocan con el indice unico: el lote entero cae. Pasa en Android
 * con cuentas sincronizadas duplicadas. Se queda la que tiene mas datos.
 */
export function unicasPorId(fichas: readonly ContactoParaEnviar[]): ContactoParaEnviar[] {
  const peso = (ficha: ContactoParaEnviar) => ficha.phones.length + (ficha.displayName ? 1 : 0);
  const porId = new Map<string, ContactoParaEnviar>();
  for (const ficha of fichas) {
    const previa = porId.get(ficha.externalId);
    if (!previa || peso(ficha) > peso(previa)) porId.set(ficha.externalId, ficha);
  }
  return [...porId.values()];
}

/** Trocea una lista en lotes del tamaño pedido. El ultimo lote es el que queda, no se rellena. */
export function trocear<T>(lista: readonly T[], tamano: number): T[][] {
  if (tamano <= 0) return lista.length === 0 ? [] : [[...lista]];
  const lotes: T[][] = [];
  for (let indice = 0; indice < lista.length; indice += tamano) {
    lotes.push([...lista.slice(indice, indice + tamano)]);
  }
  return lotes;
}

/** Una posicion lista para enviar. Espeja `locationPingSchema` de AtlasBackend. */
export type PosicionParaEnviar = {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  speedMps: number | null;
  headingDegrees: number | null;
  captureMode: 'foreground' | 'background' | 'session_start' | 'manual';
  isMocked: boolean;
  capturedAt: string;
};

/** La forma minima de lo que devuelve `expo-location`, por la misma razon que arriba. */
export type PosicionDelTelefono = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    speed?: number | null;
    heading?: number | null;
  };
  timestamp: number;
  mocked?: boolean | null;
};

/**
 * De la posicion del sistema a la que viaja.
 *
 * Devuelve `null` si las coordenadas no son numeros finitos. `expo-location` puede entregar `NaN`
 * cuando el proveedor se cae a mitad de la lectura, y un `NaN` serializado a JSON se convierte en
 * `null`, que el servidor rechaza con un 400 que nadie sabe leer.
 *
 * `speed` y `heading` valen `-1` cuando el sistema no los sabe; se mandan como nulos, porque una
 * velocidad de menos un metro por segundo no significa nada y un dia alguien la promediaria.
 */
export function aPosicionParaEnviar(
  posicion: PosicionDelTelefono,
  modo: PosicionParaEnviar['captureMode'],
): PosicionParaEnviar | null {
  const { latitude, longitude } = posicion.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const opcional = (valor: number | null | undefined, minimo = 0): number | null =>
    valor === null || valor === undefined || !Number.isFinite(valor) || valor < minimo ? null : valor;

  return {
    lat: latitude,
    lng: longitude,
    accuracyMeters: opcional(posicion.coords.accuracy),
    // La altitud SI puede ser negativa —el Mar Muerto, un sotano— y por eso no pasa por `opcional`.
    altitudeMeters:
      posicion.coords.altitude === null || posicion.coords.altitude === undefined || !Number.isFinite(posicion.coords.altitude)
        ? null
        : posicion.coords.altitude,
    speedMps: opcional(posicion.coords.speed),
    headingDegrees: opcional(posicion.coords.heading),
    captureMode: modo,
    isMocked: posicion.mocked === true,
    capturedAt: new Date(posicion.timestamp).toISOString(),
  };
}

/**
 * Quita las posiciones repetidas de un lote acumulado.
 *
 * El servidor identifica una posicion por `(cliente, capturedAt, modo)`. Dos lecturas con la misma
 * marca de tiempo y el mismo modo son la misma para el, asi que mandarlas las dos gasta cuerpo para
 * que la segunda se descarte. Pasa mas de lo que parece: al recuperar cobertura, la cola en memoria
 * y la persistida pueden traer la misma medida.
 */
export function sinRepetidas(posiciones: readonly PosicionParaEnviar[]): PosicionParaEnviar[] {
  const vistas = new Set<string>();
  const salida: PosicionParaEnviar[] = [];
  for (const posicion of posiciones) {
    const clave = `${posicion.capturedAt}|${posicion.captureMode}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push(posicion);
  }
  return salida;
}
