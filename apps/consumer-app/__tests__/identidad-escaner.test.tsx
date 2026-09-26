/* eslint-disable @typescript-eslint/no-require-imports -- las fabricas de jest.mock y isolateModules solo admiten require. */
/**
 * La pantalla del carnet con el escaner del sistema, montada de verdad.
 *
 * Lo que se prueba es la DECISION de la pantalla —que camino toma con cada resultado del escaner y
 * con la bandera apagada— y lo que ve la persona durante la subida. El escaner, la camara y la
 * subida se simulan: aqui no hay VisionKit, ni sensor, ni almacen.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Identity from '../app/(onboarding)/identidad';
import { escanearDocumento, escanerHabilitado } from '../src/device/escaner-documento';
import { uploadEvidence, type PreparedEvidence } from '../src/features/evidence-upload';

const mockTomarFoto = jest.fn();

jest.mock('expo-camera', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const CameraView = React.forwardRef((_props: object, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ takePictureAsync: (...args: unknown[]) => mockTomarFoto(...args) }));
    return <View testID="visor-de-la-camara" />;
  });
  CameraView.displayName = 'CameraView';
  return { CameraView, useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()] };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true, navigate: jest.fn() }),
  usePathname: () => '/identidad',
}));
jest.mock('../src/session/session', () => ({
  useSession: () => ({ customerId: '42', refresh: jest.fn(), status: 'authenticated', me: null, profile: null, onboarding: null }),
}));
jest.mock('../src/device/escaner-documento', () => ({ escanearDocumento: jest.fn(), escanerHabilitado: jest.fn() }));
jest.mock('../src/device/camara-de-prueba', () => ({
  ...jest.requireActual('../src/device/camara-de-prueba'),
  estaDisponible: () => false,
}));
jest.mock('../src/features/evidence-upload', () => ({
  ...jest.requireActual('../src/features/evidence-upload'),
  uploadEvidence: jest.fn(),
}));

const escanear = escanearDocumento as jest.Mock;
const habilitado = escanerHabilitado as jest.Mock;
const subir = uploadEvidence as jest.Mock;

const metricas = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const pintar = () =>
  render(
    <SafeAreaProvider initialMetrics={metricas}>
      <Identity />
    </SafeAreaProvider>,
  );

/** El carrusel mide su ancho al pintarse; fuera del telefono hay que darselo. */
function medirCarrusel() {
  return fireEvent(screen.getByTestId('carrusel-de-capturas'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 400 } } });
}

const preparada = (input: { kind: PreparedEvidence['kind']; localUri: string; captureSource?: 'camera' | 'system_scanner' }): PreparedEvidence => ({
  kind: input.kind,
  localUri: input.localUri,
  storageKey: `1/customer-42/${input.kind}/x.jpg`,
  sha256Hash: 'b'.repeat(64),
  sizeBytes: 1_200_000,
  mimeType: 'image/jpeg',
  ...(input.captureSource ? { captureSource: input.captureSource } : {}),
});

beforeEach(() => {
  jest.clearAllMocks();
  subir.mockImplementation(async (input) => preparada(input));
});

describe('identidad con la bandera del escaner encendida', () => {
  beforeEach(() => habilitado.mockReturnValue(true));

  it('«Tomar foto» del anverso abre el escaner, sube lo escaneado con su origen y pasa al reverso', async () => {
    escanear.mockResolvedValue({ tipo: 'imagen', uri: 'file:///escaneo.jpg', ancho: 2400, alto: 1513, origen: 'escaner_sistema' });
    await pintar();
    await medirCarrusel();
    expect(screen.getByText('1 de 3')).toBeTruthy();

    await fireEvent.press(screen.getByText('Tomar foto'));

    await waitFor(() => expect(subir).toHaveBeenCalledTimes(1));
    expect(escanear).toHaveBeenCalledTimes(1);
    expect(subir.mock.calls[0]![0]).toMatchObject({ customerId: '42', kind: 'identity_front', localUri: 'file:///escaneo.jpg', captureSource: 'system_scanner' });
    // Con plazo y con forma de cancelar.
    expect(typeof subir.mock.calls[0]![0].plazo).toBe('function');
    expect(subir.mock.calls[0]![0].signal).toBeDefined();
    // Y el carrusel se va a la siguiente pendiente, no a la primera.
    await waitFor(() => expect(screen.getByText('2 de 3')).toBeTruthy());
    expect(screen.getByText('Reverso del carnet')).toBeTruthy();
    // Ni la camara de la app ni una segunda confirmacion: lo escaneado queda en la lamina.
    expect(screen.queryByTestId('visor-de-la-camara')).toBeNull();
  });

  it('si el escaner no esta disponible, abre la camara de siempre y sube con origen «camera»', async () => {
    escanear.mockResolvedValue({ tipo: 'no_disponible', motivo: 'sin_play_services' });
    mockTomarFoto.mockResolvedValue({ uri: 'file:///foto.jpg' });
    await pintar();

    await fireEvent.press(screen.getByText('Tomar foto'));

    await waitFor(() => expect(screen.getByTestId('visor-de-la-camara')).toBeTruthy());
    // La mira del carnet, con su forma apaisada.
    expect(screen.getByTestId('mira-con-forma')).toBeTruthy();
    expect(subir).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Tomar foto'));
    await waitFor(() => expect(subir).toHaveBeenCalledTimes(1));
    expect(mockTomarFoto).toHaveBeenCalledWith({ quality: 0.7, skipProcessing: true });
    expect(subir.mock.calls[0]![0]).toMatchObject({ kind: 'identity_front', localUri: 'file:///foto.jpg', captureSource: 'camera' });
  });

  it('si la persona cancela el escaner, no pasa nada', async () => {
    escanear.mockResolvedValue({ tipo: 'cancelado' });
    await pintar();

    await fireEvent.press(screen.getByText('Tomar foto'));

    await waitFor(() => expect(escanear).toHaveBeenCalledTimes(1));
    expect(subir).not.toHaveBeenCalled();
    expect(screen.queryByTestId('visor-de-la-camara')).toBeNull();
    expect(screen.queryByText('Repite la foto')).toBeNull();
  });

  it('un recorte pequeño o que no es el carnet entero no se sube: se pide repetirlo', async () => {
    escanear.mockResolvedValueOnce({ tipo: 'imagen', uri: 'file:///chico.jpg', ancho: 1000, alto: 630, origen: 'escaner_sistema' });
    await pintar();
    await fireEvent.press(screen.getByText('Tomar foto'));
    await waitFor(() => expect(screen.getByText('La imagen salió muy pequeña. Acerca un poco el teléfono.')).toBeTruthy());
    expect(subir).not.toHaveBeenCalled();

    escanear.mockResolvedValueOnce({ tipo: 'imagen', uri: 'file:///cuadrado.jpg', ancho: 2000, alto: 2000, origen: 'escaner_sistema' });
    await fireEvent.press(screen.getByText('Repetir la foto'));
    await waitFor(() => expect(screen.getByText('No parece el carnet entero. Repite con los cuatro bordes a la vista.')).toBeTruthy());
    expect(subir).not.toHaveBeenCalled();
  });

  it('la selfie NO usa el escaner: abre la camara frontal de siempre, sin la mira del carnet', async () => {
    await pintar();
    await medirCarrusel();
    await fireEvent.press(screen.getByText('Siguiente'));
    await fireEvent.press(screen.getByText('Siguiente'));
    await waitFor(() => expect(screen.getByText('3 de 3')).toBeTruthy());

    await fireEvent.press(screen.getByText('Tomar foto'));

    await waitFor(() => expect(screen.getByTestId('visor-de-la-camara')).toBeTruthy());
    expect(escanear).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mira-con-forma')).toBeNull();
  });

  it('durante la subida dice que esta subiendo y deja cancelarla; tras un fallo, «Reintentar» sube la MISMA foto', async () => {
    escanear.mockResolvedValue({ tipo: 'imagen', uri: 'file:///escaneo.jpg', ancho: 2400, alto: 1513, origen: 'escaner_sistema' });
    let senal: AbortSignal | undefined;
    subir.mockImplementationOnce(
      (input: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          senal = input.signal;
          input.signal?.addEventListener('abort', () => {
            const { AtlasApiError } = jest.requireActual('../src/api/errors');
            reject(new AtlasApiError({ kind: 'timeout', code: 'UPLOAD_CANCELLED', message: 'cancelada' }));
          });
        }),
    );
    await pintar();
    await fireEvent.press(screen.getByText('Tomar foto'));

    await waitFor(() => expect(screen.getByText('Subiendo el anverso…')).toBeTruthy());
    await fireEvent.press(screen.getByText('Cancelar la subida'));
    await waitFor(() => expect(screen.queryByText('Subiendo el anverso…')).toBeNull());
    expect(senal?.aborted).toBe(true);
    // Cancelar no es un error.
    expect(screen.queryByText('Reintentar')).toBeNull();

    // Ahora el plazo vence: el mensaje es propio, y reintentar no vuelve a abrir el escaner.
    subir.mockImplementationOnce(async () => {
      const { AtlasApiError } = jest.requireActual('../src/api/errors');
      throw new AtlasApiError({ kind: 'timeout', code: 'UPLOAD_TIMEOUT', message: 'vencio' });
    });
    await fireEvent.press(screen.getByText('Tomar foto'));
    await waitFor(() => expect(screen.getByText('La foto no terminó de subirse')).toBeTruthy());
    expect(escanear).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByText('Reintentar'));
    await waitFor(() => expect(subir).toHaveBeenCalledTimes(3));
    expect(escanear).toHaveBeenCalledTimes(2);
    expect(subir.mock.calls[2]![0]).toMatchObject({ kind: 'identity_front', localUri: 'file:///escaneo.jpg', captureSource: 'system_scanner' });
  });
});

describe('identidad con la bandera apagada: como siempre', () => {
  beforeEach(() => habilitado.mockReturnValue(false));

  it('«Tomar foto» abre la camara de la app y el escaner ni se toca', async () => {
    mockTomarFoto.mockResolvedValue({ uri: 'file:///foto.jpg' });
    await pintar();

    await fireEvent.press(screen.getByText('Tomar foto'));
    await waitFor(() => expect(screen.getByTestId('visor-de-la-camara')).toBeTruthy());
    await fireEvent.press(screen.getByText('Tomar foto'));

    await waitFor(() => expect(subir).toHaveBeenCalledTimes(1));
    expect(escanear).not.toHaveBeenCalled();
    expect(mockTomarFoto).toHaveBeenCalledWith({ quality: 0.7, skipProcessing: true });
    // Se pasa el origen, pero con la bandera apagada `uploadEvidence` no lo manda (origen-de-captura.test.ts).
    expect(subir.mock.calls[0]![0]).toMatchObject({ kind: 'identity_front', localUri: 'file:///foto.jpg' });
    // Guardada, vuelve al formulario... y el carrusel, montado de nuevo, esta ya en el reverso.
    await waitFor(() => expect(screen.queryByTestId('visor-de-la-camara')).toBeNull());
    await medirCarrusel();
    await waitFor(() => expect(screen.getByText('2 de 3')).toBeTruthy());
  });

  it('con una subida en curso, «Cancelar» de la camara corta la subida y deja la camara abierta', async () => {
    mockTomarFoto.mockResolvedValue({ uri: 'file:///foto.jpg' });
    let senal: AbortSignal | undefined;
    subir.mockImplementationOnce(
      (input: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          senal = input.signal;
          input.signal?.addEventListener('abort', () => {
            const { AtlasApiError } = jest.requireActual('../src/api/errors');
            reject(new AtlasApiError({ kind: 'timeout', code: 'UPLOAD_CANCELLED', message: 'cancelada' }));
          });
        }),
    );
    await pintar();
    await fireEvent.press(screen.getByText('Tomar foto'));
    await waitFor(() => expect(screen.getByTestId('visor-de-la-camara')).toBeTruthy());
    await fireEvent.press(screen.getByText('Tomar foto'));
    await waitFor(() => expect(screen.getByText('Subiendo el anverso…')).toBeTruthy());

    await fireEvent.press(screen.getByText('Cancelar la subida'));

    await waitFor(() => expect(screen.queryByText('Subiendo el anverso…')).toBeNull());
    expect(senal?.aborted).toBe(true);
    expect(screen.getByTestId('visor-de-la-camara')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });
});

describe('textos', () => {
  const fuente = readFileSync(join(__dirname, '..', 'app', '(onboarding)', 'identidad.tsx'), 'utf8');
  const appJson = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8'));
  const PERMISO = 'Atlas usa la cámara para escanear el QR del comercio, fotografiar tu carnet y tomar tu selfie.';

  it('el aviso de la fecha ya no pide un formato: se elige en el calendario', () => {
    expect(fuente).not.toMatch(/en formato AAAA-MM-DD/);
    expect(fuente).toMatch(/'Falta la fecha de vencimiento del carnet: elígela en el calendario\.'/);
  });

  it('el permiso de camara dice para que se usa, en el plugin y en el Info.plist (que no se pisen)', () => {
    const plugin = appJson.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-camera');
    expect(plugin[1].cameraPermission).toBe(PERMISO);
    expect(appJson.expo.ios.infoPlist.NSCameraUsageDescription).toBe(PERMISO);
  });
});
