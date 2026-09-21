/**
 * El codigo de verificacion SALE AL LLEGAR a la pantalla, sin que nadie pulse nada.
 *
 * ## Por que existe esta prueba
 *
 * Porque su ausencia costo el alta entera. La pantalla decia, en pasado, «Te enviamos un codigo» y
 * no habia pedido ninguno: el envio colgaba de un boton que nadie relaciona con «enviar» cuando la
 * pantalla ya afirma haber enviado. La gente esperaba en su bandeja un mensaje que no existia. El
 * servidor nunca tuvo la culpa —contra TEST responde `deliveryStatus: "sent"` en cuanto se le
 * pide—, y la prueba de navegador que cubria este paso tampoco lo vio porque ELLA SI pulsaba el
 * boton, es decir, hacia por su cuenta lo unico que faltaba.
 *
 * Esta prueba monta la pantalla y no toca nada. Es la unica forma de que «no hace falta tocar nada»
 * sea comprobable. Vale para el telefono y para la web: la pantalla es la misma en los dos.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AtlasApiError } from '../src/api/errors';
import VerifyContact from '../app/(onboarding)/verificar-contacto';
import * as onboardingApi from '../src/api/endpoints/onboarding';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true, navigate: jest.fn() }),
  usePathname: () => '/verificar-contacto',
}));

jest.mock('../src/session/session', () => ({
  useSession: () => ({ customerId: '42', refresh: jest.fn(), status: 'authenticated', me: null, profile: null, onboarding: null }),
}));

jest.mock('../src/api/endpoints/onboarding', () => ({
  listVerificationChannels: jest.fn(),
  requestContactVerification: jest.fn(),
  submitContactVerification: jest.fn(),
}));

const listVerificationChannels = onboardingApi.listVerificationChannels as jest.Mock;
const requestContactVerification = onboardingApi.requestContactVerification as jest.Mock;

const dentroDeDiezMinutos = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

/*
  `Screen` pide los margenes del sistema y fuera del dispositivo no hay ninguno: sin proveedor, el
  hook lanza «No safe area value available» antes de que se monte nada. Las medidas dan igual —lo
  que se prueba no las mira—, pero tienen que existir.
*/
const metricas = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const pintar = () =>
  render(
    <SafeAreaProvider initialMetrics={metricas}>
      <VerifyContact />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  requestContactVerification.mockResolvedValue({
    verificationAttemptId: '1',
    contactType: 'phone',
    deliveryStatus: 'sent',
    expiresAt: dentroDeDiezMinutos(),
  });
});

describe('la pantalla de verificacion del contacto', () => {
  it('pide el codigo sola al abrirse, sin ningun toque', async () => {
    listVerificationChannels.mockResolvedValue({
      channels: [
        { channel: 'email', available: true },
        { channel: 'sms', available: true },
        { channel: 'whatsapp', available: false },
      ],
    });

    await pintar();

    await waitFor(() => expect(requestContactVerification).toHaveBeenCalledTimes(1));
    expect(requestContactVerification).toHaveBeenCalledWith('42', { contactType: 'phone', verificationChannel: 'sms' });

    // Y lo dice: sin esto, un codigo enviado del que la pantalla no informa es igual de inutil.
    await waitFor(() => expect(screen.getByText('Código enviado')).toBeTruthy());
  });

  /*
    El canal se toma del CATALOGO, no del estado inicial.
    El valor inicial es `whatsapp` y en TEST esta apagado: pedirlo devuelve
    VERIFICATION_CHANNEL_UNAVAILABLE a quien acaba de crear su cuenta y no ha hecho nada mal. El
    catalogo llega en el mismo commit en el que se dispara el envio, asi que leer el estado ahi da
    el valor viejo; por eso el canal viaja como argumento.
  */
  it('no pide por un canal que el servidor tiene apagado', async () => {
    listVerificationChannels.mockResolvedValue({
      channels: [
        { channel: 'email', available: true },
        { channel: 'sms', available: false },
        { channel: 'whatsapp', available: false },
      ],
    });

    await pintar();

    await waitFor(() => expect(requestContactVerification).toHaveBeenCalledTimes(1));
    // Sin ningun canal de telefono encendido, la unica ronda posible es la del correo.
    expect(requestContactVerification).toHaveBeenCalledWith('42', { contactType: 'email', verificationChannel: 'email' });
  });

  /*
    Si la consulta del catalogo falla, el respaldo son los tres canales y el alta sigue: quedarse sin
    poder pedir el codigo porque una consulta auxiliar no contesto seria cambiar un problema pequeno
    por uno que no tiene salida.
  */
  it('envia igual cuando el catalogo de canales no contesta', async () => {
    listVerificationChannels.mockRejectedValue(new Error('sin red'));

    await pintar();

    await waitFor(() => expect(requestContactVerification).toHaveBeenCalledTimes(1));
  });

  /*
    Volver a entrar dentro de los 30 s de guarda del servidor NO es un fallo: el codigo anterior
    sigue valiendo diez minutos. Antes de esto, salir y volver recibia a alguien que tiene el codigo
    en la mano con un «Algo no salió bien» y sin campo donde escribirlo.
  */
  it('cuando el servidor dice que ya mando uno, no pinta un error: pide que lo escriban', async () => {
    listVerificationChannels.mockResolvedValue({ channels: [{ channel: 'sms', available: true }] });
    requestContactVerification.mockRejectedValue(
      new AtlasApiError({ kind: 'conflict', code: 'VERIFICATION_RATE_LIMITED', message: 'VERIFICATION_RATE_LIMITED', status: 409 }),
    );

    await pintar();

    await waitFor(() => expect(screen.getByText('Código enviado')).toBeTruthy());
    expect(screen.getByText(/revisa tus mensajes/i)).toBeTruthy();
    expect(screen.queryByText(/Algo no salió bien/i)).toBeNull();
    // Y el campo del codigo, que es lo unico que hay que hacer ahi.
    expect(screen.getByLabelText(/^Código recibido/)).toBeTruthy();
  });

  /* Un solo envio por ronda: nada de un mensaje por cada repintado. */
  it('no pide el codigo mas de una vez', async () => {
    listVerificationChannels.mockResolvedValue({ channels: [{ channel: 'sms', available: true }] });

    const { rerender } = await pintar();
    await waitFor(() => expect(requestContactVerification).toHaveBeenCalledTimes(1));
    await rerender(
      <SafeAreaProvider initialMetrics={metricas}>
        <VerifyContact />
      </SafeAreaProvider>,
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(requestContactVerification).toHaveBeenCalledTimes(1);
  });
});
