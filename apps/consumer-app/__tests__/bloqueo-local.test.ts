/**
 * APP-13: el bloqueo local al volver a la app. Ver `src/features/bloqueo-local.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  anotarSalida,
  bloqueoActivado,
  bloquear,
  debePedirDesbloqueo,
  desbloquear,
  estaBloqueada,
  guardarPreferenciaDeBloqueo,
  leerPreferenciaDeBloqueo,
  leerSalida,
  marcarSesionRecienAbierta,
  olvidarBloqueo,
  sesionAbiertaConPinAhora,
  suscribirBloqueo,
  UMBRAL_BLOQUEO_MS,
} from '../src/features/bloqueo-local';

const AHORA = Date.parse('2026-10-09T12:00:00Z');

beforeEach(async () => {
  await AsyncStorage.clear();
  olvidarBloqueo();
});

describe('cuando se pide el desbloqueo', () => {
  it('a los cinco minutos justos no; un instante despues, si', () => {
    expect(UMBRAL_BLOQUEO_MS).toBe(5 * 60 * 1000);
    expect(debePedirDesbloqueo(AHORA - UMBRAL_BLOQUEO_MS, AHORA)).toBe(false);
    expect(debePedirDesbloqueo(AHORA - UMBRAL_BLOQUEO_MS - 1, AHORA)).toBe(true);
    expect(debePedirDesbloqueo(AHORA - 60_000, AHORA)).toBe(false);
  });

  it('sin saber cuando salio, o con el reloj hacia atras, se pide', () => {
    expect(debePedirDesbloqueo(null, AHORA)).toBe(true);
    expect(debePedirDesbloqueo(Number.NaN, AHORA)).toBe(true);
    expect(debePedirDesbloqueo(AHORA + 60_000, AHORA)).toBe(true);
  });
});

describe('opcional, encendido por omision solo con biometria', () => {
  it('sin decision de la persona manda la biometria', () => {
    expect(bloqueoActivado(null, true)).toBe(true);
    expect(bloqueoActivado(null, false)).toBe(false);
  });

  it('la decision de la persona manda sobre todo', () => {
    expect(bloqueoActivado('desactivado', true)).toBe(false);
    expect(bloqueoActivado('activado', false)).toBe(true);
  });

  it('la preferencia y la hora de salida sobreviven en el telefono', async () => {
    expect(await leerPreferenciaDeBloqueo()).toBeNull();
    await guardarPreferenciaDeBloqueo('desactivado');
    expect(await leerPreferenciaDeBloqueo()).toBe('desactivado');
    await anotarSalida(AHORA);
    expect(await leerSalida()).toBe(AHORA);
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

  it('entrar con el PIN no deja candado; cerrar sesion lo olvida todo, tambien la hora de salida', async () => {
    bloquear();
    marcarSesionRecienAbierta();
    expect(estaBloqueada()).toBe(false);
    expect(sesionAbiertaConPinAhora()).toBe(true);

    await anotarSalida(AHORA);
    olvidarBloqueo();
    await new Promise((r) => setImmediate(r));
    expect(sesionAbiertaConPinAhora()).toBe(false);
    expect(await leerSalida()).toBeNull();
  });
});
