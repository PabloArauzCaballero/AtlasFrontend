import { render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { parsearEnLinea, parsearMarkdown, tieneMarkdown } from '../src/features/markdown';
import { Markdown } from '../src/ui/markdown';

/**
 * Los artículos de ayuda se editan con markdown y la app los pintaba como texto plano: el cliente leía «## En efectivo» y
 * «**Importante:**» literales. El texto de la prueba es el de la captura de la app.
 */
const ARTICULO = `## Por transferencia

Usá los datos que aparecen en la misma pantalla. **Importante:** la transferencia tiene que salir a tu nombre; si la hace otra persona, el pago no se acredita solo y hay que avisarnos.

## En efectivo

En cualquier comercio de la red con el código de tu cuota.`;

const LISTA = `1. Esperá dos minutos: el mensaje puede demorar.
2. Comprobá que tengas señal y que el teléfono no esté en modo avión.
3. Revisá que el número que ves en pantalla sea el tuyo, dígito por dígito.
4. Si todo está bien, pedí un código nuevo — el anterior deja de servir.`;

describe('parsearEnLinea', () => {
  it('reconoce negrita, cursiva, código y enlace, y deja el resto como texto', () => {
    expect(parsearEnLinea('Es **muy** *claro*, usa `0000` y [mira](https://atlas.bo/ayuda).')).toEqual([
      { tipo: 'texto', texto: 'Es ' },
      { tipo: 'negrita', texto: 'muy' },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'cursiva', texto: 'claro' },
      { tipo: 'texto', texto: ', usa ' },
      { tipo: 'codigo', texto: '0000' },
      { tipo: 'texto', texto: ' y ' },
      { tipo: 'enlace', texto: 'mira', url: 'https://atlas.bo/ayuda' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('la negrita no se confunde con dos cursivas', () => {
    expect(parsearEnLinea('**Importante:** sí')).toEqual([
      { tipo: 'negrita', texto: 'Importante:' },
      { tipo: 'texto', texto: ' sí' },
    ]);
  });

  it('un texto sin formato sale entero, sin perder nada', () => {
    expect(parsearEnLinea('Hola, ¿cómo estás?')).toEqual([{ tipo: 'texto', texto: 'Hola, ¿cómo estás?' }]);
  });

  it('sólo se vuelven enlace los http(s): un esquema peligroso queda como texto', () => {
    const trozos = parsearEnLinea('[clic](javascript:alert(1)) y [ok](http://a.bo)');
    expect(trozos.filter((t) => t.tipo === 'enlace')).toEqual([{ tipo: 'enlace', texto: 'ok', url: 'http://a.bo' }]);
    expect(JSON.stringify(trozos)).toContain('javascript:alert(1)');
  });

  it('un asterisco suelto o una multiplicación no se vuelven cursiva', () => {
    expect(parsearEnLinea('2 * 3 = 6')).toEqual([{ tipo: 'texto', texto: '2 * 3 = 6' }]);
  });
});

describe('parsearMarkdown', () => {
  it('el artículo de la captura: dos títulos y sus párrafos, con la negrita dentro', () => {
    const bloques = parsearMarkdown(ARTICULO);
    expect(bloques.map((b) => b.tipo)).toEqual(['titulo', 'parrafo', 'titulo', 'parrafo']);
    expect(bloques[0]).toMatchObject({ tipo: 'titulo', nivel: 2, inline: [{ tipo: 'texto', texto: 'Por transferencia' }] });
    const parrafo = bloques[1];
    expect(parrafo?.tipo === 'parrafo' && parrafo.inline.some((i) => i.tipo === 'negrita' && i.texto === 'Importante:')).toBe(true);
  });

  it('una lista numerada es UNA lista de cuatro ítems, no cuatro párrafos', () => {
    const bloques = parsearMarkdown(LISTA);
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({ tipo: 'lista', ordenada: true });
    expect(bloques[0]?.tipo === 'lista' && bloques[0].items).toHaveLength(4);
  });

  it('viñetas con -, * y • forman lista; cambiar a numerada abre otra', () => {
    const bloques = parsearMarkdown('- uno\n* dos\n• tres\n\n1. a\n2. b');
    expect(bloques.map((b) => b.tipo === 'lista' && b.ordenada)).toEqual([false, true]);
    expect(bloques[0]?.tipo === 'lista' && bloques[0].items).toHaveLength(3);
  });

  it('niveles de título 1, 2 y 3', () => {
    expect(parsearMarkdown('# A\n\n## B\n\n### C').map((b) => b.tipo === 'titulo' && b.nivel)).toEqual([1, 2, 3]);
  });

  it('cita y regla', () => {
    expect(parsearMarkdown('> consejo\n\n---').map((b) => b.tipo)).toEqual(['cita', 'regla']);
  });

  it('un salto de línea simple dentro de un párrafo se conserva', () => {
    const [p] = parsearMarkdown('primera línea\nsegunda línea');
    expect(p?.tipo === 'parrafo' && p.inline[0]).toEqual({ tipo: 'texto', texto: 'primera línea\nsegunda línea' });
  });

  it('acepta saltos de línea de Windows', () => {
    expect(parsearMarkdown('## A\r\n\r\ntexto').map((b) => b.tipo)).toEqual(['titulo', 'parrafo']);
  });

  it('vacío, nulo o sólo espacios no producen bloques', () => {
    for (const vacio of [null, undefined, '', '  \n ']) expect(parsearMarkdown(vacio)).toEqual([]);
  });

  it('tieneMarkdown distingue una frase suelta de un texto con formato', () => {
    expect(tieneMarkdown('Una frase sin nada.')).toBe(false);
    expect(tieneMarkdown('Algo **importante**')).toBe(true);
    expect(tieneMarkdown('## Título')).toBe(true);
    expect(tieneMarkdown(null)).toBe(false);
  });
});

const METRICAS = initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const montar = (texto: string) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Markdown testID="md">{texto}</Markdown>
    </SafeAreaProvider>,
  );

describe('<Markdown>', () => {
  it('NUNCA enseña los símbolos de markdown: ni «##» ni «**»', async () => {
    await montar(ARTICULO + '\n\n' + LISTA);
    expect(screen.queryByText(/##/)).toBeNull();
    expect(screen.queryByText(/\*\*/)).toBeNull();
    expect(screen.getByText('Por transferencia')).toBeTruthy();
    expect(screen.getByText('En efectivo')).toBeTruthy();
  });

  it('los títulos se anuncian como encabezados para el lector de pantalla', async () => {
    await montar(ARTICULO);
    expect(screen.getAllByRole('header').length).toBe(2);
  });

  it('la lista numerada enseña 1. 2. 3. 4. y cada texto', async () => {
    await montar(LISTA);
    for (const n of ['1.', '2.', '3.', '4.']) expect(screen.getByText(n)).toBeTruthy();
    expect(screen.getByText(/Esperá dos minutos/)).toBeTruthy();
    expect(screen.getByText(/el anterior deja de servir/)).toBeTruthy();
  });

  it('las viñetas enseñan un punto por ítem', async () => {
    await montar('- uno\n- dos');
    expect(screen.getAllByText('•')).toHaveLength(2);
  });

  it('un enlace https abre al tocarlo y se anuncia como enlace', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await montar('Mira [la guía](https://atlas.bo/guia).');
    const enlace = screen.getByRole('link');
    expect(enlace).toBeTruthy();
    enlace.props.onPress();
    expect(abrir).toHaveBeenCalledWith('https://atlas.bo/guia');
    abrir.mockRestore();
  });

  it('un texto vacío no pinta nada', async () => {
    await montar('   ');
    expect(screen.queryByTestId('md')).toBeNull();
  });

  it('un texto sin markdown se ve igual que antes: el párrafo tal cual', async () => {
    await montar('Esperá dos minutos y revisá la señal.');
    expect(screen.getByText('Esperá dos minutos y revisá la señal.')).toBeTruthy();
  });
});
