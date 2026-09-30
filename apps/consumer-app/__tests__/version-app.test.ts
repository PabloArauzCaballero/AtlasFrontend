/**
 * El diagnostico que el tester lee en Perfil: que distinga binario, update y desarrollo, y que
 * jamas incluya nada de la cuenta.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { armarVersion, resumenDeVersion, textoParaSoporte } from '../src/device/version-app';

const base = { version: '1.0.0', actualizacionesActivas: true, esLanzamientoEmbebido: true };

describe('armarVersion', () => {
  it('un lanzamiento embebido es el binario y no arrastra el id del bundle de fabrica', () => {
    const v = armarVersion({ ...base, buildIos: '7', runtimeVersion: '1.0.0', canal: 'preview', updateId: 'de-fabrica' });
    expect(v).toMatchObject({ origen: 'binario', build: '7', updateId: null, updateCreadoEn: null, canal: 'preview' });
  });

  it('un update publicado lleva su id y su fecha', () => {
    const v = armarVersion({
      ...base,
      esLanzamientoEmbebido: false,
      runtimeVersion: '1.0.0',
      canal: 'preview',
      updateId: '0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      creadoEn: new Date('2026-09-30T12:00:00Z'),
    });
    expect(v).toMatchObject({ origen: 'update', updateId: '0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', updateCreadoEn: '2026-09-30T12:00:00.000Z' });
  });

  it('sin expo-updates activo (Expo Go, desarrollo, web) es «desarrollo»', () => {
    expect(armarVersion({ ...base, actualizacionesActivas: false, updateId: 'x' })).toMatchObject({ origen: 'desarrollo', updateId: null });
  });

  it('el build sale de iOS o de Android y es null si ninguno lo da', () => {
    expect(armarVersion({ ...base, buildAndroid: 42 }).build).toBe('42');
    expect(armarVersion(base).build).toBeNull();
  });
});

describe('textos', () => {
  const update = armarVersion({
    ...base,
    esLanzamientoEmbebido: false,
    buildIos: '7',
    runtimeVersion: '1.0.0',
    canal: 'preview',
    updateId: '0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
    creadoEn: new Date('2026-09-30T12:00:00Z'),
  });

  it('el resumen cabe en una linea y recorta el id', () => {
    expect(resumenDeVersion(update)).toBe('Atlas 1.0.0 (7) · preview · update 0195a1b2');
  });

  it('el bloque de soporte trae runtime, canal, origen y update', () => {
    const t = textoParaSoporte(update);
    expect(t).toContain('Atlas 1.0.0 (build 7)');
    expect(t).toContain('Runtime: 1.0.0');
    expect(t).toContain('Canal: preview');
    expect(t).toContain('Código en uso: actualización');
    expect(t).toContain('Update: 0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
  });

  it('sin update dice que corre el codigo de fabrica', () => {
    expect(textoParaSoporte(armarVersion(base))).toContain('Update: ninguno (código de fábrica)');
  });
});

describe('seguridad del modulo', () => {
  const fuente = readFileSync(join(__dirname, '..', 'src/device/version-app.ts'), 'utf8');
  it('solo importa expo-constants y expo-updates: nada de sesion ni almacen seguro', () => {
    const imports = [...fuente.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(['expo-constants', 'expo-updates']);
  });
  it('no importa expo-application (modulo nativo nuevo: romperia las instalaciones ya hechas)', () => {
    expect(fuente).not.toMatch(/from 'expo-application'/);
  });
});
