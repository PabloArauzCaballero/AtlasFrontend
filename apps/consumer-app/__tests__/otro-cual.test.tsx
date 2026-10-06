import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Economia from '../app/(onboarding)/economia';
import EditarPerfil from '../app/(app)/editar-perfil';
import * as onboardingApi from '../src/api/endpoints/onboarding';

/** C6 — toda opción «Otro/Otra» abre un campo «¿Cuál?», lo exige y lo envía. Pablo, 2026-10-06. */
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/x',
}));
jest.mock('../src/session/session', () => ({
  useSession: () => ({ customerId: '42', status: 'authenticated', refresh: jest.fn(async () => undefined), me: { profile: {} } }),
}));
jest.mock('../src/api/endpoints/onboarding', () => ({
  getAnswers: jest.fn(async () => ({ financialProfile: {}, address: null })),
  updateFinancialProfile: jest.fn(async () => ({ customerId: '42', updatedAttributes: [] })),
  updateProfile: jest.fn(async () => ({})),
}));
jest.mock('../src/ui/adjunto-de-apoyo', () => ({ AdjuntoDeApoyo: () => null }));
jest.mock('../src/features/use-contenido-remoto', () => ({ TrustCardRemoto: () => null }));
jest.mock('../src/ui/step-header', () => ({ StepHeader: () => null }));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const pintar = (el: React.ReactElement) => render(<SafeAreaProvider initialMetrics={METRICAS}>{el}</SafeAreaProvider>);

async function elegir(campo: string, opcion: RegExp) {
  await fireEvent.press(screen.getByLabelText(new RegExp(`^${campo.replace(/[?.*+()]/g, '\\$&')}\\. Tocar para elegir`)));
  await fireEvent.press(screen.getByLabelText(opcion));
}

/** El `TextInput` del campo (la etiqueta también la llevan el rótulo y su ⓘ). */
const campo = (nombre: RegExp) => screen.getAllByLabelText(nombre).find((el) => el.type === 'TextInput')!;

beforeEach(() => jest.clearAllMocks());

describe('Rubro «Otra actividad» → ¿Cuál es tu actividad?', () => {
  it('no aparece con un rubro de la lista; aparece al elegir «Otra actividad»', async () => {
    await pintar(<Economia />);
    expect(screen.queryByText(/^¿Cuál es tu actividad\?/)).toBeNull();
    await elegir('Rubro o industria', /^Otra actividad\./);
    expect(screen.getByText(/^¿Cuál es tu actividad\?/)).toBeTruthy();
  });

  it('se exige y viaja como economicActivityOther junto a Z-OTRO', async () => {
    await pintar(<Economia />);
    await elegir('Situación laboral', /^Estudio\./);
    await elegir('Rango de ingreso mensual', /^Bs 3\.000 a 5\.000\./);
    await elegir('¿Cada cuánto cobras?', /^Mensual\./);
    await elegir('Rubro o industria', /^Otra actividad\./);
    // Sin decir cuál, Guardar sigue bloqueado y explica por qué.
    expect(screen.getByText('Falta escribir cuál es tu actividad.')).toBeTruthy();
    await fireEvent.changeText(campo(/¿Cuál es tu actividad\?/), 'Apicultura');
    await fireEvent.press(screen.getByRole('button', { name: /^Guardar/ }));
    await waitFor(() => expect(onboardingApi.updateFinancialProfile).toHaveBeenCalled());
    expect(jest.mocked(onboardingApi.updateFinancialProfile).mock.calls[0]![1]).toMatchObject({
      economicActivityCode: 'Z-OTRO',
      economicActivityOther: 'Apicultura',
    });
  });

  it('volver a un rubro de la lista borra el «¿cuál?»', async () => {
    await pintar(<Economia />);
    await elegir('Rubro o industria', /^Otra actividad\./);
    await fireEvent.changeText(campo(/¿Cuál es tu actividad\?/), 'Apicultura');
    await fireEvent.press(screen.getByLabelText(/^Rubro o industria: Otra actividad/));
    await fireEvent.press(screen.getByLabelText(/^Transporte\./));
    expect(screen.queryByText(/^¿Cuál es tu actividad\?/)).toBeNull();
  });
});

describe('Género «Otro» → ¿Cuál?', () => {
  it('aparece sólo con «Otro», bloquea el guardado vacío y envía el texto', async () => {
    await pintar(<EditarPerfil />);
    expect(screen.queryByText(/^¿Cuál\?/)).toBeNull();
    await elegir('Género', /^Otro\./);
    expect(screen.getByText(/^¿Cuál\?/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Guardar cambios/ }));
    expect(onboardingApi.updateProfile).not.toHaveBeenCalled();
    await fireEvent.changeText(campo(/^¿Cuál\?/), 'No binario');
    await fireEvent.press(screen.getByRole('button', { name: /^Guardar cambios/ }));
    await waitFor(() => expect(onboardingApi.updateProfile).toHaveBeenCalled());
    expect(jest.mocked(onboardingApi.updateProfile).mock.calls[0]![1]).toMatchObject({
      genderDeclared: 'other',
      genderSelfDescribed: 'No binario',
    });
  });

  it('con otro género no se envía ningún «¿cuál?»', async () => {
    await pintar(<EditarPerfil />);
    await elegir('Género', /^Mujer\./);
    await fireEvent.press(screen.getByRole('button', { name: /^Guardar cambios/ }));
    await waitFor(() => expect(onboardingApi.updateProfile).toHaveBeenCalled());
    expect(jest.mocked(onboardingApi.updateProfile).mock.calls[0]![1]).not.toHaveProperty('genderSelfDescribed');
  });
});
