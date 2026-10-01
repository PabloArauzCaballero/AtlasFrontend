import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../src/ui/primitives';

/**
 * «Que no parezca bugueado»: un boton cuyo `onPress` es asincrono tiene que ENSEÑAR que trabaja y
 * no aceptar un segundo toque, aunque la pantalla no haya cableado `loading`.
 */
const boton = (nombre: string) => screen.getByRole('button', { name: nombre });

describe('Button con onPress asincrono', () => {
  it('se pone en «cargando» mientras la promesa esta pendiente y vuelve despues', async () => {
    let terminar: () => void = () => undefined;
    const accion = jest.fn(
      () =>
        new Promise<void>((resolver) => {
          terminar = resolver;
        }),
    );
    await render(<Button label="Guardar" onPress={accion} />);

    await fireEvent.press(boton('Guardar'));
    expect(boton('Guardar').props.accessibilityState).toMatchObject({ busy: true, disabled: true });

    // Un segundo toque mientras trabaja no repite la operacion.
    await fireEvent.press(boton('Guardar'));
    expect(accion).toHaveBeenCalledTimes(1);

    await act(async () => {
      terminar();
    });
    expect(boton('Guardar').props.accessibilityState).toMatchObject({ busy: false, disabled: false });
  });

  it('un onPress sincrono no cambia nada', async () => {
    await render(<Button label="Seguir" onPress={jest.fn()} />);
    await fireEvent.press(boton('Seguir'));
    expect(boton('Seguir').props.accessibilityState).toMatchObject({ busy: false });
  });
});
