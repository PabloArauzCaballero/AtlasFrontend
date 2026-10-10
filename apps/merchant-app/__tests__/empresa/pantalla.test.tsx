/**
 * «Mi empresa» montada entera, con la API simulada.
 *
 * Fija las dos lecciones que la web aprendió a golpes: las cuatro pestañas se pintan SIEMPRE, también
 * sin expediente (cada una dice lo que le falta), y nunca se ofrece ABRIR expediente mientras no se
 * sabe si ya existe.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockParams: { tab?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), setParams: (p: { tab?: string }) => Object.assign(mockParams, p) }),
  usePathname: () => '/empresa',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/session/session', () => ({ useSession: () => ({ merchant: { fullName: 'Rosa', email: 'r@sol.bo' } }) }));
jest.mock('expo-camera', () => ({ scanFromURLAsync: jest.fn() }));
jest.mock('react-native-qrcode-svg', () => () => null);

const mockMine = jest.fn();
const mockGetState = jest.fn();
jest.mock('@/api/servicios/merchantCreditService', () => ({ merchantCreditService: { misExpedientes: () => mockMine() } }));
jest.mock('@/api/servicios/partnerOnboardingService', () => ({
  ...jest.requireActual('@/api/servicios/partnerOnboardingService'),
  partnerOnboardingService: {
    getState: (id: string) => mockGetState(id),
    listQrCodes: () => Promise.resolve([]),
    qrImageUrl: () => Promise.resolve('data:image/png;base64,'),
  },
}));
jest.mock('@/api/servicios/portalService', () => ({
  portalService: {
    getScope: () => Promise.resolve({ isInternalOperator: false, requiresAccountSelection: false, accounts: [{ id: 'a', name: 'Sol' }] }),
    listBranches: () => Promise.resolve([{ id: 'e-1', name: 'Centro', city: 'La Paz', status: 'ACTIVE' }]),
  },
}));
jest.mock('@/api/client', () => ({
  ...jest.requireActual('@/api/client'),
  apiRequest: () => Promise.resolve({ domains: { 'crm.merchantCategory': [], 'portal.bankInstitution': [] } }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MiEmpresa = (require('../../app/(app)/(tabs)/empresa') as { default: () => React.JSX.Element }).default;


beforeEach(() => {
  mockParams.tab = undefined;
  mockMine.mockReset();
  mockGetState.mockReset();
});

test('sin expediente: las cuatro pestañas existen y cada una dice lo que le falta', async () => {
  mockMine.mockResolvedValue({ profiles: [] });
  await render(<MiEmpresa />);
  await screen.findByTestId('btn-abrir-expediente');
  // Las pestañas ocultas siguen montadas (`display: none`): se consultan incluyendo lo oculto.
  await waitFor(() => expect(screen.getByText('Centro', { includeHiddenElements: true })).toBeTruthy());

  for (const etiqueta of ['Estado del expediente', 'Ficha comercial', 'Mi QR de cobro', 'Sucursales']) {
    expect(screen.getByLabelText(etiqueta)).toBeTruthy();
  }
  // Estado: el formulario de abrir expediente.
  expect(screen.getByTestId('btn-abrir-expediente')).toBeTruthy();
  // Las demás, montadas aunque ocultas: dicen qué falta, y Sucursales enseña los locales del ERP.
  expect(screen.getAllByText('Primero hay que abrir tu expediente', { includeHiddenElements: true }).length).toBe(2);
  expect(screen.getByText(/Todavía no has abierto el expediente de tu empresa/, { includeHiddenElements: true })).toBeTruthy();
  expect(mockGetState).not.toHaveBeenCalled();
});

test('mientras no se sabe si hay expediente, no se ofrece abrir uno', async () => {
  mockMine.mockReturnValue(new Promise(() => undefined));
  await render(<MiEmpresa />);
  expect(screen.getByText('Comprobando si ya tienes un expediente…')).toBeTruthy();
  expect(screen.queryByTestId('btn-abrir-expediente')).toBeNull();
});

test('con expediente: enseña lo que falta y el enlace lleva a su pestaña', async () => {
  mockMine.mockResolvedValue({ profiles: [{ partnerId: 'p-1', legalName: 'Sol SRL', tradeName: null, status: 'draft' }] });
  mockGetState.mockResolvedValue({
    profile: { partnerId: 'p-1', legalName: 'Sol SRL', tradeName: null, taxId: '123', commercialRegistry: null, businessCategory: null, contactEmail: 'a@b.bo', contactPhone: null, emailVerified: false, phoneVerified: false, onboardingStatus: 'draft', submittedAt: null, decidedAt: null, rejectionReason: null, erpAccountId: null },
    gaps: [{ requirement: 'branch', detail: 'Registra una sucursal.' }],
    readyToSubmit: false,
    branches: [],
    qrCodes: [],
    posTerminals: [],
  });
  await render(<MiEmpresa />);
  expect(await screen.findByText('Falta 1 requisito para enviar a revisión')).toBeTruthy();
  expect(mockGetState).toHaveBeenCalledWith('p-1');
  expect(screen.getByTestId('pdf-mi-empresa')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('resolver-branch'));
  expect(mockParams.tab).toBe('sucursales');
});
