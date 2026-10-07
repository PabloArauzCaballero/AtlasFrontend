import { explicarFallaDeDecision } from '../src/features/falla-de-decision';

describe('explicación de por qué no se evaluó la compra', () => {
  it('sin producto para el monto NO manda a reintentar: el servicio sí respondió', () => {
    const e = explicarFallaDeDecision('NO_PRODUCT_FOR_AMOUNT');
    expect(e.titulo).toMatch(/no tiene un crédito disponible/);
    expect(e.detalle).toMatch(/Reintentar no lo cambia/);
    expect(e.detalle).not.toMatch(/no respondió/);
    expect(e.detalle).toMatch(/nadie la rechazó/);
  });

  it('con la red caída sí es «Sin conexión»', () => {
    expect(explicarFallaDeDecision('CREDIT_PRODUCTS_UNAVAILABLE').titulo).toBe('Sin conexión');
  });

  it('cualquier otro código conserva el aviso de siempre con su referencia', () => {
    const e = explicarFallaDeDecision('X_RARO');
    expect(e.titulo).toBe('No pudimos evaluar tu compra');
    expect(e.detalle).toContain('(X_RARO)');
  });
});
