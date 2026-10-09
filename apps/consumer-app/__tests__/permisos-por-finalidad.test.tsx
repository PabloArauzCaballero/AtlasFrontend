/**
 * APP-12: un consentimiento por finalidad. «Permitir» en la tarjeta de la ubicación pide SOLO la
 * ubicación; la agenda se decide en la suya. Lo que se guarda es lo elegido en cada tarjeta.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Permisos from '../app/(public)/permisos';
import { decisionFinal, faltaPorDecidir, SIN_ELEGIR } from '../src/features/decision-de-permisos';

const mockReplace = jest.fn();
const mockReactivar = jest.fn(async () => undefined);
const mockPedirUbicacion = jest.fn(async () => true);
const mockPedirContactos = jest.fn(async () => true);
const mockGuardar = jest.fn(async (_: unknown) => undefined);

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => true, navigate: jest.fn() }),
  usePathname: () => '/permisos',
}));
jest.mock('../src/session/session', () => ({
  useSession: () => ({ status: 'authenticated', reactivarSeñales: () => mockReactivar() }),
}));
jest.mock('../src/api/endpoints/app-content', () => ({ getContent: jest.fn(async () => []) }));
jest.mock('../src/device/permissions', () => ({ pedirPermisoDeContactos: () => mockPedirContactos() }));
jest.mock('../src/device/location', () => ({
  pedirPermisoDeUbicacion: () => mockPedirUbicacion(),
  pedirPermisoDeSegundoPlano: jest.fn(async () => false),
  permisosDeUbicacion: jest.fn(async () => ({ primerPlano: false, segundoPlano: false })),
}));
jest.mock('../src/session/permisos-de-arranque', () => ({
  guardarDecisionDeArranque: (d: unknown) => mockGuardar(d),
  leerDecisionDeArranque: jest.fn(async () => null),
}));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = async () => {
  await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Permisos />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('la decisión, pura', () => {
  it('hasta decidir las dos no se sigue', () => {
    expect(faltaPorDecidir(SIN_ELEGIR)).toMatch(/cada tarjeta/);
    expect(faltaPorDecidir({ ubicacion: 'concedido', contactos: 'pendiente' })).toMatch(/contactos/);
    expect(faltaPorDecidir({ ubicacion: 'omitido', contactos: 'denegado' })).toBeNull();
  });

  it('cada permiso se registra con lo suyo', () => {
    expect(decisionFinal({ ubicacion: 'concedido', contactos: 'omitido' }, true)).toEqual({ ubicacion: true, ubicacionSiempre: true, contactos: false });
    expect(decisionFinal({ ubicacion: 'denegado', contactos: 'concedido' }, true)).toEqual({ ubicacion: false, ubicacionSiempre: false, contactos: true });
  });
});

describe('la pantalla', () => {
  it('«Permitir mi ubicación» pide sólo la ubicación', async () => {
    await montar();
    await act(async () => {
      fireEvent.press(screen.getByText('Permitir mi ubicación'));
    });
    expect(mockPedirUbicacion).toHaveBeenCalledTimes(1);
    expect(mockPedirContactos).not.toHaveBeenCalled();
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it('ubicación sí y contactos «Ahora no»: se guarda y registra cada uno con lo suyo', async () => {
    await montar();
    await act(async () => {
      fireEvent.press(screen.getByText('Permitir mi ubicación'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Ahora no'));
    });
    expect(mockPedirContactos).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar'));
    });
    expect(mockGuardar).toHaveBeenCalledWith({ ubicacion: true, ubicacionSiempre: false, contactos: false });
    expect(mockReactivar).toHaveBeenCalledTimes(1);
  });

  it('«Ahora no» en las dos tarjetas cierra la sección con dos negativas', async () => {
    await montar();
    await act(async () => {
      fireEvent.press(screen.getAllByText('Ahora no')[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText('Ahora no')[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar'));
    });
    expect(mockPedirUbicacion).not.toHaveBeenCalled();
    expect(mockPedirContactos).not.toHaveBeenCalled();
    expect(mockGuardar).toHaveBeenCalledWith({ ubicacion: false, ubicacionSiempre: false, contactos: false });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
