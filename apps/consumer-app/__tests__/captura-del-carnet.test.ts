/**
 * Lo que la app comprueba de un recorte del escaner antes de subirlo, a que lamina va despues y
 * cuanto espera una subida. Funciones puras: aqui no hay camara ni red.
 */
import {
  comprobarCaptura,
  LADO_LARGO_MINIMO,
  MENSAJE_PEQUENA,
  MENSAJE_PROPORCION,
  PROPORCION_CARNET,
  siguientePendiente,
} from '../src/features/captura-del-carnet';
import { plazoDeSubidaMs, type IdentityEvidenceKind } from '../src/features/evidence-upload';
import { PRESUPUESTO_REINTENTOS_MS } from '../src/api/reintentos';
import { ESPERA_TRAS_RECHAZO_MS, rechazoVigente } from '../src/features/qr-rechazado';

describe('comprobarCaptura', () => {
  it('la proporcion es la del carnet ID-1 (85,6 x 54 mm)', () => {
    expect(PROPORCION_CARNET).toBeCloseTo(1.585, 3);
  });

  it('acepta el recorte del escaner, en horizontal y en vertical', () => {
    expect(comprobarCaptura({ ancho: 2400, alto: 1513 })).toEqual({ ok: true });
    expect(comprobarCaptura({ ancho: 1513, alto: 2400 })).toEqual({ ok: true });
  });

  it('el lado largo tiene que llegar a 1400 px, en cualquiera de las dos orientaciones', () => {
    expect(comprobarCaptura({ ancho: LADO_LARGO_MINIMO, alto: 883 })).toEqual({ ok: true });
    expect(comprobarCaptura({ ancho: LADO_LARGO_MINIMO - 1, alto: 883 })).toEqual({ ok: false, motivo: 'pequena', mensaje: MENSAJE_PEQUENA });
    expect(comprobarCaptura({ ancho: 883, alto: LADO_LARGO_MINIMO - 1 })).toMatchObject({ ok: false, motivo: 'pequena' });
  });

  it('la tolerancia de la proporcion es del 12 %, por los dos lados', () => {
    // 1,586 * 1,12 = 1,776 y 1,586 * 0,88 = 1,395.
    expect(comprobarCaptura({ ancho: 2000, alto: Math.ceil(2000 / 1.77) })).toEqual({ ok: true });
    expect(comprobarCaptura({ ancho: 2000, alto: Math.floor(2000 / 1.79) })).toEqual({ ok: false, motivo: 'proporcion', mensaje: MENSAJE_PROPORCION });
    expect(comprobarCaptura({ ancho: 2000, alto: Math.floor(2000 / 1.40) })).toEqual({ ok: true });
    expect(comprobarCaptura({ ancho: 2000, alto: Math.ceil(2000 / 1.38) })).toMatchObject({ ok: false, motivo: 'proporcion' });
  });

  it('una foto entera del visor (4:3) no pasa: por eso solo se comprueba lo que devuelve el escaner', () => {
    expect(comprobarCaptura({ ancho: 4032, alto: 3024 })).toMatchObject({ ok: false, motivo: 'proporcion' });
  });

  it('dimensiones imposibles cuentan como pequeña, nunca como validas', () => {
    expect(comprobarCaptura({ ancho: 0, alto: 0 })).toMatchObject({ ok: false, motivo: 'pequena' });
    expect(comprobarCaptura({ ancho: 2400, alto: 0 })).toMatchObject({ ok: false, motivo: 'pequena' });
    expect(comprobarCaptura({ ancho: Number.NaN, alto: 1500 })).toMatchObject({ ok: false, motivo: 'pequena' });
  });

  it('los mensajes son los del plan, sin jerga', () => {
    expect(MENSAJE_PEQUENA).toBe('La imagen salió muy pequeña. Acerca un poco el teléfono.');
    expect(MENSAJE_PROPORCION).toBe('No parece el carnet entero. Repite con los cuatro bordes a la vista.');
  });
});

describe('siguientePendiente', () => {
  const orden: IdentityEvidenceKind[] = ['identity_front', 'identity_back', 'selfie'];

  it('tras el anverso, el reverso', () => {
    expect(siguientePendiente(orden, { identity_front: 1 }, 'identity_front')).toBe('identity_back');
  });

  it('salta las que ya estan hechas', () => {
    expect(siguientePendiente(orden, { identity_front: 1, identity_back: 1 }, 'identity_front')).toBe('selfie');
  });

  it('si no queda ninguna detras, vuelve al principio', () => {
    expect(siguientePendiente(orden, { identity_back: 1, selfie: 1 }, 'selfie')).toBe('identity_front');
  });

  it('con todas hechas se queda en la que se acaba de guardar', () => {
    expect(siguientePendiente(orden, { identity_front: 1, identity_back: 1, selfie: 1 }, 'identity_back')).toBe('identity_back');
  });
});

describe('plazoDeSubidaMs', () => {
  it('45 s fijos (el presupuesto de reintentos de un despliegue) mas los bytes a 100 KB/s', () => {
    expect(plazoDeSubidaMs(0)).toBe(PRESUPUESTO_REINTENTOS_MS);
    expect(plazoDeSubidaMs(1024 * 1024)).toBe(PRESUPUESTO_REINTENTOS_MS + 11_000);
  });

  it('el maximo del backend (15 MB) tiene mas de tres minutos', () => {
    const quince = plazoDeSubidaMs(15 * 1024 * 1024);
    expect(quince).toBeGreaterThan(180_000);
    expect(quince).toBeLessThan(200_000);
  });
});

describe('rechazoVigente (QR ya rechazado)', () => {
  const rechazo = { token: 'SN-0000000000000-NOEXIS', en: 1_000 };

  it('el mismo token no se reenvia antes de diez segundos', () => {
    expect(rechazoVigente(rechazo, 'SN-0000000000000-NOEXIS', 1_000 + 1_500)).toBe(true);
    expect(rechazoVigente(rechazo, '  SN-0000000000000-NOEXIS ', 1_000 + ESPERA_TRAS_RECHAZO_MS - 1)).toBe(true);
  });

  it('a los diez segundos se vuelve a probar', () => {
    expect(rechazoVigente(rechazo, 'SN-0000000000000-NOEXIS', 1_000 + ESPERA_TRAS_RECHAZO_MS)).toBe(false);
  });

  it('otro token pasa en el acto, y sin rechazo previo pasa todo', () => {
    expect(rechazoVigente(rechazo, 'SN-1789065299579-RMWUCC', 1_001)).toBe(false);
    expect(rechazoVigente(null, 'SN-0000000000000-NOEXIS', 1_001)).toBe(false);
  });
});
