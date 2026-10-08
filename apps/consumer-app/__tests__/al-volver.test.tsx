import { reglaAlVolver } from '../src/features/al-volver';

// El archivo también exporta el hook, que importa el router: aquí sólo se prueba la regla.
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

/**
 * Las pestañas quedan montadas: sin esto Inicio y Pagos mostraban lo de antes de una compra o de un pago confirmado
 * hasta cerrar la app (Pablo, 2026-10-08).
 */
describe('reglaAlVolver', () => {
  it('la primera vez no recarga (ya cargó al montarse); cada vuelta siguiente sí, y se cuenta', () => {
    const recargar = jest.fn();
    const contar = jest.fn();
    const regla = reglaAlVolver(recargar, contar);

    regla.alEnfocar();
    expect(recargar).not.toHaveBeenCalled();
    expect(contar).not.toHaveBeenCalled();

    regla.alEnfocar();
    regla.alEnfocar();
    expect(recargar).toHaveBeenCalledTimes(2);
    expect(contar).toHaveBeenCalledTimes(2);
  });

  it('recarga cuando la app vuelve al frente, y no al irse al fondo', () => {
    const recargar = jest.fn();
    const regla = reglaAlVolver(recargar, jest.fn());

    regla.alCambiarEstado('background');
    regla.alCambiarEstado('inactive');
    expect(recargar).not.toHaveBeenCalled();

    regla.alCambiarEstado('active');
    expect(recargar).toHaveBeenCalledTimes(1);
  });
});
