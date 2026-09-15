/**
 * Los primeros tests que MONTAN un componente.
 *
 * Hasta hoy `__tests__/` solo tenia dominio puro (`.ts`): dieciseis archivos que comprueban reglas
 * de dinero, de reintentos y de catalogos, y ni uno que dibujara nada. Se podia vivir con eso
 * mientras la interfaz era «lo que se ve»; la ayuda de un campo no lo es: es una hoja que se abre
 * al tocar un boton, y si deja de abrirse no hay tipo, ni lint, ni guardian que se entere. El
 * guardian `check-field-help` comprueba que el TEXTO existe; esto comprueba que se puede LEER.
 *
 * Se prueban las tres cosas que pueden romperse sin avisar:
 *   1. el ⓘ existe con su nombre accesible y abre la hoja con la explicacion;
 *   2. el nombre accesible del CAMPO no cambio —de ahi cuelgan los recorridos de Maestro—;
 *   3. cada opcion de un `SelectField` enseña y anuncia su `detalle`.
 */
/*
  `render`, `rerender` y `fireEvent` de esta version DEVUELVEN PROMESA: sin `await` el arbol no se
  ha montado todavia cuando se consulta, y `screen` responde «render function has not been called»
  —que suena a que falta la llamada y en realidad es que falta esperarla—.
*/
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Field } from '../src/ui/fields';
import { SelectField } from '../src/ui/form-controls';
import { FieldFoot, FieldLabel } from '../src/ui/help-sheet';

describe('el boton de ayuda', () => {
  it('se anuncia con el nombre del campo y abre la hoja con la explicacion', async () => {
    await render(<FieldLabel label="Ingreso mensual" ayuda="Lo que te queda cada mes después de descuentos. Ej.: 4500." />);

    // Cerrada, la explicacion no esta en pantalla: una hoja que se pinta siempre no es una hoja.
    expect(screen.queryByText(/después de descuentos/)).toBeNull();

    const boton = screen.getByLabelText('Ayuda: Ingreso mensual');
    await fireEvent.press(boton);

    expect(screen.getByText(/Lo que te queda cada mes después de descuentos\. Ej\.: 4500\./)).toBeTruthy();
  });

  it('se cierra con «Listo»', async () => {
    await render(<FieldLabel label="Gastos mensuales" ayuda="Alquiler, servicios y deudas que pagas todos los meses." />);

    await fireEvent.press(screen.getByLabelText('Ayuda: Gastos mensuales'));
    expect(screen.getByText(/Alquiler, servicios y deudas/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Listo'));
    expect(screen.queryByText(/Alquiler, servicios y deudas/)).toBeNull();
  });

  it('no aparece cuando el campo no trae ayuda', async () => {
    await render(<FieldLabel label="Zona o barrio" />);
    expect(screen.queryByLabelText('Ayuda: Zona o barrio')).toBeNull();
  });

  /*
    El nombre accesible del CAMPO es por donde lo encuentran Maestro y el lector de pantalla
    (`e2e/02-alta.yaml` toca `below: { text: 'Apellido *' }`). Si el `aria-label` del ⓘ se colara en
    el nombre del campo, los recorridos dejarian de encontrarlo sin que fallara ningun tipo.
  */
  it('no cambia el nombre accesible del campo al que acompaña', async () => {
    await render(<Field label="Apellido" value="" onChangeText={() => {}} ayuda="Tus apellidos tal como figuran en tu carnet de identidad." />);

    expect(screen.getByLabelText('Apellido')).toBeTruthy();
    expect(screen.getByLabelText('Ayuda: Apellido')).toBeTruthy();
  });
});

describe('el pie de un campo', () => {
  /*
    Antes era `error ? … : hint ? … : null` en los tres pies duplicados de la app: en cuanto un campo
    fallaba desaparecia la unica linea que decia como rellenarlo, justo cuando hace falta.
  */
  it('enseña el fallo SIN tapar la pista', async () => {
    await render(<FieldFoot error="Revisa el número de tu carnet." hint="El que figura en tu carnet, sin guiones." />);

    expect(screen.getByText('Revisa el número de tu carnet.')).toBeTruthy();
    expect(screen.getByText('El que figura en tu carnet, sin guiones.')).toBeTruthy();
  });
});

describe('las opciones de un select', () => {
  const OPCIONES = [
    { valor: 'salary', etiqueta: 'Salario', detalle: 'Un sueldo fijo de un empleador.' },
    { valor: 'remittances', etiqueta: 'Remesas del exterior', detalle: 'Dinero que te envía alguien desde otro país.' },
  ];

  it('pinta el detalle de cada opcion en la hoja', async () => {
    await render(
      <SelectField
        label="Origen de tus ingresos"
        value={null}
        opciones={OPCIONES}
        onChange={() => {}}
        ayuda="De dónde sale el dinero con el que vas a pagar tus cuotas."
      />,
    );

    await fireEvent.press(screen.getByLabelText('Origen de tus ingresos. Tocar para elegir'));

    expect(screen.getByText('Salario')).toBeTruthy();
    expect(screen.getByText('Un sueldo fijo de un empleador.')).toBeTruthy();
    expect(screen.getByText('Dinero que te envía alguien desde otro país.')).toBeTruthy();
  });

  /*
    `PressSurface` lleva `accessibilityLabel`, y eso ESCONDE el texto de sus hijos: sin el detalle
    dentro de la etiqueta, quien usa VoiceOver oye «Salario» y nunca lo que lo distingue de la
    opcion de al lado.
  */
  it('anuncia el detalle junto a la etiqueta de la fila', async () => {
    await render(<SelectField label="Origen de tus ingresos" value={null} opciones={OPCIONES} onChange={() => {}} />);

    await fireEvent.press(screen.getByLabelText('Origen de tus ingresos. Tocar para elegir'));

    expect(screen.getByLabelText('Salario. Un sueldo fijo de un empleador.')).toBeTruthy();
  });

  it('elegir una opcion la devuelve y deja su detalle al pie', async () => {
    const elegido: string[] = [];
    const { rerender } = await render(
      <SelectField label="Origen de tus ingresos" value={null} opciones={OPCIONES} onChange={(v) => elegido.push(v)} />,
    );

    await fireEvent.press(screen.getByLabelText('Origen de tus ingresos. Tocar para elegir'));
    await fireEvent.press(screen.getByLabelText('Salario. Un sueldo fijo de un empleador.'));

    expect(elegido).toEqual(['salary']);

    await rerender(<SelectField label="Origen de tus ingresos" value="salary" opciones={OPCIONES} onChange={() => {}} />);
    expect(screen.getByText('Un sueldo fijo de un empleador.')).toBeTruthy();
  });
});
