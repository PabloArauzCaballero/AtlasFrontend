/* eslint-disable @typescript-eslint/no-require-imports -- las fabricas de jest.mock solo admiten require. */
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { PruebaDeVida } from '../src/ui/prueba-de-vida';

jest.mock('expo-camera', () => {
  const { View } = require('react-native') as typeof import('react-native');
  const React = require('react') as typeof import('react');
  return {
    CameraView: React.forwardRef(function CameraView(_props: unknown, _ref: unknown) {
      return <View testID="camara" />;
    }),
  };
});
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));

const metricas = initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const POSES = [
  { kind: 'selfie', titulo: 'Mira de frente', instruccion: 'Pon tu cara dentro de la silueta.' },
  { kind: 'selfie_left', titulo: 'Gira a tu izquierda', instruccion: 'Despacio.' },
  { kind: 'selfie_right', titulo: 'Gira a tu derecha', instruccion: 'Despacio.' },
] as const;

/**
 * La prueba de vida nunca puede bloquear el alta (Pablo, 2026-10-07): si la foto automática no sale, la persona tiene que poder sacarla
 * ella misma, y las tres. «Tomar ahora» estaba escondido hasta los 8 s; ahora está desde el primer momento de cada pose.
 */
describe('prueba de vida: la foto manual siempre está', () => {
  it('«Tomar ahora» se ve desde el primer momento, sin esperar a que falle el automático', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <PruebaDeVida poses={POSES} onFoto={jest.fn(async () => undefined)} onTerminar={jest.fn()} onSalir={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('prueba-de-vida-manual')).toBeTruthy();
    expect(screen.getByText('Tomar ahora')).toBeTruthy();
  });

  it('muestra la silueta de la pose y las tres miniaturas', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <PruebaDeVida poses={POSES} onFoto={jest.fn(async () => undefined)} onTerminar={jest.fn()} onSalir={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('prueba-de-vida-ovalo')).toBeTruthy();
    for (const pose of POSES) expect(screen.getByTestId(`prueba-de-vida-foto-${pose.kind}`)).toBeTruthy();
  });
});
