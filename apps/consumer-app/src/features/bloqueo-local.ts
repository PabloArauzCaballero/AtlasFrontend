/**
 * El bloqueo LOCAL de la app (APP-13), con la regla de la banca movil.
 *
 * ## La regla, sin excepciones ni ajustes
 *
 * Con la sesion abierta en el telefono, la app se tapa y pide Face ID / Touch ID / huella —o, si no
 * hay o falla, el PIN de la cuenta— SIEMPRE que:
 *
 *  a. se abre en frio (el proceso arranca con una sesion guardada);
 *  b. vuelve de segundo plano (`background`) tras MAS de 60 s fuera;
 *  c. lleva 5 min sin que nadie toque la pantalla, aunque este en primer plano (PCI DSS 8.2.8 pide
 *     15 como maximo; la banca movil usa 5).
 *
 * Las salidas cortas (< 60 s) no bloquean: el dialogo de un permiso, la propia hoja de Face ID, el
 * selector de fotos o la camara del sistema. Las de iOS pasan por `inactive` sin llegar a
 * `background` y ni siquiera cuentan como salida; las que si llegan a `background` cuentan con su
 * reloj.
 *
 * NO cierra la sesion: los tokens siguen donde estaban y, al desbloquear, la persona sigue donde lo
 * dejo. El cierre total lo pone el TOPE de 8 h (`TOPE_DE_SESION_MS`, en `session/tope-de-sesion.ts`).
 *
 * ## Por que antes era inconsistente («a veces me pide la cara y otras no»)
 *
 * La version anterior (PR #121) tenia CUATRO fuentes de variacion, todas invisibles para la persona:
 *  1. al abrir en frio solo bloqueaba si la ultima salida anotada en disco era de hacia mas de 5 min
 *     —abrir, salir y volver a abrir en 4 min no pedia nada; a los 6, si—;
 *  2. al volver de segundo plano, igual: 4 min fuera no pedia nada, 6 si;
 *  3. era un ajuste del perfil, encendido por omision SOLO si el telefono tenia biometria registrada
 *     cuando se leyo, y mientras esa lectura asincrona no terminaba (`activado === null`) volver de
 *     segundo plano no bloqueaba;
 *  4. no habia limite de inactividad en primer plano: dejada abierta en la mesa, nunca se tapaba.
 *
 * ## Por que aqui y no en la pantalla
 *
 * La regla es pura —recibe la hora y los cambios de `AppState` y decide— y se prueba con relojes
 * falsos en `__tests__/bloqueo-local.test.ts`. El estado (bloqueado o no) vive en el modulo, fuera de
 * React, porque lo tocan la sesion (al entrar con PIN, al restaurar, al salir) y la capa que se
 * dibuja, que estan en sitios distintos del arbol.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Cuanto puede estar la app en segundo plano sin pedir nada al volver. MAS de esto, bloquea. */
export const SALIDA_CORTA_MS = 60 * 1000;
/** Cuanto puede estar la app abierta sin que nadie la toque. Esto o mas, bloquea. */
export const INACTIVIDAD_MS = 5 * 60 * 1000;
/** Cada cuanto se mira la inactividad con la app en primer plano. */
export const REVISION_MS = 15 * 1000;

export type MotivoDeBloqueo = 'arranque' | 'segundo_plano' | 'inactividad';

/** Lo que el vigilante necesita del mundo: la hora y como bloquear. Inyectado para probarlo. */
export type EntornoDelVigilante = {
  ahora: () => number;
  bloquear: (motivo: MotivoDeBloqueo) => void;
  bloqueada: () => boolean;
};

/**
 * La regla, como maquina de estados. Una instancia por sesion abierta.
 *
 * - `cambioDeEstado` recibe los `AppState` tal cual los da el sistema. En iOS, salir es
 *   `active → inactive → background` y volver `background → active` (a veces con un `inactive` en
 *   medio); la hoja de Face ID, el centro de control o un permiso son `active → inactive → active`
 *   y no son salida. En Android no hay `inactive`.
 * - `interaccion` se llama en cada toque de pantalla.
 * - `revisar` se llama periodicamente en primer plano: es el reloj de la inactividad.
 * - `desbloqueado` reinicia el reloj de inactividad: quien acaba de desbloquear acaba de interactuar.
 */
export function crearVigilante(entorno: EntornoDelVigilante) {
  let salidaEn: number | null = null;
  let ultimaInteraccion = entorno.ahora();

  const inactivaDemasiado = (ahora: number) => {
    const quieta = ahora - ultimaInteraccion;
    // Un reloj que va hacia atras (la persona cambio la hora) no se puede fiar: se bloquea.
    return quieta < 0 || quieta >= INACTIVIDAD_MS;
  };

  return {
    cambioDeEstado(estado: string) {
      const ahora = entorno.ahora();
      if (estado === 'background') {
        // La PRIMERA vez que se va: un segundo `background` sin volver no mueve la hora de salida.
        if (salidaEn === null) salidaEn = ahora;
        return;
      }
      if (estado !== 'active') return; // `inactive`, `unknown`, `extension`: no son ni salir ni volver.
      const salio = salidaEn;
      salidaEn = null;
      if (entorno.bloqueada()) return;
      if (salio !== null) {
        const fuera = ahora - salio;
        if (fuera < 0 || fuera > SALIDA_CORTA_MS) {
          entorno.bloquear('segundo_plano');
          return;
        }
      }
      if (inactivaDemasiado(ahora)) entorno.bloquear('inactividad');
    },
    interaccion() {
      ultimaInteraccion = entorno.ahora();
    },
    revisar() {
      if (salidaEn !== null || entorno.bloqueada()) return;
      if (inactivaDemasiado(entorno.ahora())) entorno.bloquear('inactividad');
    },
    desbloqueado() {
      ultimaInteraccion = entorno.ahora();
    },
  };
}

export type Vigilante = ReturnType<typeof crearVigilante>;

/* ------------------------------------------------------------------------------------------------
 * El estado, fuera de React.
 * ---------------------------------------------------------------------------------------------- */

let bloqueada = false;
let motivo: MotivoDeBloqueo | null = null;
/** Si la sesion de esta ejecucion se abrio escribiendo el PIN (y no restaurandola del disco). */
let sesionRecienAbierta = false;
const oyentes = new Set<() => void>();
/* El toque de pantalla llega a la raiz, que no conoce al vigilante de la capa: se reenvia aqui. */
const oyentesDeInteraccion = new Set<() => void>();

const avisar = () => oyentes.forEach((oyente) => oyente());

export function estaBloqueada(): boolean {
  return bloqueada;
}

export function motivoDelBloqueo(): MotivoDeBloqueo | null {
  return motivo;
}

export function suscribirBloqueo(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function bloquear(porque: MotivoDeBloqueo = 'segundo_plano'): void {
  if (bloqueada) return;
  bloqueada = true;
  motivo = porque;
  avisar();
}

export function desbloquear(): void {
  if (!bloqueada) return;
  bloqueada = false;
  motivo = null;
  avisar();
}

/**
 * La app ARRANCA con una sesion guardada: (a) de la regla. Se llama desde la restauracion de la
 * sesion, ANTES de marcarla como abierta, para que no se vea ni un fotograma de la app sin candado.
 * En el navegador no: no hay biometria y la sesion web vive lo que vive la pestaña.
 */
export function bloquearAlArrancar(): void {
  if (Platform.OS === 'web') return;
  bloquear('arranque');
}

/** La sesion se abrio con el PIN en esta ejecucion: nada que desbloquear. */
export function marcarSesionRecienAbierta(): void {
  sesionRecienAbierta = true;
  desbloquear();
}

export function sesionAbiertaConPinAhora(): boolean {
  return sesionRecienAbierta;
}

/** Cada toque de pantalla (lo llama la raiz). Barato a proposito: corre en cada `touchstart`. */
export function registrarInteraccion(): void {
  oyentesDeInteraccion.forEach((oyente) => oyente());
}

export function suscribirInteraccion(oyente: () => void): () => void {
  oyentesDeInteraccion.add(oyente);
  return () => {
    oyentesDeInteraccion.delete(oyente);
  };
}

/* Lo que guardaba la version con ajuste (PR #121): ya no se lee, se borra para no dejar restos. */
const CLAVES_RETIRADAS = ['atlas.bloqueo.preferencia', 'atlas.bloqueo.salida-en'];

/** Al cerrar sesion: nada que desbloquear y nada que recordar para el siguiente que entre. */
export function olvidarBloqueo(): void {
  sesionRecienAbierta = false;
  desbloquear();
  void AsyncStorage.multiRemove(CLAVES_RETIRADAS).catch(() => undefined);
}
