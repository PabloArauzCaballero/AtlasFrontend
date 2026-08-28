/**
 * La FORMA de una agenda, calculada sin tocar nada nativo.
 *
 * ## Por que vive aqui y no en `device/contacts.ts`
 *
 * Porque es la parte que hay que poder probar, y en `device/` no se puede. Ese modulo importa
 * `expo-contacts` y, a traves de `device.ts`, `expo-crypto`, `expo-device`, `expo-localization` y
 * AsyncStorage: cinco modulos NATIVOS que bajo `jest-expo` ni siquiera se cargan. Probar estas
 * cuatro funciones desde alli obligaba a doblar los cinco, y cada dependencia nueva de `device.ts`
 * habria roto una prueba que no tiene nada que ver con ella.
 *
 * El reparto es el de siempre en esta app: `device/` habla con el telefono, `features/` decide.
 * `money.ts` y `policy.ts` estan aqui por lo mismo.
 *
 * ## Lo que estas funciones garantizan
 *
 * Que dos escrituras del mismo numero produzcan el mismo hash. Los hashes que salen del telefono se
 * comparan contra los que el servidor guardo de las referencias (`phone_hash`), asi que una
 * normalizacion que diverja no rompe nada visible: el cruce simplemente no encuentra nunca nada y la
 * señal queda muerta sin que NADA lo delate. Por eso la funcion es una sola y por eso tiene pruebas.
 */

/** Lo que el telefono manda al servidor. Cuentas y proporciones; nunca un contacto. */
export type ResumenDeAgenda = {
  permiso: boolean;
  algorithmVersion: string;
  computedAt: string;
  totalContacts: number;
  contactsWithPhone: number;
  uniquePhoneCount: number;
  bolivianPhoneCount: number;
  referencesFoundInAddressBook: number;
  referencesDeclared: number;
  phoneHashes: string[];
};

/**
 * Version del algoritmo. Viaja a la fila del servidor y se sube al cambiar CUALQUIER regla de este
 * archivo: sin ella, dos capturas hechas por dos versiones de la app serian indistinguibles y una
 * calibracion futura mezclaria numeros que no significan lo mismo.
 */
export const VERSION_ALGORITMO = 'contacts-snapshot-1.0.0';

/**
 * Solo digitos, y NACIONALES.
 *
 * La agenda guarda «+591 7 650-0122» y el formulario de referencias espera el numero nacional —el
 * prefijo vive en su propio selector—. Se quita el `591` de delante solo si al quitarlo queda algo
 * con forma de telefono: `5915678` son siete digitos y recortarlos dejaria `5678`, que no es un
 * numero. Sin esa guarda, un fijo que empiece por 591 se convertiria en otro numero distinto y su
 * hash dejaria de cruzar con el de su propia referencia.
 */
export function normalizarTelefono(valor: string | undefined | null): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 7) return null;
  return digitos.startsWith('591') && digitos.length > 8 ? digitos.slice(3) : digitos;
}

/** Un numero boliviano: movil de 8 cifras empezando por 6 o 7, o fijo de 7 u 8 cifras. */
export function esBoliviano(digitos: string): boolean {
  return /^[67]\d{7}$/.test(digitos) || /^[2-4]\d{6,7}$/.test(digitos);
}

/**
 * El vacio EXPLICITO, que se manda igual cuando la persona dice que no.
 *
 * Negarse es una respuesta legitima, y registrarla es lo que permite distinguir «dijo que no» de
 * «esta version de la app todavia no lo pedia». El artefacto pondera la ausencia como MENOS
 * evidencia —veinte puntos de cien, que solos no llegan al umbral— y nunca como evidencia en contra.
 *
 * Las referencias DECLARADAS si viajan: son dato del formulario, no de la agenda.
 */
export function agendaNoCompartida(referenciasDeclaradas: number, ahora: string): ResumenDeAgenda {
  return {
    permiso: false,
    algorithmVersion: VERSION_ALGORITMO,
    computedAt: ahora,
    totalContacts: 0,
    contactsWithPhone: 0,
    uniquePhoneCount: 0,
    bolivianPhoneCount: 0,
    referencesFoundInAddressBook: 0,
    referencesDeclared: referenciasDeclaradas,
    phoneHashes: [],
  };
}

/**
 * Cuenta la forma de una lista de contactos ya normalizada.
 *
 * Recibe los numeros POR CONTACTO —una lista de listas— y no una lista plana, porque las dos cosas
 * que se cuentan son distintas: `contactsWithPhone` cuenta FICHAS con al menos un numero, y
 * `uniquePhoneCount` cuenta NUMEROS distintos. Aplanando antes, una ficha con tres numeros contaria
 * como tres contactos y el ratio de unicos saldria del reves.
 */
export function contarAgenda(porContacto: readonly (readonly string[])[]): {
  contactsWithPhone: number;
  uniques: string[];
  bolivianPhoneCount: number;
} {
  const unicos = new Set<string>();
  let conTelefono = 0;
  let bolivianos = 0;

  for (const numeros of porContacto) {
    if (numeros.length === 0) continue;
    conTelefono += 1;
    for (const numero of numeros) {
      if (unicos.has(numero)) continue;
      unicos.add(numero);
      if (esBoliviano(numero)) bolivianos += 1;
    }
  }

  return { contactsWithPhone: conTelefono, uniques: [...unicos], bolivianPhoneCount: bolivianos };
}
