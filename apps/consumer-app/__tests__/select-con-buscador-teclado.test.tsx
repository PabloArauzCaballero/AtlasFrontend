/* eslint-disable @typescript-eslint/no-require-imports -- las fabricas de jest.mock solo admiten require. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { SelectField } from '../src/ui/form-controls';

/** Las propiedades con que la hoja pinta su KeyboardAvoidingView, en el orden en que se pintó. */
const propiedades: { enabled?: boolean }[] = [];
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: (props: { enabled?: boolean; children?: React.ReactNode }) => {
      propiedades.push({ enabled: props.enabled });
      return <View>{props.children}</View>;
    },
  };
});

const metricas = initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const opciones = (n: number) => Array.from({ length: n }, (_, i) => ({ valor: `v${i}`, etiqueta: `Ciudad ${i}` }));

/**
 * Al buscar dentro de un desplegable (Ciudad), el teclado de iOS subía DELANTE de la hoja y tapaba la lista entera: se veía el
 * teclado y ninguna opción (Pablo, 2026-10-07). Con buscador la hoja tiene que evitar el teclado.
 */
async function abrir(n: number, buscable?: boolean) {
  propiedades.length = 0;
  await render(
    <SafeAreaProvider initialMetrics={metricas}>
      <SelectField label="Ciudad" ayuda="Elige tu ciudad." value="" onChange={jest.fn()} opciones={opciones(n)} {...(buscable === undefined ? {} : { buscable })} />
    </SafeAreaProvider>,
  );
  await fireEvent.press(screen.getByLabelText('Ciudad. Tocar para elegir'));
}

describe('desplegable con buscador y teclado', () => {
  it('con muchas opciones hay buscador y la hoja evita el teclado', async () => {
    await abrir(12);
    expect(screen.getByLabelText('Buscar en Ciudad')).toBeTruthy();
    expect(propiedades.at(-1)?.enabled).toBe(true);
  });

  it('con pocas opciones no hay buscador y la hoja no cambia cómo reparte el alto', async () => {
    await abrir(4);
    expect(screen.queryByLabelText('Buscar en Ciudad')).toBeNull();
    expect(propiedades.at(-1)?.enabled).toBe(false);
  });
});
