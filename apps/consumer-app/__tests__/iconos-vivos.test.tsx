import { render, screen } from '@testing-library/react-native';
import { Icon, ICON_NAMES } from '../src/ui/icons';
import { faseDe, SIN_BRILLO, VIDA_ICONO } from '../src/ui/icon-vivo';
import { IconChip } from '../src/ui/primitives';

/**
 * Los iconos son serios pero divertidos: dos tonos, un destello y movimiento propio. Pero sólo donde el icono es
 * protagonista: en un botón o junto a un texto se quedan quietos y sobrios.
 */
describe('Icon · modos', () => {
  it('por defecto es sobrio: sin envoltura, sin destello, sin movimiento', async () => {
    await render(<Icon name="inicio" size={22} />);
    expect(screen.queryByTestId('icono-duo-inicio')).toBeNull();
    expect(screen.queryByTestId('icono-vivo-inicio')).toBeNull();
    expect(screen.queryByTestId('icono-brillo')).toBeNull();
  });

  it('en dos tonos pone el destello en la esquina', async () => {
    await render(<Icon name="inicio" size={22} duo />);
    expect(screen.getByTestId('icono-duo-inicio')).toBeTruthy();
    expect(screen.getByTestId('icono-brillo')).toBeTruthy();
  });

  it('por debajo de 20 px no hay destello: a ese tamaño es ruido', async () => {
    await render(<Icon name="inicio" size={16} duo vivo />);
    expect(screen.getByTestId('icono-vivo-inicio')).toBeTruthy();
    expect(screen.queryByTestId('icono-brillo')).toBeNull();
  });

  it('con vida lleva su envoltura de movimiento', async () => {
    await render(<Icon name="refrescar" size={24} vivo />);
    expect(screen.getByTestId('icono-vivo-refrescar')).toBeTruthy();
    expect(screen.queryByTestId('icono-brillo')).toBeNull();
  });

  it('el escáner con vida añade la línea que barre el visor; sin vida no', async () => {
    const { rerender } = await render(<Icon name="escanear" size={24} vivo />);
    expect(screen.getByTestId('icono-barrido')).toBeTruthy();
    await rerender(<Icon name="escanear" size={24} duo />);
    expect(screen.queryByTestId('icono-barrido')).toBeNull();
  });

  it('los controles y los iconos que ya son un destello no llevan destello, ni en dos tonos', async () => {
    for (const nombre of ['atras', 'cerrar', 'clip', 'chispa', 'asistente'] as const) {
      const { unmount } = await render(<Icon name={nombre} size={24} duo />);
      expect(screen.queryByTestId('icono-brillo')).toBeNull();
      await unmount();
    }
  });

  it('todo nombre de SIN_BRILLO es un icono que existe', () => {
    for (const nombre of SIN_BRILLO) expect((ICON_NAMES as readonly string[]).includes(nombre)).toBe(true);
  });

  it('un control (flecha) con vida no revienta y se queda sin movimiento propio', async () => {
    await render(<Icon name="atras" size={24} vivo />);
    expect(screen.getByTestId('icono-vivo-atras')).toBeTruthy();
    expect(VIDA_ICONO.atras).toBeUndefined();
  });

  it('el acento se puede cambiar y el icono sigue anunciándose por su etiqueta', async () => {
    await render(<Icon name="escudo" size={24} duo acento="#FF00AA" label="Protegido" />);
    expect(screen.getByLabelText('Protegido')).toBeTruthy();
  });

  it('todos los iconos se pintan en sobrio, en dos tonos y con vida', async () => {
    for (const name of ICON_NAMES) {
      const { unmount } = await render(
        <>
          <Icon name={name} size={24} />
          <Icon name={name} size={24} duo />
          <Icon name={name} size={24} duo vivo />
        </>,
      );
      await unmount();
    }
    expect(ICON_NAMES.length).toBeGreaterThan(40);
  });
});

describe('vida de los iconos', () => {
  it('todo nombre del registro es un icono que existe (sin erratas silenciosas)', () => {
    for (const nombre of Object.keys(VIDA_ICONO)) expect((ICON_NAMES as readonly string[]).includes(nombre)).toBe(true);
  });

  it('cada movimiento es pequeño y lento: entre 1,5 y 7 s por ciclo', () => {
    for (const [nombre, vida] of Object.entries(VIDA_ICONO)) {
      expect(vida.periodo).toBeGreaterThanOrEqual(1500);
      expect(vida.periodo).toBeLessThanOrEqual(7000);
      expect(['flota', 'pulsa', 'late', 'oscila', 'gira']).toContain(vida.tipo);
      expect(nombre.length).toBeGreaterThan(0);
    }
  });

  it('los iconos protagonistas tienen movimiento: casa, escudo, chispa, refrescar, billetera', () => {
    for (const nombre of ['inicio', 'escudo', 'chispa', 'refrescar', 'billetera']) expect(VIDA_ICONO[nombre]).toBeDefined();
  });

  it('dos iconos distintos no laten a la vez', () => {
    expect(faseDe('inicio') % 1200).not.toBe(faseDe('escudo') % 1200);
    expect(faseDe('inicio')).toBe(faseDe('inicio'));
  });
});

describe('IconChip', () => {
  it('el chip enciende dos tonos y vida, porque ahí el icono es protagonista', async () => {
    await render(<IconChip name="comercio" size="lg" />);
    expect(screen.getByTestId('icono-vivo-comercio')).toBeTruthy();
    expect(screen.getByTestId('icono-brillo')).toBeTruthy();
  });

  it('el chip pequeño (16 px) no lleva destello', async () => {
    await render(<IconChip name="comercio" size="sm" />);
    expect(screen.getByTestId('icono-vivo-comercio')).toBeTruthy();
    expect(screen.queryByTestId('icono-brillo')).toBeNull();
  });
});
