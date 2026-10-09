import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { entradaDelPin, PinField } from '../src/ui/pin-field';

/**
 * APP-22: el PIN va oculto en TODAS las plataformas, no sólo en iOS, y sin autocompletado salvo que
 * la pantalla lo pida (el login, para el gestor de contraseñas).
 */
describe('el PIN no se ve ni se aprende', () => {
  it('secreto y sin el ojo: oculto, sin autocompletado', () => {
    expect(entradaDelPin({ secret: true, visible: false })).toEqual({ secureTextEntry: true, autoComplete: 'off', importantForAutofill: 'no' });
  });

  it('con el ojo pulsado se ve', () => {
    expect(entradaDelPin({ secret: true, visible: true }).secureTextEntry).toBe(false);
  });

  it('el login conserva current-password para el gestor de contraseñas', () => {
    expect(entradaDelPin({ secret: true, visible: false, autoComplete: 'current-password' })).toEqual({
      secureTextEntry: true,
      autoComplete: 'current-password',
      importantForAutofill: 'auto',
    });
  });

  it('un código de un solo uso no es secreto y conserva el relleno desde el SMS', () => {
    expect(entradaDelPin({ secret: false, visible: true, autoComplete: 'one-time-code' })).toEqual({
      secureTextEntry: false,
      autoComplete: 'one-time-code',
      importantForAutofill: 'auto',
    });
  });

  it.each(['android', 'web', 'ios'] as const)('en %s el campo real lleva secureTextEntry', async (os) => {
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    try {
      await render(<PinField label="Tu PIN" value="12" onChangeText={() => undefined} />);
      expect(screen.getByLabelText('Tu PIN').props.secureTextEntry).toBe(true);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});
