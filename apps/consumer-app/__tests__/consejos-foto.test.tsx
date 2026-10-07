/**
 * «Consejos para la foto»: se pliega por defecto, se abre y se cierra, y no toca el visor.
 *
 * Y los dibujos: cada uno tiene que ser un SVG bien formado. Un dibujo roto no tira ninguna prueba
 * de tipos —es una cadena— y en pantalla se veria como una ficha vacia.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CONSEJOS } from '../src/features/consejos-foto';
import { ConsejosFoto } from '../src/ui/consejos-foto';
import { svgDe, TODOS_LOS_DIBUJOS } from '../src/ui/consejos-foto-dibujos';

describe('el desplegable de consejos', () => {
  it('llega plegado y el visor siempre esta', async () => {
    await render(
      <ConsejosFoto tipo="carnet">
        <Text>VISOR</Text>
      </ConsejosFoto>,
    );
    expect(screen.getByText('VISOR')).toBeTruthy();
    expect(screen.queryByText('Buena iluminación')).toBeNull();
    expect(screen.getByLabelText(/Consejos para la foto\. Ver los consejos/)).toBeTruthy();
  });

  it('abre con los cuatro consejos del carnet y cada ficha se anuncia como correcta o incorrecta', async () => {
    await render(
      <ConsejosFoto tipo="carnet">
        <Text>VISOR</Text>
      </ConsejosFoto>,
    );
    await fireEvent.press(screen.getByLabelText(/Ver los consejos/));

    for (const consejo of CONSEJOS.carnet.consejos) {
      expect(screen.getByText(consejo.titulo)).toBeTruthy();
      expect(screen.getByLabelText(`Incorrecto: ${consejo.malEtiqueta}`)).toBeTruthy();
    }
    // El visor sigue MONTADO debajo —abrir los consejos no lo desmonta ni lo reencuadra—, pero oculto
    // a los lectores de pantalla (`accessibilityViewIsModal`): por eso la consulta incluye ocultos.
    expect(screen.getByText('VISOR', { includeHiddenElements: true })).toBeTruthy();
  });

  it('se cierra con «Entendido»', async () => {
    await render(
      <ConsejosFoto tipo="carnet">
        <Text>VISOR</Text>
      </ConsejosFoto>,
    );
    await fireEvent.press(screen.getByLabelText(/Ver los consejos/));
    expect(screen.getByText('Buena iluminación')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Entendido, cerrar los consejos'));
    expect(screen.queryByText('Buena iluminación')).toBeNull();
  });

  it('la selfie lleva sus propios consejos, no los del carnet', async () => {
    await render(
      <ConsejosFoto tipo="selfie">
        <Text>VISOR</Text>
      </ConsejosFoto>,
    );
    await fireEvent.press(screen.getByLabelText(/Ver los consejos/));
    expect(screen.getByText('Sin accesorios')).toBeTruthy();
    expect(screen.queryByText('Evita los reflejos')).toBeNull();
  });
});

it('el perfil lleva sus consejos: girar la cabeza, no los de la selfie de frente', async () => {
  await render(
    <ConsejosFoto tipo="perfil">
      <Text>VISOR</Text>
    </ConsejosFoto>,
  );
  await fireEvent.press(screen.getByLabelText(/Ver los consejos/));
  expect(screen.getByText('Gira la cabeza, no el teléfono')).toBeTruthy();
  expect(screen.queryByText('De frente y centrado')).toBeNull();
});

describe('los dibujos', () => {
  it.each(TODOS_LOS_DIBUJOS)('%s es un SVG completo y con las etiquetas cerradas', (dibujo) => {
    const svg = svgDe(dibujo);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 160 100"');
    // Cada <g> y cada <defs> que se abre se cierra.
    for (const etiqueta of ['g', 'defs', 'clipPath', 'radialGradient']) {
      const abre = (svg.match(new RegExp(`<${etiqueta}[ >]`, 'g')) ?? []).length;
      const cierra = (svg.match(new RegExp(`</${etiqueta}>`, 'g')) ?? []).length;
      expect(abre).toBe(cierra);
    }
  });

  it('todo consejo apunta a dibujos que existen', () => {
    for (const tipo of Object.values(CONSEJOS)) {
      for (const consejo of tipo.consejos) {
        expect(TODOS_LOS_DIBUJOS).toContain(consejo.bien);
        expect(TODOS_LOS_DIBUJOS).toContain(consejo.mal);
      }
    }
  });
});
