import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as privacyApi from '../src/api/endpoints/privacy';
import {
  CAMPOS_CORREGIBLES,
  cuerpoDeSolicitud,
  esAutoservicio,
  esIdentidad,
  FORMULARIO_VACIO,
  motivoParaNoEnviar,
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
async function elegirCampo(etiqueta: string) {
  await fireEvent.press(screen.getByLabelText('¿Qué dato quieres corregir?. Tocar para elegir'));
  await fireEvent.press(screen.getByLabelText(new RegExp(`^${etiqueta}\\.`)));
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
    expect(motivoParaNoEnviar(FORMULARIO_VACIO)).toBe('Elige qué quieres pedir.');
    expect(motivoParaNoEnviar({ ...FORMULARIO_VACIO, tipo: 'rectification' })).toBe('Elige qué dato quieres corregir.');
    expect(motivoParaNoEnviar({ ...FORMULARIO_VACIO, tipo: 'rectification', campo: 'zone' })).toBe('Escribe el dato correcto.');
    expect(motivoParaNoEnviar({ ...FORMULARIO_VACIO, tipo: 'rectification', campo: 'other' })).toBe('Cuéntanos qué dato quieres corregir.');
    expect(motivoParaNoEnviar({ ...FORMULARIO_VACIO, tipo: 'rectification', campo: 'phone' })).toMatch(/desde Perfil/);
    expect(motivoParaNoEnviar({ ...FORMULARIO_VACIO, tipo: 'rectification', campo: 'zone', valor: 'Equipetrol' })).toBeNull();
    expect(motivoParaNoEnviar({ ...FORMULARIO_VACIO, tipo: 'deletion' })).toBeNull();
  });

  it('el cuerpo lleva sólo lo necesario: sin vacíos y un borrado sin campo', () => {
    expect(cuerpoDeSolicitud({ tipo: 'rectification', campo: 'zone', valor: ' Equipetrol ', comentario: '' })).toEqual({
      requestType: 'rectification',
      field: 'zone',
      proposedValue: 'Equipetrol',
    });
    expect(cuerpoDeSolicitud({ tipo: 'deletion', campo: 'zone', valor: 'x', comentario: 'ya no la uso, gracias' })).toEqual({
      requestType: 'deletion',
      description: 'ya no la uso, gracias',
    });
    // Un comentario de menos de 5 letras el servidor lo rechazaría: no se manda.
    expect(cuerpoDeSolicitud({ tipo: 'deletion', campo: null, valor: '', comentario: 'no' })).toEqual({ requestType: 'deletion' });
  });

  it('el aviso de borrado cita la norma y el plazo de 10 años desde el cierre', () => {
    expect(QUE_IMPLICA_BORRAR.seConserva).toMatch(/10 años desde que se cierra/);
    expect(QUE_IMPLICA_BORRAR.seConserva).toMatch(/Ley 393/);
    expect(QUE_IMPLICA_BORRAR.conDeuda).toMatch(/saldo/);
  });
});

describe('el formulario', () => {
  it('una corrección pide el campo y el valor, confirma el PIN y manda las dos cosas', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await elegirCampo('Zona o barrio');
    await fireEvent.changeText(screen.getByLabelText('Dato correcto'), 'Equipetrol');
    await fireEvent.press(screen.getByRole('button', { name: /Enviar solicitud/ }));
    // Nada sale antes de confirmar el PIN.
    expect(solicitarDerecho).not.toHaveBeenCalled();
    expect(screen.getByText(/Vas a pedir que corrijamos un dato/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
    await waitFor(() => expect(solicitarDerecho).toHaveBeenCalledWith('53', { requestType: 'rectification', field: 'zone', proposedValue: 'Equipetrol' }));
    expect(await screen.findByTestId('solicitud-enviada')).toBeTruthy();
  });

  it('sin el dato correcto no se puede enviar y lo dice', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await elegirCampo('Ciudad');
    const boton = screen.getByRole('button', { name: /Enviar solicitud/ });
    expect(boton.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Escribe el dato correcto.')).toBeTruthy();
  });

  it('teléfono o correo no se piden por aquí: lleva a Perfil y no ofrece enviar', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await elegirCampo('Teléfono');
    expect(screen.getByTestId('aviso-autoservicio')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enviar solicitud/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Ir a cambiar mis datos de contacto/ }));
    expect(mockPush).toHaveBeenCalledWith('/(app)/editar-perfil');
  });

  it('un dato del carnet avisa que lo revisa una persona con el documento', async () => {
    await montar();
    await elegirTipo('Corregir un dato');
    await elegirCampo('Nombres');
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
