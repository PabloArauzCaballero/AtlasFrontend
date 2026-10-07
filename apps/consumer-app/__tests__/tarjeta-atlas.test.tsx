import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AVISO_SIN_LIMITE, estaDesbloqueada, fraseDeOrigen, siguienteTarjeta } from '../src/features/tarjeta';
import { TarjetaAtlas } from '../src/ui/tarjeta-atlas';
import { TarjetaSeccion } from '../src/ui/tarjeta-seccion';
import { PROGRESO_DE_PRUEBA, tarjetaDePrueba } from './progreso-datos';

/**
 * La tarjeta Atlas: Normal, Silver, Gold, Premium, Black. Es estatus, NO dinero: ninguna frase promete límite, y la
 * escalera enseña lo que viene con candado en lo que todavía no se ganó.
 */
const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const envolver = (hijo: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICAS}>{hijo}</SafeAreaProvider>;

const conTarjeta = (card: ReturnType<typeof tarjetaDePrueba>) => ({
  ...PROGRESO_DE_PRUEBA,
  card,
});

describe('TarjetaAtlas (la pieza)', () => {
  const gold = tarjetaDePrueba('GOLD');

  it('se anuncia con su nombre y su acabado, no como una imagen muda', async () => {
    await render(envolver(<TarjetaAtlas tier={gold} testID="t" />));
    expect(screen.getByLabelText('Tarjeta Gold, acabado oro')).toBeTruthy();
    expect(screen.getByText('Gold')).toBeTruthy();
  });

  it('la grande lleva reflejo bajo el dedo; la mini y la bloqueada no', async () => {
    const { rerender } = await render(envolver(<TarjetaAtlas tier={gold} testID="t" />));
    // El reflejo se coloca cuando la tarjeta ya sabe cuánto mide.
    await fireEvent(screen.getByTestId('t'), 'layout', { nativeEvent: { layout: { width: 340, height: 214, x: 0, y: 0 } } });
    expect(screen.queryByTestId('tarjeta-destello')).toBeTruthy();
    await rerender(envolver(<TarjetaAtlas tier={gold} tamano="mini" />));
    expect(screen.queryByTestId('tarjeta-destello')).toBeNull();
    await rerender(envolver(<TarjetaAtlas tier={gold} bloqueada />));
    expect(screen.queryByTestId('tarjeta-destello')).toBeNull();
    expect(screen.getByLabelText('Tarjeta Gold, acabado oro, todavía bloqueada')).toBeTruthy();
  });

  it('con onPress es un botón que avisa a quien la toca', async () => {
    const onPress = jest.fn();
    await render(envolver(<TarjetaAtlas tier={gold} onPress={onPress} testID="t" />));
    await fireEvent.press(screen.getByLabelText(/Toca para ver tus tarjetas/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('es una tarjeta de banco: logotipo, número en relieve y el titular en mayúsculas', async () => {
    await render(envolver(<TarjetaAtlas tier={gold} titular="Pablo Arauz" testID="t" />));
    expect(screen.getByText('ATLAS')).toBeTruthy();
    expect(screen.getByText('•••• •••• •••• ••••')).toBeTruthy();
    expect(screen.getByText('PABLO ARAUZ')).toBeTruthy();
  });

  it('sin titular no inventa un nombre: dice «Miembro Atlas»', async () => {
    await render(envolver(<TarjetaAtlas tier={gold} />));
    expect(screen.getByText('MIEMBRO ATLAS')).toBeTruthy();
  });

  it('responde al dedo sin romperse: tocar, mover y soltar', async () => {
    await render(envolver(<TarjetaAtlas tier={gold} testID="t" />));
    const tarjeta = screen.getByTestId('t');
    await fireEvent(tarjeta, 'layout', { nativeEvent: { layout: { width: 340, height: 214, x: 0, y: 0 } } });
    await fireEvent(tarjeta, 'touchStart', { nativeEvent: { locationX: 300, locationY: 40 } });
    await fireEvent(tarjeta, 'touchMove', { nativeEvent: { locationX: 20, locationY: 200 } });
    await fireEvent(tarjeta, 'touchEnd', { nativeEvent: {} });
    expect(screen.getByText('Gold')).toBeTruthy();
  });

  it('un tema con un solo color no revienta: se duplica para formar el degradado', async () => {
    const sola = {
      label: 'Sola',
      theme: {
        gradient: ['#123456'],
        ink: '#fff',
        accent: '#ccc',
        finish: 'liso',
      },
    };
    await render(envolver(<TarjetaAtlas tier={sola} />));
    expect(screen.getByText('Sola')).toBeTruthy();
  });
});

describe('frases de la tarjeta', () => {
  it('la ganada por nivel lo dice y promete que cambia sola', async () => {
    const f = fraseDeOrigen(tarjetaDePrueba('SILVER'), 'En construcción');
    expect(f).toMatch(/La ganaste por tu nivel En construcción/);
    expect(f).toMatch(/cambia sola/);
  });

  it('la que da Atlas dice hasta cuándo y cuál le tocaría por nivel', async () => {
    const manual = tarjetaDePrueba('BLACK', {
      source: 'MANUAL',
      automatic: { code: 'NORMAL', label: 'Normal' },
      manual: {
        since: '2026-09-01T00:00:00Z',
        expiresAt: '2026-12-15T12:00:00Z',
      },
    });
    const f = fraseDeOrigen(manual, 'Nuevo');
    expect(f).toMatch(/Atlas te la dio hasta el/);
    expect(f).toMatch(/2026/);
    expect(f).toMatch(/Normal/);
  });

  it('sin vencimiento no inventa una fecha', async () => {
    const manual = tarjetaDePrueba('GOLD', {
      source: 'MANUAL',
      automatic: { code: 'NORMAL', label: 'Normal' },
      manual: { since: '2026-09-01T00:00:00Z', expiresAt: null },
    });
    expect(fraseDeOrigen(manual, 'Nuevo')).toMatch(/sin fecha de vencimiento/);
  });

  it('la siguiente tarjeta sale del escalón y dice qué nivel la desbloquea; la última no tiene', async () => {
    const s = siguienteTarjeta(tarjetaDePrueba('NORMAL'), PROGRESO_DE_PRUEBA.ladder);
    expect(s?.tier.code).toBe('SILVER');
    expect(s?.nivelLabel).toBe('En construcción');
    expect(siguienteTarjeta(tarjetaDePrueba('BLACK'), PROGRESO_DE_PRUEBA.ladder)).toBeNull();
  });

  it('desbloqueada es la actual y las de abajo; las de arriba no', async () => {
    const gold = tarjetaDePrueba('GOLD');
    const por = (code: string) => gold.catalog.find((t) => t.code === code)!;
    expect(estaDesbloqueada(por('NORMAL'), gold)).toBe(true);
    expect(estaDesbloqueada(por('GOLD'), gold)).toBe(true);
    expect(estaDesbloqueada(por('PREMIUM'), gold)).toBe(false);
  });
});

describe('TarjetaSeccion', () => {
  it('enseña la tarjeta, de dónde viene y la escalera con candado en las que faltan', async () => {
    await render(envolver(<TarjetaSeccion progress={conTarjeta(tarjetaDePrueba('SILVER'))} />));
    expect(screen.getByText('Tu tarjeta Silver')).toBeTruthy();
    expect(screen.getByTestId('tarjeta-origen').props.children).toMatch(/La ganaste por tu nivel/);
    expect(screen.getByTestId('tarjeta-siguiente').props.children).toMatch(/Sigue la Gold/);
    expect(screen.getAllByLabelText(/todavía bloqueada/)).toHaveLength(3);
    expect(screen.getByText('Silver · tuya')).toBeTruthy();
  });

  it('siempre aclara que la tarjeta no cambia el límite', async () => {
    await render(envolver(<TarjetaSeccion progress={conTarjeta(tarjetaDePrueba('NORMAL'))} />));
    expect(screen.getByTestId('tarjeta-aviso').props.children).toBe(AVISO_SIN_LIMITE);
    expect(AVISO_SIN_LIMITE).toMatch(/no cambia tu límite de crédito/);
  });

  it('con la más alta no promete otra y lo dice', async () => {
    await render(envolver(<TarjetaSeccion progress={conTarjeta(tarjetaDePrueba('BLACK'))} />));
    expect(screen.queryByTestId('tarjeta-siguiente')).toBeNull();
    expect(screen.getByText('Tienes la tarjeta más alta de Atlas.')).toBeTruthy();
    expect(screen.queryAllByLabelText(/todavía bloqueada/)).toHaveLength(0);
  });

  it('los beneficios sólo salen si la tarjeta los tiene', async () => {
    const sin = await render(envolver(<TarjetaSeccion progress={conTarjeta(tarjetaDePrueba('GOLD'))} />));
    expect(sin.queryByTestId('tarjeta-beneficios')).toBeNull();
    await sin.unmount();
    const con = tarjetaDePrueba('GOLD', {
      benefits: [{ text: 'Atención prioritaria' }],
    });
    await render(envolver(<TarjetaSeccion progress={conTarjeta(con)} />));
    expect(screen.getByText('Atención prioritaria')).toBeTruthy();
  });

  it('una tarjeta puesta por Atlas se distingue de la ganada', async () => {
    const manual = tarjetaDePrueba('PREMIUM', {
      source: 'MANUAL',
      automatic: { code: 'NORMAL', label: 'Normal' },
      manual: { since: '2026-09-01T00:00:00Z', expiresAt: null },
    });
    await render(envolver(<TarjetaSeccion progress={conTarjeta(manual)} />));
    expect(screen.getByTestId('tarjeta-origen').props.children).toMatch(/Atlas te la dio/);
  });
});
