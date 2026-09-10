/**
 * Lo que la app HACE con los permisos que la persona concedio al arrancar.
 *
 * ## El orden importa, y es este
 *
 * 1. **Registrar el consentimiento.** Antes de leer nada. El servidor rechaza la agenda y las
 *    posiciones con 422 si no hay consentimiento vigente para la finalidad, asi que si esto falla no
 *    se sube nada — y eso es el sistema funcionando, no un error que tapar.
 * 2. **Subir la agenda**, en lotes, marcando el ultimo.
 * 3. **Encender el rastreo**, y solo el de segundo plano si concedio «siempre».
 *
 * Registrar primero no es puntillismo: el permiso del sistema operativo prueba que alguien pulso
 * «Permitir» en una caja que redacta Apple, y no dice que se le prometio a cambio. El consentimiento
 * —texto versionado, fecha, canal, IP y huella del dispositivo— es lo que se puede enseñar despues.
 *
 * ## Todo falla en silencio
 *
 * Ninguno de los tres pasos puede impedir que alguien entre a ver cuanto debe. Lo que se pierde
 * cuando fallan es evidencia, y el motor pondera la ausencia de evidencia como MENOS informacion,
 * nunca como informacion en contra de la persona.
 *
 * ## La negativa tambien se registra
 *
 * Quien dice que no genera un consentimiento `declined`, no un silencio. Es lo que permite
 * distinguir «dijo que no» de «esta version de la app todavia no lo preguntaba», y son dos cosas que
 * el expediente no puede confundir.
 */
import * as customerApi from '../api/endpoints/customer';
import * as deviceSignalsApi from '../api/endpoints/device-signals';
import * as privacyApi from '../api/endpoints/privacy';
import { leerAgendaCompleta } from '../device/contacts';
import {
  detenerRastreoEnSegundoPlano,
  iniciarRastreoEnSegundoPlano,
  medirYEnviar,
  permisosDeUbicacion,
} from '../device/location';
import { borrarContextoDeRastreo, guardarContextoDeRastreo, type ContextoDeRastreo } from '../device/tracking-context';
import { TAMANO_LOTE_AGENDA, trocear, VERSION_AGENDA_COMPLETA } from '../features/rastreo';
import { leerDecisionDeArranque } from './permisos-de-arranque';

/** Los codigos de documento que sembro la migracion. Son el contrato con el backend. */
export const FINALIDAD_AGENDA = 'device_address_book';
export const FINALIDAD_UBICACION = 'location_tracking';

/**
 * Registra las dos decisiones como consentimientos.
 *
 * Se buscan los documentos por su codigo en el catalogo publico: los identificadores los asigna la
 * base de datos y son distintos en cada entorno, asi que fijarlos en el codigo funcionaria en
 * desarrollo y fallaria en produccion sin decir por que.
 *
 * Un documento que no este en el catalogo simplemente no se manda: la migracion que lo siembra pudo
 * no haberse aplicado todavia en ese entorno, y mandar un identificador inventado produce un 422
 * que no arregla nadie.
 */
async function registrarConsentimientos(
  customerId: string,
  decision: { ubicacion: boolean; contactos: boolean; decidedAt: string },
): Promise<void> {
  // Se registra en segundo plano al activar las señales, no desde una pantalla.
  const documentos = await customerApi.listActiveConsents({ sinPantalla: true });
  const porCodigo = new Map(documentos.map((documento) => [documento.documentCode, documento.id]));

  const decisiones: privacyApi.ConsentDecisionInput[] = [];
  const añadir = (codigo: string, otorgado: boolean) => {
    const id = porCodigo.get(codigo);
    if (!id) return;
    decisiones.push({
      consentDocumentId: id,
      purposeCode: codigo,
      decision: otorgado ? 'granted' : 'declined',
      decidedAt: decision.decidedAt,
    });
  };

  añadir(FINALIDAD_AGENDA, decision.contactos);
  añadir(FINALIDAD_UBICACION, decision.ubicacion);
  if (decisiones.length === 0) return;

  // Igual que la lista de consentimientos de arriba: lo registra la sesion en segundo plano.
  await privacyApi.registrarDecisiones(customerId, decisiones, { sinPantalla: true });
}

/**
 * Sube la agenda entera, troceada.
 *
 * Los lotes van EN SERIE y no en paralelo. El servidor cuenta lo almacenado dentro de cada
 * transaccion, y varias sincronizaciones simultaneas del mismo cliente competirian por las mismas
 * filas: el troceo existe para que quepa en la red, no para ir mas rapido.
 *
 * `totalContactsInDevice` es el total de la agenda ENTERA en todos los lotes, no el del lote. Es lo
 * que permite al servidor saber si llego todo o la sincronizacion se corto a la mitad.
 */
async function subirAgenda(contexto: ContextoDeRastreo): Promise<number> {
  const agenda = await leerAgendaCompleta();
  // `null` es «no se pudo leer» y `[]` es «no tiene contactos». Con `null` no se manda nada: un lote
  // vacio no es un contrato valido y una agenda vacia inventada seria un hecho falso sobre alguien.
  if (agenda === null || agenda.contactos.length === 0) return 0;

  const lotes = trocear(agenda.contactos, TAMANO_LOTE_AGENDA);
  const capturedAt = new Date().toISOString();
  let subidos = 0;

  for (const [indice, lote] of lotes.entries()) {
    await deviceSignalsApi.sincronizarAgenda(contexto.customerId, {
      deviceId: contexto.deviceId,
      sessionId: contexto.sessionId,
      algorithmVersion: VERSION_AGENDA_COMPLETA,
      capturedAt,
      isFinalBatch: indice === lotes.length - 1,
      totalContactsInDevice: agenda.contactos.length,
      accessScope: agenda.alcance,
      contacts: lote,
    });
    subidos += lote.length;
  }

  return subidos;
}

export type ResultadoDeActivacion = {
  contactosSubidos: number;
  ubicacionActiva: boolean;
  rastreoEnSegundoPlano: boolean;
};

/**
 * Enciende las dos señales para esta sesion. Se llama en cuanto se sabe quien es la persona.
 *
 * Sin `deviceId` no hace nada: el servidor ata cada entrega al vinculo cliente-dispositivo y sin el
 * responde un 403 que no arregla nadie. Es exactamente la misma regla que ya sigue la telemetria.
 */
export async function activarSeñalesDelDispositivo(input: {
  customerId: string;
  deviceId: string | null;
  sessionId: string | null;
}): Promise<ResultadoDeActivacion> {
  const vacio: ResultadoDeActivacion = { contactosSubidos: 0, ubicacionActiva: false, rastreoEnSegundoPlano: false };
  if (!input.deviceId) return vacio;

  const decision = await leerDecisionDeArranque();
  if (!decision) return vacio;

  const contexto: ContextoDeRastreo = {
    customerId: input.customerId,
    deviceId: input.deviceId,
    sessionId: input.sessionId,
  };

  try {
    await registrarConsentimientos(input.customerId, decision);
  } catch {
    // Sin consentimiento registrado el servidor rechazara lo que venga detras. Se sale aqui en vez de
    // intentarlo igual: subir una agenda para que la rechacen gasta la red de la persona a cambio de
    // un 422.
    return vacio;
  }

  let contactosSubidos = 0;
  if (decision.contactos) {
    contactosSubidos = await subirAgenda(contexto).catch(() => 0);
  }

  if (!decision.ubicacion) return { ...vacio, contactosSubidos };

  // El contexto se guarda ANTES de encender nada: la tarea de segundo plano puede recibir su primera
  // posicion inmediatamente, y sin contexto se apagaria sola creyendo que no hay sesion.
  await guardarContextoDeRastreo(contexto);

  const permisos = await permisosDeUbicacion();
  if (!permisos.primerPlano) return { ...vacio, contactosSubidos };

  // La primera medida es la del inicio de sesion: dice desde donde entro, que es la pregunta que
  // hoy no se puede contestar cuando alguien reclama una compra que no reconoce.
  await medirYEnviar(contexto, 'session_start');

  /*
   * El rastreo de segundo plano se decide por el estado REAL del sistema, no por lo que guardamos.
   *
   * `decision.ubicacionSiempre` es lo que el sistema contesto EN AQUEL MOMENTO, y en iOS ese momento
   * llega antes que la respuesta: `requestBackgroundPermissionsAsync` no espera al dialogo de
   * «Siempre» —el sistema lo muestra despues, a su ritmo— y devuelve el estado vigente, que todavia
   * es «solo al usar». Se comprobo en el simulador: la persona pulsa «Cambiar a Permitir siempre» y
   * lo guardado dice `false`.
   *
   * Confiar en el valor guardado dejaba el rastreo de segundo plano APAGADO para siempre justo a
   * quien lo habia concedido, sin un error, sin un log y sin nada que lo delatara. Lo guardado sirve
   * para el consentimiento —que si es una decision fechada— y el sistema manda sobre lo tecnico.
   */
  const enSegundoPlano = permisos.segundoPlano ? await iniciarRastreoEnSegundoPlano() : false;
  return { contactosSubidos, ubicacionActiva: true, rastreoEnSegundoPlano: enSegundoPlano };
}

/**
 * Apaga las dos señales. Se llama al cerrar sesion.
 *
 * Borrar el contexto es lo que evita el fallo que de otro modo seria invisible: un rastreo que quedo
 * instalado en el sistema y sigue mandando posiciones de alguien que ya cerro sesion. Se detiene
 * ademas explicitamente, porque el sistema recuerda la tarea entre arranques de la app.
 */
export async function desactivarSeñalesDelDispositivo(): Promise<void> {
  await detenerRastreoEnSegundoPlano();
  await borrarContextoDeRastreo();
}
