/**
 * La distribucion interna de QA: que preview sea la app real y que build y update lean lo mismo.
 * Se lee eas.json / app.json como texto: son la fuente de verdad de lo que EAS hace.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Perfil = {
  distribution?: string;
  channel?: string;
  environment?: string;
  developmentClient?: boolean;
  env?: Record<string, string>;
  ios?: { simulator?: boolean };
};
const leer = (f: string) => JSON.parse(readFileSync(join(__dirname, '..', f), 'utf8'));
const eas = leer('eas.json') as { build: Record<string, Perfil> };
const perfil = (nombre: string): Perfil => {
  const p = eas.build[nombre];
  if (!p) throw new Error(`eas.json no tiene el perfil ${nombre}`);
  return p;
};
const app = leer('app.json') as { expo: Record<string, any> };

describe('perfiles de EAS', () => {
  it('preview: interna, canal y entorno preview, iPhone real y SIN cliente de desarrollo', () => {
    const p = perfil('preview');
    expect(p).toMatchObject({ distribution: 'internal', channel: 'preview', environment: 'preview' });
    expect(p.ios?.simulator).toBe(false);
    expect(p.developmentClient).toBeUndefined();
  });

  it('production conserva su canal y su entorno', () => {
    expect(perfil('production')).toMatchObject({ channel: 'production', environment: 'production' });
    expect(perfil('production').distribution).toBeUndefined();
  });

  it('development es el unico con cliente de desarrollo', () => {
    expect(perfil('development')).toMatchObject({ developmentClient: true, channel: 'development', environment: 'development' });
    for (const [n, p] of Object.entries(eas.build)) if (n !== 'development') expect(p.developmentClient).toBeUndefined();
  });

  it('cada perfil declara canal y entorno', () => {
    for (const p of Object.values(eas.build)) {
      expect(p.channel).toBeTruthy();
      expect(p.environment).toBeTruthy();
    }
  });

  it('preview y production llevan exactamente las mismas variables (paridad funcional)', () => {
    expect(perfil('preview').env).toEqual(perfil('production').env);
  });

  it('ninguna variable apunta a una red local ni a http, y ningun perfil lleva secretos', () => {
    for (const p of Object.values(eas.build)) {
      expect(p.env?.EXPO_PUBLIC_ATLAS_API_URL).toMatch(/^https:\/\//);
      expect(p.env?.EXPO_PUBLIC_ATLAS_API_URL).not.toMatch(/localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|\/\/10\./);
      for (const k of Object.keys(p.env ?? {})) expect(k).toMatch(/^EXPO_PUBLIC_ATLAS_[A-Z_]+$/);
    }
  });

  it('el envio a App Store Connect no cambio', () => {
    expect(app.expo.ios.bundleIdentifier).toBe('bo.atlas.consumer');
  });
});

describe('expo-updates', () => {
  it('runtimeVersion por appVersion y URL de EAS Update del proyecto', () => {
    expect(app.expo.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(app.expo.updates.url).toBe(`https://u.expo.dev/${app.expo.extra.eas.projectId}`);
  });

  it('se conservan las capacidades nativas de produccion', () => {
    const plugins = app.expo.plugins.map((x: string | string[]) => (Array.isArray(x) ? x[0] : x));
    for (const n of ['expo-location', 'expo-contacts', 'expo-notifications', 'expo-maps', 'expo-camera', 'expo-task-manager', 'expo-secure-store']) {
      expect(plugins).toContain(n);
    }
    const loc = app.expo.plugins.find((x: unknown) => Array.isArray(x) && x[0] === 'expo-location')[1];
    expect(loc.isIosBackgroundLocationEnabled).toBe(true);
    expect(app.expo.ios.infoPlist.NSFaceIDUsageDescription).toBeTruthy();
  });
});
