/**
 * @file «De dónde salió cada dato»: nombres de persona y un color por origen.
 * @business Quien mira «Mis datos» no tiene por qué leer `ofac_screening_result`, y tiene que ver de reojo qué puso él y qué falta.
 */
import { render, screen } from '@testing-library/react-native';
import { agruparPorOrigen, etiquetaDeVariable, ORIGENES } from '../src/features/variables-del-motor';
import { OrigenDeDatosCard } from '../src/ui/origen-de-datos-card';

const INPUTS = {
  declared_monthly_income: 'expediente',
  affordability_ratio: 'derivado',
  ofac_screening_result: 'ausente',
  known_fraud_phone_flag: 'derivado',
};

it('traduce los códigos del Motor y no deja nunca un código crudo', () => {
  expect(etiquetaDeVariable('ofac_screening_result')).toBe('Lista OFAC');
  expect(etiquetaDeVariable('monthlyIncome')).toBe('Ingreso mensual');
  // Un código sin traducción cae a palabras sueltas, sin guiones bajos.
  expect(etiquetaDeVariable('some_new_variable')).toBe('Some new variable');
});

it('agrupa por origen —lo tuyo, lo calculado, lo que falta— y cada origen tiene su color', () => {
  const grupos = agruparPorOrigen(INPUTS);
  expect(grupos.map((g) => g.origen)).toEqual(['expediente', 'derivado', 'ausente']);
  expect(grupos[1]!.filas.map((f) => f.codigo).sort()).toEqual(['affordability_ratio', 'known_fraud_phone_flag']);
  const tonos = Object.values(ORIGENES).map((o) => o.tono);
  expect(new Set(tonos).size).toBe(3);
});

it('la tarjeta enseña el resumen con cifras y una fila por dato con su origen', async () => {
  await render(<OrigenDeDatosCard inputs={INPUTS} />);
  expect(screen.getByText('Declarados 1')).toBeTruthy();
  expect(screen.getByText('Calculados 2')).toBeTruthy();
  expect(screen.getByText('Faltan 1')).toBeTruthy();
  expect(screen.getByText('Lista OFAC')).toBeTruthy();
  expect(screen.getAllByText('Lo calculó Atlas')).toHaveLength(2);
  expect(screen.queryByText(/ofac_screening/)).toBeNull();
});

it('sin datos no pinta la tarjeta', async () => {
  await render(<OrigenDeDatosCard inputs={{}} />);
  expect(screen.queryByText(/De dónde salió/)).toBeNull();
});
