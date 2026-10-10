import { reglaAlVolver } from '../src/features/al-volver';
import {
  avisarCambioDeDinero,
  cancelarRepasos,
  crearLimitador,
  ESPERA_MINIMA_MS,
  REPASOS_TRAS_CAMBIO_MS,
  suscribirCambioDeDinero,
} from '../src/features/refresco';

// El archivo también exporta el hook, que importa el router: aquí sólo se prueba la regla.
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

/** Un limitador con reloj propio, para que la regla no dependa de la hora real. */
function reloj() {
  let t = 1_000_000;
  return { limitador: crearLimitador(ESPERA_MINIMA_MS, () => t), pasar: (ms: number) => (t += ms) };
}

/**
 * Las pestañas quedan montadas: sin esto Inicio y Pagos mostraban lo de antes de una compra o de un pago confirmado
 * hasta cerrar la app (Pablo, 2026-10-08 y 2026-10-09). Ver `features/refresco.ts`.
 */
describe('reglaAlVolver', () => {
  it('la primera vez no recarga (ya cargó al montarse); cada vuelta siguiente sí, y se cuenta', () => {
    const r = reloj();
    const recargar = jest.fn();
    const contar = jest.fn();
    const regla = reglaAlVolver(recargar, contar, r.limitador);

    regla.alEnfocar();
    expect(recargar).not.toHaveBeenCalled();
    expect(contar).not.toHaveBeenCalled();

    r.pasar(ESPERA_MINIMA_MS);
    regla.alEnfocar();
    r.pasar(ESPERA_MINIMA_MS);
    regla.alEnfocar();
    expect(recargar).toHaveBeenCalledTimes(2);
    expect(contar).toHaveBeenCalledTimes(2);
  });

  it('recarga cuando la app vuelve al frente, y no al irse al fondo', () => {
    const r = reloj();
    const recargar = jest.fn();
    const regla = reglaAlVolver(recargar, jest.fn(), r.limitador);
    r.pasar(ESPERA_MINIMA_MS);

    regla.alCambiarEstado('background');
    regla.alCambiarEstado('inactive');
    expect(recargar).not.toHaveBeenCalled();

    regla.alCambiarEstado('active');
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('no martilla: foco, frente y latido seguidos en menos de 5 s recargan UNA vez', () => {
    const r = reloj();
    const recargar = jest.fn();
    const regla = reglaAlVolver(recargar, jest.fn(), r.limitador);
    regla.alEnfocar();
    r.pasar(ESPERA_MINIMA_MS);
    regla.alCambiarEstado('active');
    r.pasar(1_000);
    regla.alEnfocar();
    regla.alCambiarEstado('active');
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('una operación de dinero recarga SIEMPRE, aunque acabe de recargar y aunque la pantalla no esté a la vista', () => {
    const r = reloj();
    const recargar = jest.fn();
    const regla = reglaAlVolver(recargar, jest.fn(), r.limitador);
    regla.alCambiarDinero();
    regla.alCambiarDinero();
    expect(recargar).toHaveBeenCalledTimes(2);
  });

  it('el latido de cada minuto sólo recarga con la pantalla a la vista y la app al frente', () => {
    const r = reloj();
    const recargar = jest.fn();
    const regla = reglaAlVolver(recargar, jest.fn(), r.limitador);
    r.pasar(60_000);
    regla.alLatir();
    expect(recargar).not.toHaveBeenCalled(); // sin foco
    regla.alEnfocar();
    regla.alLatir();
    expect(recargar).toHaveBeenCalledTimes(1);
    regla.alDesenfocar();
    r.pasar(60_000);
    regla.alLatir();
    expect(recargar).toHaveBeenCalledTimes(1);
    // Enfocada pero con la app en segundo plano tampoco.
    regla.alEnfocar();
    regla.alCambiarEstado('background');
    r.pasar(60_000);
    regla.alLatir();
    expect(recargar).toHaveBeenCalledTimes(2); // la vuelta al foco sí recargó; el latido en el fondo no
  });
});

describe('avisarCambioDeDinero', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    cancelarRepasos();
    jest.useRealTimers();
  });

  it('recarga ya y repasa a los 3, 10 y 30 s (el servidor confirma en diferido)', () => {
    expect(REPASOS_TRAS_CAMBIO_MS).toEqual([0, 3_000, 10_000, 30_000]);
    const oyente = jest.fn();
    const quitar = suscribirCambioDeDinero(oyente);
    avisarCambioDeDinero();
    expect(oyente).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(3_000);
    expect(oyente).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(7_000);
    expect(oyente).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(20_000);
    expect(oyente).toHaveBeenCalledTimes(4);
    jest.advanceTimersByTime(60_000);
    expect(oyente).toHaveBeenCalledTimes(4);
    quitar();
  });

  it('un segundo aviso reinicia los repasos en vez de duplicarlos', () => {
    const oyente = jest.fn();
    const quitar = suscribirCambioDeDinero(oyente);
    avisarCambioDeDinero();
    jest.advanceTimersByTime(1_000);
    avisarCambioDeDinero();
    jest.advanceTimersByTime(30_000);
    // 1 + 1 inmediatos, y 3 repasos del segundo aviso (los del primero se cancelaron).
    expect(oyente).toHaveBeenCalledTimes(5);
    quitar();
  });

  it('al cerrar sesión no queda ningún repaso pendiente', () => {
    const oyente = jest.fn();
    const quitar = suscribirCambioDeDinero(oyente);
    avisarCambioDeDinero();
    cancelarRepasos();
    jest.advanceTimersByTime(60_000);
    expect(oyente).toHaveBeenCalledTimes(1);
    quitar();
  });
});
