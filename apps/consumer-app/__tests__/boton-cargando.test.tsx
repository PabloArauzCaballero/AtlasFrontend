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

  it('cargando conserva el rótulo: el spinner sustituye al icono, no a todo el contenido', async () => {
    await render(<Button label="Enviar" icon="enviar" loading onPress={jest.fn()} />);
    expect(screen.getByText('Enviar')).toBeTruthy();
    expect(boton('Enviar').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('un icono por nombre se pinta junto al texto', async () => {
    await render(<Button label="Foto" icon="camara" variant="secondary" onPress={jest.fn()} />);
    expect(screen.getByText('Foto')).toBeTruthy();
    // El icono es decorativo (sin `label`): queda fuera del árbol de accesibilidad, el botón ya se llama «Foto».
    expect(boton('Foto')).toBeTruthy();
  });
});
