import type { LineChange } from '../src/api/endpoints/credit-line';
import { cuentaDeLaLinea, estadoDelExtracto, etapasDelExtracto, miles, resumenDelCambio, subtituloDeRecalcular } from '../src/features/extracto-estado';

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

describe('extracto aplicado sin línea: la confirma una persona', () => {
  it('no se lee como «tu línea se actualizó»', () => {
    const estado = estadoDelExtracto({ status: 'applied', rejectionReason: null, lineAwaitingApproval: true });
    expect(estado).toEqual({ tipo: 'retenido' });
    expect(subtituloDeRecalcular(estado)).toMatch(/una persona confirma/);
  });
});

describe('las etapas del recálculo', () => {
  const estados = (r: Parameters<typeof etapasDelExtracto>[0]) => etapasDelExtracto(r).map((e) => e.estado);

  it('recibido: se está leyendo', () => {
    expect(estados({ status: 'received' })).toEqual(['hecha', 'actual', 'pendiente']);
  });
  it('en curso sin revisión humana: ya se leyó, falta la línea', () => {
    expect(estados({ status: 'processing' })).toEqual(['hecha', 'hecha', 'actual']);
  });
  it('en revisión humana: la lectura no terminó', () => {
    expect(estados({ status: 'processing', inHumanReview: true })).toEqual(['hecha', 'actual', 'pendiente']);
  });
  it('aplicado: todo hecho; retenido: la línea sigue en curso', () => {
    expect(estados({ status: 'applied' })).toEqual(['hecha', 'hecha', 'hecha']);
    expect(estados({ status: 'applied', lineAwaitingApproval: true })).toEqual(['hecha', 'hecha', 'actual']);
  });
  it('rechazado: falla la lectura', () => {
    expect(estados({ status: 'rejected' })).toEqual(['hecha', 'fallida', 'pendiente']);
  });
});

describe('la cuenta de la línea', () => {
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

  it('va del extracto a la línea, marcando el tope que manda', () => {
    const filas = cuentaDeLaLinea(cambio, 'Atlas');
    expect(filas.map((f) => f.clave)).toEqual(['capacidad', 'relacion', 'graduacion', 'producto', 'propuesta', 'riesgo', 'linea']);
    expect(filas.find((f) => f.manda)?.clave).toBe('relacion');
    expect(filas[0]!.etiqueta).toBe('Lo que tu extracto soporta (cuota de Bs 1.500 × 3 meses)');
    expect(filas[1]!.etiqueta).toBe('Tope por tu historia con Atlas (tramo Nuevo)');
    expect(filas.find((f) => f.clave === 'riesgo')).toMatchObject({ valor: -225, ajuste: true });
    expect(filas.at(-1)).toMatchObject({ valor: 1275, total: true });
  });

  it('sin ajuste por riesgo no pinta una fila de cero', () => {
    const filas = cuentaDeLaLinea({ ...cambio, calculation: { ...cambio.calculation!, approvedLimit: 1500 } }, 'Atlas');
    expect(filas.some((f) => f.clave === 'riesgo')).toBe(false);
  });

  it('sin desglose no inventa la cuenta', () => {
    expect(cuentaDeLaLinea({ ...cambio, calculation: null }, 'Atlas')).toEqual([]);
  });

  it('resume cuánto cambió', () => {
    expect(resumenDelCambio(cambio)).toEqual({ texto: 'Subió Bs 375.', tono: 'success' });
    expect(resumenDelCambio({ ...cambio, newLimit: 600 })).toEqual({ texto: 'Bajó Bs 300.', tono: 'danger' });
    expect(resumenDelCambio({ ...cambio, newLimit: 900 }).tono).toBe('secondary');
    expect(resumenDelCambio({ ...cambio, previousLimit: null }).texto).toMatch(/primera línea/);
  });

  it('miles con punto y sin decimales', () => {
    expect(miles(20000)).toBe('20.000');
    expect(miles(1275.4)).toBe('1.275');
    expect(miles(-225)).toBe('−225');
  });
});
