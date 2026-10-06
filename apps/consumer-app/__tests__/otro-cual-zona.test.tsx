import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Domicilio from '../app/(onboarding)/domicilio';
import * as onboardingApi from '../src/api/endpoints/onboarding';

/** C6 — «Otra zona» abre «¿Cuál es tu zona o barrio?» y lo que se escribe viaja como la zona. */
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/domicilio',
}));
jest.mock('../src/session/session', () => ({
  useSession: () => ({ customerId: '42', status: 'authenticated', refresh: jest.fn(async () => undefined), reactivarSeñales: jest.fn() }),
}));
const mockRespuestas: { address: unknown } = { address: null };
jest.mock('../src/api/endpoints/onboarding', () => ({
  getAnswers: jest.fn(async () => ({ financialProfile: {}, address: mockRespuestas.address })),
  saveAddressPackage: jest.fn(async () => ({})),
}));
jest.mock('../src/device/location', () => ({
  pedirPermisoDeSegundoPlano: jest.fn(async () => false),
  pedirPermisoDeUbicacion: jest.fn(async () => false),
  permisosDeUbicacion: jest.fn(async () => ({ primerPlano: false, segundoPlano: false })),
  posicionActual: jest.fn(async () => null),
}));
jest.mock('../src/device/historial-ubicaciones', () => ({ anotarEnHistorial: jest.fn(), leerHistorial: jest.fn(async () => []) }));
jest.mock('../src/ui/mapa-punto', () => ({ MapaPunto: () => null }));
jest.mock('../src/features/use-contenido-remoto', () => ({ TrustCardRemoto: () => null }));
jest.mock('../src/ui/step-header', () => ({ StepHeader: () => null }));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const pintar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Domicilio />
    </SafeAreaProvider>,
  );
async function elegir(campo: string, opcion: RegExp) {
  await fireEvent.press(screen.getByLabelText(new RegExp(`^${campo}\\. Tocar para elegir`)));
  await fireEvent.press(screen.getByLabelText(opcion));
}
const campo = (nombre: RegExp) => screen.getAllByLabelText(nombre).find((el) => el.type === 'TextInput')!;

beforeEach(() => {
  jest.clearAllMocks();
  mockRespuestas.address = null;
});

describe('Zona «Otra zona» → ¿Cuál es tu zona o barrio?', () => {
  it('aparece sólo con «Otra zona», se exige y el nombre escrito viaja como zona', async () => {
    await pintar();
    await elegir('Departamento', /^Santa Cruz$/);
    await elegir('Ciudad', /^Santa Cruz de la Sierra$/);
    expect(screen.queryByText(/^¿Cuál es tu zona o barrio\?/)).toBeNull();
    await elegir('Zona o barrio', /^Otra zona$/);
    expect(screen.getByText(/^¿Cuál es tu zona o barrio\?/)).toBeTruthy();
    expect(screen.getByText('Falta escribir cuál es tu zona o barrio.')).toBeTruthy();
    await fireEvent.changeText(campo(/¿Cuál es tu zona o barrio\?/), 'Villa Primero de Mayo');
    await fireEvent.press(screen.getByRole('button', { name: /^Guardar|^Continuar/ }));
    await waitFor(() => expect(onboardingApi.saveAddressPackage).toHaveBeenCalled());
    const enviado = jest.mocked(onboardingApi.saveAddressPackage).mock.calls[0]![1] as { address: { zone?: string } };
    expect(enviado.address.zone).toBe('Villa Primero de Mayo');
    expect(enviado.address.zone).not.toBe('Otra zona');
  });

  it('una zona guardada fuera del catálogo vuelve como «Otra zona» con su nombre', async () => {
    mockRespuestas.address = { department: 'Santa Cruz', city: 'Santa Cruz de la Sierra', zone: 'Villa Primero de Mayo' };
    await pintar();
    await waitFor(() => expect(screen.getByDisplayValue('Villa Primero de Mayo')).toBeTruthy());
  });
});
