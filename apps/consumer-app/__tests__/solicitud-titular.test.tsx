import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as privacyApi from '../src/api/endpoints/privacy';
import {
  CAMPOS_CORREGIBLES,
  cuerposDeSolicitud,
  esAutoservicio,
  esIdentidad,
  FORMULARIO_VACIO,
  motivoParaNoEnviar,
  OPCIONES_POR_CAMPO,
  QUE_IMPLICA_BORRAR,
} from '../src/features/solicitud-titular';
import { SolicitudTitularForm } from '../src/features/solicitud-titular-form';

/**
 * Pedir corregir un dato o borrar la cuenta. Antes la app mandaba sólo «quiero corregir» sin decir qué: la cola recibía
 * solicitudes imposibles de atender. Ahora una corrección lleva el campo y el valor correcto, un borrado explica antes
 * qué implica, y las dos se confirman con el PIN.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }), usePathname: () => '/privacidad' }));
jest.mock('../src/api/endpoints/privacy', () => ({ solicitarDerecho: jest.fn() }));
// La hoja del PIN real habla con el servidor; aquí basta un doble que confirma al tocarlo.
jest.mock('../src/ui/confirmar-pin-sheet', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    ConfirmarPinSheet: ({ visible, onVerificado, motivo }: { visible: boolean; onVerificado: () => void; motivo?: string }) =>
      visible ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Confirmar PIN" onPress={onVerificado}>
          <Text>{motivo}</Text>
        </Pressable>
      ) : null,
  };
});
const solicitarDerecho = privacyApi.solicitarDerecho as jest.Mock;

const COPY = {
  derechosTitulo: 'Qué quieres pedir',
  derechosDetalle: 'Te respondemos en 15 días.',
  derechosPregunta: '¿Qué solicitud quieres hacer?',
  derechosAyuda: 'Elige corregir un dato o borrar tu cuenta.',
  derechos: [
    { value: 'rectification', label: 'Corregir un dato', detalle: 'Si algo de tu ficha está mal.' },
    { value: 'deletion', label: 'Borrar mi cuenta', detalle: 'Cerramos tu cuenta.' },
  ],
  solicitudEnviada: 'Recibimos tu solicitud.',
};
const METRICAS = initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <SolicitudTitularForm customerId="53" copy={COPY} />
    </SafeAreaProvider>,
  );
const elegirTipo = (label: string) => fireEvent.press(screen.getByRole('radio', { name: new RegExp(label) }));
const marcarCampo = (etiqueta: string) => fireEvent.press(screen.getByRole('checkbox', { name: etiqueta }));
async function elegirOpcion(campo: string, opcion: string) {
  await fireEvent.press(screen.getByLabelText(new RegExp(`^Dato correcto: ${campo}\\. Tocar para elegir`)));
  await fireEvent.press(screen.getByLabelText(new RegExp(`^${opcion}\\.`)));
}

beforeEach(() => {
  jest.clearAllMocks();
  solicitarDerecho.mockResolvedValue({ dataSubjectRequestId: '9', status: 'received' });
});

describe('reglas de la solicitud', () => {
  it('cada campo explica qué es (la guardia de ayudas lo exige) y no hay claves repetidas', () => {
    for (const opcion of CAMPOS_CORREGIBLES) expect(opcion.detalle?.length).toBeGreaterThan(10);
    expect(new Set(CAMPOS_CORREGIBLES.map((o) => o.valor)).size).toBe(CAMPOS_CORREGIBLES.length);
  });

  it('las claves son EXACTAMENTE las del backend (RECTIFICATION_FIELDS y el CHECK de la migración 20261004100000)', () => {
    expect(CAMPOS_CORREGIBLES.map((o) => o.valor)).toEqual([
      'address', 'zone', 'city', 'address_reference', 'occupation', 'employer', 'declared_income',
      'first_name', 'last_name', 'birth_date', 'document_number', 'phone', 'email', 'other',
    ]);
  });

  it('teléfono y correo son autoservicio; nombre, apellido, nacimiento y carnet son identidad', () => {
    expect(['phone', 'email'].every((c) => esAutoservicio(c as never))).toBe(true);
    expect(['first_name', 'last_name', 'birth_date', 'document_number'].every((c) => esIdentidad(c as never))).toBe(true);
    expect(esAutoservicio('zone')).toBe(false);
    expect(esIdentidad('zone')).toBe(false);
  });

  it('dice por qué todavía no se puede enviar', () => {
    const rect = { ...FORMULARIO_VACIO, tipo: 'rectification' as const };
    expect(motivoParaNoEnviar(FORMULARIO_VACIO)).toBe('Elige qué quieres pedir.');
    expect(motivoParaNoEnviar(rect)).toBe('Elige qué datos quieres corregir.');
    expect(motivoParaNoEnviar({ ...rect, campos: ['zone'] })).toBe('Escribe el dato correcto.');
    expect(motivoParaNoEnviar({ ...rect, campos: ['zone', 'city'], valores: { zone: 'Equipetrol, Santa Cruz de la Sierra' } })).toBe('Falta el dato correcto de «Ciudad».');
    expect(motivoParaNoEnviar({ ...rect, campos: ['other'] })).toBe('Cuéntanos qué dato quieres corregir.');
    expect(motivoParaNoEnviar({ ...rect, campos: ['phone'] })).toMatch(/desde Perfil/);
    expect(motivoParaNoEnviar({ ...rect, campos: ['phone', 'zone'], valores: { zone: 'Equipetrol' } })).toBeNull();
    expect(motivoParaNoEnviar({ ...FORMULARIO_VACIO, tipo: 'deletion' })).toBeNull();
  });

  it('el cuerpo lleva sólo lo necesario: una solicitud por dato, sin vacíos, y un borrado sin campo', () => {
    expect(cuerposDeSolicitud({ tipo: 'rectification', campos: ['zone'], valores: { zone: ' Equipetrol ' }, comentario: '' })).toEqual([
      { requestType: 'rectification', field: 'zone', proposedValue: 'Equipetrol' },
    ]);
    // Varios datos: uno por solicitud, en el orden de la lista; teléfono y correo no se mandan.
    expect(
      cuerposDeSolicitud({ tipo: 'rectification', campos: ['city', 'phone', 'occupation'], valores: { city: 'Montero', occupation: 'Transporte' }, comentario: 'me mudé hace poco' }),
    ).toEqual([
      { requestType: 'rectification', description: 'me mudé hace poco', field: 'city', proposedValue: 'Montero' },
      { requestType: 'rectification', description: 'me mudé hace poco', field: 'occupation', proposedValue: 'Transporte' },
    ]);
    expect(cuerposDeSolicitud({ tipo: 'deletion', campos: ['zone'], valores: { zone: 'x' }, comentario: 'ya no la uso, gracias' })).toEqual([
      { requestType: 'deletion', description: 'ya no la uso, gracias' },
    ]);
    // Un comentario de menos de 5 letras el servidor lo rechazaría: no se manda.
    expect(cuerposDeSolicitud({ tipo: 'deletion', campos: [], valores: {}, comentario: 'no' })).toEqual([{ requestType: 'deletion' }]);
  });

  it('ocupación, ciudad, zona e ingreso ofrecen sus listas cerradas, sin «otro» ni valores repetidos', () => {
    expect(Object.keys(OPCIONES_POR_CAMPO).sort()).toEqual(['city', 'declared_income', 'occupation', 'zone']);
    for (const opciones of Object.values(OPCIONES_POR_CAMPO)) {
      expect(opciones!.length).toBeGreaterThan(3);
      expect(new Set(opciones!.map((o) => o.valor)).size).toBe(opciones!.length);
      for (const o of opciones!) expect(o.detalle?.length).toBeGreaterThan(5);
    }
    expect(OPCIONES_POR_CAMPO.occupation!.map((o) => o.valor)).toContain('Comercio y ventas');
    expect(OPCIONES_POR_CAMPO.occupation!.map((o) => o.valor)).not.toContain('Otra actividad');
    expect(OPCIONES_POR_CAMPO.zone!.map((o) => o.valor)).toContain('Equipetrol, Santa Cruz de la Sierra');
  });

  it('el aviso de borrado cita la norma y el plazo de 10 años desde el cierre', () => {
    expect(QUE_IMPLICA_BORRAR.seConserva).toMatch(/10 años desde que se cierra/);
    expect(QUE_IMPLICA_BORRAR.seConserva).toMatch(/Ley 393/);
    expect(QUE_IMPLICA_BORRAR.conDeuda).toMatch(/saldo/);
  });
});

describe('el formulario', () => {
  it('se pueden marcar varios datos: cada uno pide su valor y sale una solicitud por dato', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await marcarCampo('Ocupación');
    await marcarCampo('Ciudad');
    await marcarCampo('Dirección');
    await elegirOpcion('Ocupación', 'Transporte');
    await elegirOpcion('Ciudad', 'Montero');
    // Falta la dirección: no se puede enviar y dice cuál falta.
    expect(screen.getByText('Falta el dato correcto de «Dirección».')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Dato correcto: Dirección'), 'Calle 5 número 10');
    await fireEvent.press(screen.getByRole('button', { name: /Enviar solicitud/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
    await waitFor(() => expect(solicitarDerecho).toHaveBeenCalledTimes(3));
    expect(solicitarDerecho).toHaveBeenCalledWith('53', { requestType: 'rectification', field: 'address', proposedValue: 'Calle 5 número 10' });
    expect(solicitarDerecho).toHaveBeenCalledWith('53', { requestType: 'rectification', field: 'city', proposedValue: 'Montero' });
    expect(solicitarDerecho).toHaveBeenCalledWith('53', { requestType: 'rectification', field: 'occupation', proposedValue: 'Transporte' });
    expect(await screen.findByTestId('solicitud-enviada')).toBeTruthy();
  });

  it('si una falla, lo enviado no se repite: queda sólo el dato que falló', async () => {
    const { AtlasApiError } = jest.requireActual('../src/api/errors');
    solicitarDerecho
      .mockResolvedValueOnce({ dataSubjectRequestId: '1', status: 'received' })
      .mockRejectedValueOnce(new AtlasApiError({ kind: 'validation', code: 'BAD_REQUEST', message: 'No se pudo.', status: 400 }));
    await montar();
    await elegirTipo('Corregir un dato');
    await marcarCampo('Ciudad');
    await marcarCampo('Dirección');
    await elegirOpcion('Ciudad', 'Montero');
    await fireEvent.changeText(screen.getByLabelText('Dato correcto: Dirección'), 'Calle 5 número 10');
    await fireEvent.press(screen.getByRole('button', { name: /Enviar solicitud/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
    await waitFor(() => expect(solicitarDerecho).toHaveBeenCalledTimes(2));
    // Se envía en el orden de la lista: la dirección salió; la ciudad falló y sigue en el formulario, con lo elegido.
    await waitFor(() => expect(screen.queryByLabelText(/^Dato correcto: Dirección/)).toBeNull());
    expect(screen.getByLabelText(/^Dato correcto: Ciudad/)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Ciudad' }).props.accessibilityState.checked).toBe(true);
  });

  it('ocupación se elige de la lista de actividades', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await marcarCampo('Ocupación');
    await elegirOpcion('Ocupación', 'Salud');
    await fireEvent.press(screen.getByRole('button', { name: /Enviar solicitud/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
    await waitFor(() => expect(solicitarDerecho).toHaveBeenCalledWith('53', { requestType: 'rectification', field: 'occupation', proposedValue: 'Salud' }));
  });

  it('una corrección pide el campo y el valor, confirma el PIN y manda las dos cosas', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await marcarCampo('Dirección');
    await fireEvent.changeText(screen.getByLabelText('Dato correcto: Dirección'), 'Calle Los Pinos 123');
    await fireEvent.press(screen.getByRole('button', { name: /Enviar solicitud/ }));
    // Nada sale antes de confirmar el PIN.
    expect(solicitarDerecho).not.toHaveBeenCalled();
    expect(screen.getByText(/Vas a pedir que corrijamos un dato/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
    await waitFor(() => expect(solicitarDerecho).toHaveBeenCalledWith('53', { requestType: 'rectification', field: 'address', proposedValue: 'Calle Los Pinos 123' }));
    expect(await screen.findByTestId('solicitud-enviada')).toBeTruthy();
  });

  it('sin el dato correcto no se puede enviar y lo dice', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await marcarCampo('Dirección');
    const boton = screen.getByRole('button', { name: /Enviar solicitud/ });
    expect(boton.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Escribe el dato correcto.')).toBeTruthy();
  });

  it('teléfono o correo no se piden por aquí: lleva a Perfil y no ofrece enviar', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await marcarCampo('Teléfono');
    expect(screen.getByTestId('aviso-autoservicio')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enviar solicitud/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Ir a cambiar mis datos de contacto/ }));
    expect(mockPush).toHaveBeenCalledWith('/(app)/editar-perfil');
  });

  it('un dato del carnet avisa que lo revisa una persona con el documento', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await marcarCampo('Nombres');
    await marcarCampo('Número de carnet');
    expect(screen.getByTestId('aviso-identidad')).toBeTruthy();
  });

  it('borrar la cuenta explica ANTES qué se borra y qué se conserva, y pide el PIN', async () => {
    await montar();
    await elegirTipo('Borrar mi cuenta');
    expect(screen.getByTestId('que-implica-borrar')).toBeTruthy();
    expect(screen.getByText(QUE_IMPLICA_BORRAR.seConserva)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Enviar solicitud/ }));
    expect(screen.getByText(/Vas a pedir que borremos tu cuenta/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
    await waitFor(() => expect(solicitarDerecho).toHaveBeenCalledWith('53', { requestType: 'deletion' }));
  });

  it('si el servidor rechaza, lo dice y no da la solicitud por enviada', async () => {
    const { AtlasApiError } = jest.requireActual('../src/api/errors');
    solicitarDerecho.mockRejectedValue(new AtlasApiError({ kind: 'validation', code: 'BAD_REQUEST', message: 'Falta el valor correcto.', status: 400 }));
    await montar();
    await elegirTipo('Borrar mi cuenta');
    await fireEvent.press(screen.getByRole('button', { name: /Enviar solicitud/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
    await waitFor(() => expect(solicitarDerecho).toHaveBeenCalled());
    expect(screen.queryByTestId('solicitud-enviada')).toBeNull();
  });
});
