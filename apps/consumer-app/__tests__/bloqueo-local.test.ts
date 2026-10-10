/**
 * APP-13: la REGLA del bloqueo local, con relojes falsos y las transiciones de `AppState` tal como las da iOS.
 * Ver `src/features/bloqueo-local.ts`.
 *
 * Fija los casos que antes daban «a veces me pide la cara y otras no»: la regla no depende de cuanto hace que se
 * cerro la app la ultima vez, de lo que hubiera en disco ni de un ajuste del perfil.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  bloquear,
  bloquearAlArrancar,
  crearVigilante,
  desbloquear,
  estaBloqueada,
  INACTIVIDAD_MS,
  marcarSesionRecienAbierta,
  motivoDelBloqueo,
  olvidarBloqueo,
  registrarInteraccion,
  SALIDA_CORTA_MS,
  sesionAbiertaConPinAhora,
  suscribirBloqueo,
  suscribirInteraccion,
  type MotivoDeBloqueo,
} from '../src/features/bloqueo-local';

/** Un vigilante con reloj propio: `pasar(ms)` adelanta la hora. */
function escenario() {
  let ahora = Date.parse('2026-10-09T12:00:00Z');
  const bloqueos: MotivoDeBloqueo[] = [];
  let bloqueada = false;
  const vigilante = crearVigilante({
    ahora: () => ahora,
    bloquear: (motivo) => {
      bloqueada = true;
      bloqueos.push(motivo);
    },
    bloqueada: () => bloqueada,
  });
  return {
    vigilante,
    bloqueos,
    pasar: (ms: number) => {
      ahora += ms;
    },
    fijar: (t: number) => {
      ahora = t;
    },
    get ahora() {
      return ahora;
    },
    desbloquear: () => {
      bloqueada = false;
      vigilante.desbloqueado();
    },
    /** iOS al salir: `active → inactive → background`. */
    salir: () => {
      vigilante.cambioDeEstado('inactive');
      vigilante.cambioDeEstado('background');
    },
    /** iOS al volver: a veces pasa por `inactive`, a veces no. */
    volver: (conInactive = false) => {
      if (conInactive) vigilante.cambioDeEstado('inactive');
      vigilante.cambioDeEstado('active');
    },
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  olvidarBloqueo();
});

describe('(b) volver de segundo plano', () => {
  it('iOS `active → inactive → background → active` tras MAS de 60 s bloquea', () => {
    const e = escenario();
    e.salir();
    e.pasar(SALIDA_CORTA_MS + 1);
    e.volver();
    expect(e.bloqueos).toEqual(['segundo_plano']);
  });

  it('60 s justos o menos no bloquea (el selector de fotos, la camara del sistema, un permiso)', () => {
    const e = escenario();
    e.salir();
    e.pasar(SALIDA_CORTA_MS);
    e.volver(true);
    e.salir();
    e.pasar(5_000);
    e.volver();
    expect(e.bloqueos).toEqual([]);
  });

  it('a los 61 s bloquea SIEMPRE: diez veces seguidas, diez bloqueos (antes dependia de la ultima salida)', () => {
    const e = escenario();
    for (let i = 0; i < 10; i += 1) {
      e.salir();
      e.pasar(61_000);
      e.volver(i % 2 === 0);
      expect(e.bloqueos).toHaveLength(i + 1);
      e.desbloquear();
    }
    expect(new Set(e.bloqueos)).toEqual(new Set(['segundo_plano']));
  });

  it('`active → inactive → active` sin pasar por background no es salir (la hoja de Face ID, el centro de control)', () => {
    const e = escenario();
    e.vigilante.cambioDeEstado('inactive');
    e.pasar(3 * 60_000);
    e.vigilante.cambioDeEstado('active');
    expect(e.bloqueos).toEqual([]);
  });

  it('un segundo `background` sin volver no mueve la hora de salida', () => {
    const e = escenario();
    e.salir();
    e.pasar(40_000);
    e.vigilante.cambioDeEstado('background');
    e.pasar(40_000);
    e.volver();
    expect(e.bloqueos).toEqual(['segundo_plano']);
  });

  it('el reloj hacia atras mientras estaba fuera bloquea: no se puede fiar', () => {
    const e = escenario();
    e.salir();
    e.fijar(e.ahora - 3_600_000);
    e.volver();
    expect(e.bloqueos).toEqual(['segundo_plano']);
  });
});

describe('(c) inactividad en primer plano', () => {
  it('5 min sin tocar la pantalla bloquea; 4:59 no', () => {
    const e = escenario();
    e.pasar(INACTIVIDAD_MS - 1_000);
    e.vigilante.revisar();
    expect(e.bloqueos).toEqual([]);
    e.pasar(1_000);
    e.vigilante.revisar();
    expect(e.bloqueos).toEqual(['inactividad']);
  });

  it('cada toque reinicia el reloj', () => {
    const e = escenario();
    e.pasar(4 * 60_000);
    e.vigilante.interaccion();
    e.pasar(4 * 60_000);
    e.vigilante.revisar();
    expect(e.bloqueos).toEqual([]);
    e.pasar(60_000);
    e.vigilante.revisar();
    expect(e.bloqueos).toEqual(['inactividad']);
  });

  it('una salida corta tras 4:30 quieta bloquea al volver si ya suman 5 min sin tocarla', () => {
    const e = escenario();
    e.pasar(4.5 * 60_000);
    e.salir();
    e.pasar(40_000);
    e.volver();
    expect(e.bloqueos).toEqual(['inactividad']);
  });

  it('en segundo plano el reloj de inactividad no dispara (lo decide la vuelta)', () => {
    const e = escenario();
    e.salir();
    e.pasar(10 * 60_000);
    e.vigilante.revisar();
    expect(e.bloqueos).toEqual([]);
  });

  it('desbloquear cuenta como interaccion: no se vuelve a tapar al instante', () => {
    const e = escenario();
    e.pasar(INACTIVIDAD_MS);
    e.vigilante.revisar();
    e.desbloquear();
    e.vigilante.revisar();
    e.volver();
    expect(e.bloqueos).toEqual(['inactividad']);
  });

  it('ya bloqueada, ni la vuelta ni el reloj vuelven a bloquear (la hoja de Face ID pasa por inactive)', () => {
    const e = escenario();
    e.pasar(INACTIVIDAD_MS);
    e.vigilante.revisar();
    e.vigilante.cambioDeEstado('inactive');
    e.pasar(2_000);
    e.vigilante.cambioDeEstado('active');
    e.vigilante.revisar();
    expect(e.bloqueos).toEqual(['inactividad']);
  });
});

describe('(a) abrir en frio', () => {
  it('en el telefono bloquea SIEMPRE, sin mirar cuando se cerro la ultima vez', () => {
    bloquearAlArrancar();
    expect(estaBloqueada()).toBe(true);
    expect(motivoDelBloqueo()).toBe('arranque');
  });

  it('en el navegador no (no hay biometria y la sesion vive lo que la pestaña)', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      bloquearAlArrancar();
      expect(estaBloqueada()).toBe(false);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});

describe('el estado y la sesion', () => {
  it('bloquear y desbloquear avisan a quien dibuja la capa', () => {
    const oyente = jest.fn();
    const quitar = suscribirBloqueo(oyente);
    bloquear();
    bloquear();
    expect(estaBloqueada()).toBe(true);
    desbloquear();
    expect(estaBloqueada()).toBe(false);
    expect(oyente).toHaveBeenCalledTimes(2);
    quitar();
  });

  it('los toques de la raiz llegan a quien vigila', () => {
    const oyente = jest.fn();
    const quitar = suscribirInteraccion(oyente);
    registrarInteraccion();
    expect(oyente).toHaveBeenCalledTimes(1);
    quitar();
  });

  it('entrar con el PIN no deja candado; cerrar sesion lo olvida todo y borra las claves del ajuste retirado', async () => {
    await AsyncStorage.setItem('atlas.bloqueo.preferencia', 'desactivado');
    await AsyncStorage.setItem('atlas.bloqueo.salida-en', '1');
    bloquear();
    marcarSesionRecienAbierta();
    expect(estaBloqueada()).toBe(false);
    expect(sesionAbiertaConPinAhora()).toBe(true);

    olvidarBloqueo();
    await new Promise((r) => setImmediate(r));
    expect(sesionAbiertaConPinAhora()).toBe(false);
    expect(await AsyncStorage.getItem('atlas.bloqueo.preferencia')).toBeNull();
    expect(await AsyncStorage.getItem('atlas.bloqueo.salida-en')).toBeNull();
  });
});
