/**
 * Los permisos que la app pide AL ARRANCAR, y la decision que la persona tomo sobre ellos.
 *
 * ## Por que se piden al arrancar, si el resto de la app no lo hace
 *
 * Porque estos dos no sirven a una pantalla concreta. La camara se pide al ir a fotografiar el
 * carnet y ahi el motivo se entiende solo; la ubicacion continua y la agenda completa no tienen un
 * momento asi: alimentan la evaluacion entera, desde el alta hasta la cobranza. Pedirlos «donde se
 * usan» los dejaria sin pedir nunca.
 *
 * El precio es conocido y hay que asumirlo: iOS pregunta UNA sola vez, asi que un dialogo que sale
 * antes de que se entienda el motivo se contesta que no y ya no hay vuelta atras salvo un viaje a
 * los ajustes. Por eso el dialogo del sistema NUNCA sale solo: sale detras de una pantalla propia
 * que explica que se va a hacer con cada cosa, y solo si la persona pulsa que si.
 *
 * ## Que se guarda aqui y que NO
 *
 * Aqui se guarda la DECISION —que dijo y cuando—, para no volver a preguntar en cada arranque y
 * para poder mandarla como consentimiento en cuanto haya cuenta. El estado real del permiso lo
 * manda siempre el sistema operativo: si alguien lo revoca desde los ajustes, esto se queda
 * desactualizado a proposito y quien decide es `permisosDeUbicacion()`, no este archivo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'atlas.permisos.arranque';

export type DecisionDeArranque = {
  /** Si acepto que registremos su ubicacion. */
  ubicacion: boolean;
  /**
   * Si ademas concedio «siempre», SEGUN LO QUE EL SISTEMA CONTESTO EN ESE INSTANTE.
   *
   * En iOS esto es casi siempre `false` aunque la persona acabe concediendolo: el sistema no muestra
   * el dialogo de «Siempre» durante la peticion, lo muestra despues y a su ritmo, asi que la
   * promesa ya resolvio con «solo al usar» cuando la persona todavia no ha contestado.
   *
   * Por eso este campo NO decide si se enciende el rastreo de segundo plano —eso lo decide
   * `permisosDeUbicacion()`, que lee el estado vigente—. Sirve para saber que se le pregunto.
   */
  ubicacionSiempre: boolean;
  /** Si acepto que guardemos su agenda. */
  contactos: boolean;
  decidedAt: string;
};

/** `null` si todavia no se le ha preguntado. Es lo que decide si la pantalla se muestra. */
export async function leerDecisionDeArranque(): Promise<DecisionDeArranque | null> {
  try {
    const crudo = await AsyncStorage.getItem(KEY);
    if (!crudo) return null;
    const valor = JSON.parse(crudo) as Partial<DecisionDeArranque>;
    if (typeof valor.decidedAt !== 'string') return null;
    return {
      ubicacion: valor.ubicacion === true,
      ubicacionSiempre: valor.ubicacionSiempre === true,
      contactos: valor.contactos === true,
      decidedAt: valor.decidedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Guarda la decision, incluida la NEGATIVA.
 *
 * Guardar el «no» es lo que evita el peor comportamiento posible: volver a sacar la pantalla en cada
 * arranque a alguien que ya dijo que no. Ademas permite mandarla como consentimiento denegado, que
 * es lo que distingue «dijo que no» de «esta version de la app todavia no lo preguntaba».
 */
export async function guardarDecisionDeArranque(decision: Omit<DecisionDeArranque, 'decidedAt'>): Promise<void> {
  const completa: DecisionDeArranque = { ...decision, decidedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEY, JSON.stringify(completa)).catch(() => undefined);
}
