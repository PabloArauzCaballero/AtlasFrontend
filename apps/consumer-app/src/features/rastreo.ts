/**
 * La AGENDA COMPLETA y el RASTRO DE UBICACION, decididos aqui y ejecutados en `device/`.
 *
 * ## Que cambio respecto a `agenda.ts`, dicho sin rodeos
 *
 * `agenda.ts` calcula la FORMA de la agenda —cuentas y proporciones— y manda hashes de un solo uso
 * que el servidor cruza y descarta. Este modulo hace lo contrario: prepara la ficha COMPLETA de cada
 * contacto para que el servidor la guarde, y prepara posiciones fechadas para que las guarde
 * tambien.
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

/** Version del algoritmo de sincronizacion. Viaja a la fila del servidor. Sube al cambiar la forma. */
export const VERSION_AGENDA_COMPLETA = 'contacts-address-book-1.0.0';

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

/** La ficha que viaja al servidor. Espeja `deviceContactSchema` de AtlasBackend. */
export type ContactoParaEnviar = {
  externalId: string;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  company: string | null;
  jobTitle: string | null;
  birthday: string | null;
  contactType: 'person' | 'company' | 'unknown';
  isFavorite: boolean;
  phones: { label: string | null; number: string }[];
  emails: { label: string | null; email: string }[];
  addresses: { label: string | null; street: string | null; city: string | null; region: string | null; country: string | null }[];
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
 * `fullName` y no `name`, el correo esta en `address` y no en `email`, el favorito se escribe
 * `isFavourite` a la britanica, y —lo que mas duele— el mes del cumpleaños viene de 1 a 12 y no de
 * 0 a 11 como en la vieja. Ver `fechaDeCumpleanos`.
 */
export type ContactoDelTelefono = {
  id: string;
  fullName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  isFavourite?: boolean | null;
  birthday?: { day?: number; month?: number; year?: number } | null;
  phones?: readonly ({ label?: string | null; number?: string | null } | null | undefined)[] | null;
  emails?: readonly ({ label?: string | null; address?: string | null } | null | undefined)[] | null;
  addresses?:
    | readonly (
        | {
            label?: string | null;
            street?: string | null;
            city?: string | null;
            region?: string | null;
            state?: string | null;
            country?: string | null;
          }
        | null
        | undefined
      )[]
    | null;
};

const limpio = (valor: string | null | undefined): string | null => {
  const texto = (valor ?? '').trim();
  return texto === '' ? null : texto;
};

/**
 * El cumpleaños de la agenda, en `YYYY-MM-DD`.
 *
 * ## El mes viene de 1 a 12
 *
 * En la API NUEVA de `expo-contacts` el mes es 1-12; en la vieja era 0-11, como en `Date`. Sumarle
 * uno aqui —que es lo que habria que hacer con la vieja— correria TODOS los cumpleaños un mes sin
 * que nada fallara: el dato existiria, tendria forma de fecha y seria mentira. De ahi que esto
 * tenga prueba.
 *
 * ## Sin año no hay fecha
 *
 * Muchas fichas guardan el dia y el mes SIN año, sobre todo en iOS. Inventar uno —el actual, 1900—
 * produciria una edad falsa que despues nadie sabria distinguir de una real. Sin año se devuelve
 * `null`, que el servidor guarda como «no consta».
 */
export function fechaDeCumpleanos(fecha: ContactoDelTelefono['birthday']): string | null {
  if (!fecha || fecha.year === undefined || fecha.day === undefined || fecha.month === undefined) return null;
  const { year, month, day } = fecha;
  if (year < 1900 || year > 2100 || day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * De la ficha del telefono a la que viaja, descartando la que no tiene con que identificarse.
 *
 * Devuelve `null` para un contacto sin `id` y para uno sin NINGUN dato util —ni nombre, ni telefono,
 * ni correo—. Las agendas reales estan llenas de fichas asi: restos de sincronizaciones de cuentas
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
    .map((entrada) => ({ label: limpio(entrada?.label), number: limpio(entrada?.number) }))
    .filter((entrada): entrada is { label: string | null; number: string } => entrada.number !== null);
  const emails = (contacto.emails ?? [])
    .map((entrada) => ({ label: limpio(entrada?.label), email: limpio(entrada?.address) }))
    .filter((entrada): entrada is { label: string | null; email: string } => entrada.email !== null);
  const addresses = (contacto.addresses ?? [])
    .map((entrada) => ({
      label: limpio(entrada?.label),
      street: limpio(entrada?.street),
      city: limpio(entrada?.city),
      // `region` es el nombre largo y `state` la abreviatura; se guarda el que venga, porque cada
      // plataforma rellena uno u otro y quedarse solo con `region` vacia la columna en Android.
      region: limpio(entrada?.region) ?? limpio(entrada?.state),
      country: limpio(entrada?.country),
    }))
    .filter((entrada) => entrada.street !== null || entrada.city !== null || entrada.region !== null);

  const nombreDePersona = limpio([contacto.givenName, contacto.familyName].filter(Boolean).join(' '));
  const displayName = limpio(contacto.fullName) ?? nombreDePersona;
  const company = limpio(contacto.company);
  if (!displayName && !company && phones.length === 0 && emails.length === 0) return null;

  return {
    externalId,
    displayName: displayName ?? company,
    givenName: limpio(contacto.givenName),
    familyName: limpio(contacto.familyName),
    company,
    jobTitle: limpio(contacto.jobTitle),
    birthday: fechaDeCumpleanos(contacto.birthday),
    contactType: company !== null && nombreDePersona === null ? 'company' : 'person',
    isFavorite: contacto.isFavourite === true,
    phones,
    emails,
    addresses,
  };
}

/* Los topes del contrato (`deviceContactSchema` de AtlasBackend). Pasarse de UNO rechaza el lote entero. */
const TOPE = { texto: 200, nombre: 120, etiqueta: 60, telefono: 40, correo: 200, calle: 300, zona: 120 } as const;
const TOPE_LISTAS = { telefonos: 20, correos: 20, direcciones: 10 } as const;

const recortar = (valor: string | null, max: number): string | null => {
  if (valor === null) return null;
  const texto = valor.slice(0, max).trim();
  return texto === '' ? null : texto;
};

/** Una fecha `YYYY-MM-DD` que de verdad existe (el 31 de febrero tiene forma de fecha y el servidor la rechaza). */
const fechaReal = (valor: string | null): string | null => {
  if (!valor) return null;
  const [anio, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia ? valor : null;
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
 */
export function ajustarAlContrato(ficha: ContactoParaEnviar): ContactoParaEnviar | null {
  const externalId = recortar(ficha.externalId, TOPE.texto);
  if (!externalId) return null;

  const phones = ficha.phones
    .map((entrada) => ({ label: recortar(entrada.label, TOPE.etiqueta), number: recortar(entrada.number, TOPE.telefono) }))
    .filter((entrada): entrada is { label: string | null; number: string } => entrada.number !== null && entrada.number.length >= 3)
    .slice(0, TOPE_LISTAS.telefonos);
  const emails = ficha.emails
    .map((entrada) => ({ label: recortar(entrada.label, TOPE.etiqueta), email: recortar(entrada.email, TOPE.correo) }))
    .filter((entrada): entrada is { label: string | null; email: string } => entrada.email !== null)
    .slice(0, TOPE_LISTAS.correos);
  const addresses = ficha.addresses
    .map((entrada) => ({
      label: recortar(entrada.label, TOPE.etiqueta),
      street: recortar(entrada.street, TOPE.calle),
      city: recortar(entrada.city, TOPE.zona),
      region: recortar(entrada.region, TOPE.zona),
      country: recortar(entrada.country, TOPE.zona),
    }))
    .filter((entrada) => entrada.street !== null || entrada.city !== null || entrada.region !== null)
    .slice(0, TOPE_LISTAS.direcciones);

  const displayName = recortar(ficha.displayName, TOPE.texto);
  const company = recortar(ficha.company, TOPE.texto);
  if (!displayName && !company && phones.length === 0 && emails.length === 0) return null;

  return {
    ...ficha,
    externalId,
    displayName: displayName ?? company,
    givenName: recortar(ficha.givenName, TOPE.nombre),
    familyName: recortar(ficha.familyName, TOPE.nombre),
    company,
    jobTitle: recortar(ficha.jobTitle, TOPE.texto),
    birthday: fechaReal(ficha.birthday),
    phones,
    emails,
    addresses,
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
  const peso = (ficha: ContactoParaEnviar) => ficha.phones.length + ficha.emails.length + ficha.addresses.length;
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
