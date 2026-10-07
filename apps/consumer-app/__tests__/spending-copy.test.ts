/**
 * El rubro que el cliente LEE.
 *
 * La clave viaja como la guarda el expediente del partner —hoy en mayusculas y sin tilde— y la
 * pantalla de pagos la pinta al lado del importe que se debe. Cuando la busqueda falla no salta
 * ningun error: sale la clave cruda, que es lo que se vio en la app («RETAIL · 1 credito»).
 */
import { categoryLook, formatAmount } from '../src/features/spending-copy';

describe('categoryLook', () => {
  it('traduce la clave tal como la guarda el expediente, en mayusculas', () => {
    expect(categoryLook('EDUCACION')).toEqual({ label: 'Educación', icon: 'educacion' });
    expect(categoryLook('RETAIL').label).toBe('Tienda');
  });

  it('acepta la misma clave escrita de cualquier forma', () => {
    for (const clave of ['educacion', 'Educacion', 'EDUCACIÓN', ' educación ']) {
      expect(categoryLook(clave).label).toBe('Educación');
    }
  });

  it('no deja escapar una clave cruda cuando el rubro es desconocido', () => {
    const look = categoryLook('MASCOTAS_Y_JARDIN');
    expect(look.label).toBe('Mascotas y jardin');
    expect(look.icon).toBe('comercio');
  });
});

describe('formatAmount', () => {
  // Ver `domain/money.formatMoney`: media cifra sin moneda al final de un renglon no es un importe.
  it('une el simbolo a la cifra con un espacio indivisible', () => {
    expect(formatAmount(1000)).toBe('Bs 1.000,00');
  });
});
