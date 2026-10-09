/**
 * APP-11: el rastreo con la app cerrada caduca, se puede apagar y sale como mucho cada 15 minutos.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  espaciarPosiciones,
  PLAZO_SEGUNDO_PLANO_MS,
  segundoPlanoVigente,
  venceEl,
} from '../src/features/rastreo-plazo';
import { CADENCIA_SEGUNDO_PLANO_MS, DISTANCIA_MINIMA_M } from '../src/features/rastreo';

const DIA = 24 * 60 * 60 * 1000;
const CONSENTIDO = '2026-09-01T10:00:00.000Z';
const t0 = Date.parse(CONSENTIDO);

describe('el plazo del rastreo de fondo', () => {
  it('dura 30 dias desde la decision del alta y se apaga solo despues', () => {
    expect(PLAZO_SEGUNDO_PLANO_MS).toBe(30 * DIA);
    expect(segundoPlanoVigente(null, CONSENTIDO, t0 + 29 * DIA)).toBe(true);
    expect(segundoPlanoVigente(null, CONSENTIDO, t0 + 30 * DIA)).toBe(false);
    expect(venceEl(null, CONSENTIDO)).toBe(t0 + 30 * DIA);
  });

  it('sin decision fechada no hay motivo vigente', () => {
    expect(segundoPlanoVigente(null, null, t0)).toBe(false);
    expect(segundoPlanoVigente(null, 'no-es-fecha', t0)).toBe(false);
  });

  it('apagarlo en el perfil lo apaga ya; encenderlo lo renueva 30 dias desde ese momento', () => {
    const apagado = { segundoPlano: false, desde: '2026-09-05T00:00:00.000Z' };
    expect(segundoPlanoVigente(apagado, CONSENTIDO, t0 + DIA)).toBe(false);
    expect(venceEl(apagado, CONSENTIDO)).toBeNull();

    const renovado = { segundoPlano: true, desde: '2026-10-20T00:00:00.000Z' };
    expect(segundoPlanoVigente(renovado, CONSENTIDO, t0 + 60 * DIA)).toBe(true);
    expect(venceEl(renovado, CONSENTIDO)).toBe(Date.parse(renovado.desde) + 30 * DIA);
  });
});

describe('como mucho una posicion cada 15 minutos', () => {
  const en = (min: number) => ({ capturedAt: new Date(t0 + min * 60_000).toISOString() });

  it('descarta lo que llega antes de tiempo, tambien respecto a la ultima enviada', () => {
    const lote = [en(0), en(3), en(14), en(15), en(31), en(40), en(46)];
    expect(espaciarPosiciones(lote, null).map((p) => p.capturedAt)).toEqual([en(0), en(15), en(31), en(46)].map((p) => p.capturedAt));
    expect(espaciarPosiciones([en(5), en(20)], t0)).toEqual([en(20)]);
  });

  it('el texto del permiso dice las cifras que la app aplica', () => {
    expect(CADENCIA_SEGUNDO_PLANO_MS).toBe(15 * 60_000);
    expect(DISTANCIA_MINIMA_M).toBe(100);
    const app = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8'));
    const siempre: string = app.expo.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription;
    expect(siempre).toMatch(/15 minutos/);
    expect(siempre).toMatch(/100 m/);
    expect(siempre).toMatch(/30 días/);
    expect(siempre).toMatch(/perfil/);
    const plugin = app.expo.plugins.find((x: unknown) => Array.isArray(x) && x[0] === 'expo-location')[1];
    expect(plugin.locationAlwaysAndWhenInUsePermission).toMatch(/15 minutos.*30 días/);
  });
});
