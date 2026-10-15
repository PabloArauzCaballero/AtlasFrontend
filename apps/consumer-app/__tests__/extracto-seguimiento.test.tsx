/**
 * «Recalcular mi línea» pinta las etapas, el antes → ahora y la cuenta que las une.
 */
import { render, screen } from '@testing-library/react-native';
import type { LineChange } from '../src/api/endpoints/credit-line';
import { etapasDelExtracto, periodoDelExtracto } from '../src/features/extracto-estado';
import { CambioDeLinea, CuentaDeLaLinea, EtapasDelExtracto } from '../src/ui/extracto-seguimiento';

const cambio: LineChange = {
  previousLimit: 900,
  newLimit: 1275,
  currencyCode: 'BOB',
  calculation: {
    monthlyInstallment: 1500,
    termMonths: 3,
    byCapacity: 4500,
    byRelationship: 1500,
    relationshipTier: 'NUEVO',
    byGraduation: 1800,
    productCeiling: 20000,
    recommendedLimit: 1500,
    bindingConstraint: 'RELACION',
    riskBand: 'B',
    approvedLimit: 1275,
  },
};

describe('seguimiento del extracto', () => {
  it('las etapas se leen con su estado', async () => {
    await render(<EtapasDelExtracto etapas={etapasDelExtracto({ status: 'processing' })} />);
    expect(screen.getByText('Recalculamos tu línea')).toBeTruthy();
    expect(screen.getByLabelText(/Recalculamos tu línea\. En curso/)).toBeTruthy();
  });

  it('el cambio enseña la línea de antes y la de ahora', async () => {
    await render(<CambioDeLinea cambio={cambio} />);
    expect(screen.getByText('Bs 900')).toBeTruthy();
    expect(screen.getByText('Bs 1.275')).toBeTruthy();
    expect(screen.getByText('Subió Bs 375.')).toBeTruthy();
  });

  it('la cuenta marca lo que manda y termina en la línea', async () => {
    await render(<CuentaDeLaLinea cambio={cambio} />);
    expect(screen.getByText('Es lo que manda')).toBeTruthy();
    expect(screen.getByText('−Bs 225')).toBeTruthy();
    expect(screen.getByTestId('cuenta-linea')).toBeTruthy();
  });
});

describe('el periodo del extracto', () => {
  it('una fecha sin hora no se corre un día por la zona horaria', () => {
    expect(periodoDelExtracto({ from: '2026-06-01', to: '2026-08-31' })).toBe('01/06/2026 – 31/08/2026');
    expect(periodoDelExtracto(null)).toBeNull();
    expect(periodoDelExtracto({ from: null, to: '2026-08-31' })).toBe('… – 31/08/2026');
  });
});
