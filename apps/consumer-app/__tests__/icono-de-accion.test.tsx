import { render, screen } from '@testing-library/react-native';
import { iconoDeAccion } from '../src/ui/icono-de-accion';
import { Button } from '../src/ui/primitives';
import { ICON_NAMES } from '../src/ui/icons';

describe('el icono de una acción sale de su etiqueta', () => {
  it.each([
    ['Guardar cambios', 'check'],
    ['Continuar', 'adelante'],
    ['Siguiente', 'adelante'],
    ['Volver al inicio', 'atras'],
    ['Cancelar compra', 'cerrar'],
    ['Cerrar sesión', 'salir'],
    ['Cerrar', 'cerrar'],
    ['Borrar', 'papelera'],
    ['Escanear un QR', 'escanear'],
    ['Permitir cámara', 'camara'],
    ['Copiar cuenta', 'copiar'],
    ['Adjuntar comprobante', 'clip'],
    ['Subir mi extracto', 'subir'],
    ['Enviarme el código', 'enviar'],
    ['Actualizar estado', 'refrescar'],
    ['¿Cómo se calcula?', 'ayuda'],
    ['Señalar mi casa en el mapa', 'ubicacion'],
  ])('«%s» lleva «%s»', (etiqueta, icono) => {
    expect(iconoDeAccion(etiqueta)).toBe(icono);
  });

  it.each(['Ya tengo cuenta', 'Hola', ''])('«%s» no lleva icono: inventarlo es peor que no ponerlo', (etiqueta) => {
    expect(iconoDeAccion(etiqueta)).toBeUndefined();
  });

  it('todo icono que nombra una regla existe en el set', () => {
    const etiquetas = ['Guardar', 'Continuar', 'Volver', 'Cancelar', 'Cerrar sesión', 'Borrar', 'Copiar', 'Adjuntar', 'Subir', 'Enviar', 'Descargar', 'Escanear', 'Tomar foto', 'Abrir ajustes', 'Actualizar', 'Editar', 'Pedir ayuda', 'Ver todos', 'Pagar', 'Usar mi ubicación', 'Crear mi cuenta'];
    for (const e of etiquetas) expect(ICON_NAMES).toContain(iconoDeAccion(e));
  });
});

describe('Button', () => {
  it('pone el icono de la etiqueta cuando la pantalla no pasa `icon`', async () => {
    await render(<Button label="Guardar" onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toMatch(/Svg/i);
  });

  it('`icon={null}` lo quita', async () => {
    await render(<Button label="Guardar" icon={null} onPress={() => undefined} />);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/Svg/i);
  });
});
