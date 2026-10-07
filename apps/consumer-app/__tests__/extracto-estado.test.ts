import { estadoDelExtracto, subtituloDeRecalcular } from '../src/features/extracto-estado';

describe('estado del extracto en Perfil', () => {
  it('sin nada subido se pide el extracto', () => {
    expect(estadoDelExtracto(null)).toEqual({ tipo: 'sin_subir' });
    expect(subtituloDeRecalcular({ tipo: 'sin_subir' })).toMatch(/^Sube tu extracto/);
  });

  it('con un extracto recibido o en proceso NO se vuelve a pedir: está pendiente de evaluar', () => {
    for (const status of ['received', 'processing'] as const) {
      const estado = estadoDelExtracto({ status, rejectionReason: null });
      expect(estado.tipo).toBe('pendiente');
      expect(subtituloDeRecalcular(estado)).toMatch(/pendiente de evaluar/);
      expect(subtituloDeRecalcular(estado)).not.toMatch(/^Sube tu extracto/);
    }
  });

  it('un extracto aplicado no es «pendiente»', () => {
    expect(estadoDelExtracto({ status: 'applied', rejectionReason: null })).toEqual({ tipo: 'aplicado' });
  });

  it('un extracto rechazado dice por qué y sí pide otro', () => {
    const estado = estadoDelExtracto({ status: 'rejected', rejectionReason: 'Faltan meses' });
    expect(estado).toEqual({ tipo: 'rechazado', motivo: 'Faltan meses' });
    expect(subtituloDeRecalcular(estado)).toMatch(/sube otro/);
  });
});
