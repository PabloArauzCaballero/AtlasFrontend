/**
 * La distribucion interna de QA: que preview sea la app real y que build y update lean lo mismo.
 * Se lee eas.json / app.json como texto: son la fuente de verdad de lo que EAS hace.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolverUrlDeLaApi } from '../src/api/config';

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
    for (const [nombre, p] of Object.entries(eas.build)) {
      /*
       * SIN excepciones: ningun perfil de EAS puede apuntar a `http://`.
       *
       * iOS bloquea el http plano (App Transport Security) y este proyecto sólo habilita el cleartext
       * en ANDROID (`plugins/with-cleartext-when-http.js`). Un build de iPhone con la API en http no
       * llega al servidor: la app arranca, muestra el logo, y luego se queda en negro, o en «Sin
       * conexión» / «No pudimos cargar tu registro» en cada pantalla, con el servidor perfectamente
       * sano. Pasó el 2026-10-07 con el perfil `testflight-test` (http://161.97.85.216): el build 25
       * quedó inservible en el iPhone de Pablo. TEST se sirve por https en
       * atlas.consumerweb.test.arauzsoftware.com; la IP en bruto es para navegadores, no para la app.
       */
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

  it('la promesa de Face ID tiene codigo detras (APP-13)', () => {
    const plugins = app.expo.plugins.map((x: string | string[]) => (Array.isArray(x) ? x[0] : x));
    expect(plugins).toContain('expo-local-authentication');
    const biometria = readFileSync(join(__dirname, '..', 'src', 'device', 'biometria.ts'), 'utf8');
    expect(biometria).toMatch(/authenticateAsync\(/);
  });

  it('ningun App Link de Android apunta a una ruta que la app no tiene (APP-24)', () => {
    const filtros = (app.expo.android.intentFilters ?? []) as { data?: { pathPrefix?: string }[] }[];
    for (const filtro of filtros) {
      for (const dato of filtro.data ?? []) {
        // `/pos` abria `+not-found`: no hay `app/**/pos*`. Si vuelve un App Link, que sea con su ruta.
        expect(dato.pathPrefix).not.toBe('/pos');
      }
    }
  });
});

describe('la URL de la API (APP-26)', () => {
  const fuente = readFileSync(join(__dirname, '..', 'src', 'api', 'config.ts'), 'utf8');

  it('el codigo no lleva ninguna base por defecto: ni IP de red local ni http', () => {
    const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(sinComentarios).not.toMatch(/https?:\/\/[0-9]/);
    expect(sinComentarios).not.toMatch(/192\.168\.|localhost|127\.0\.0\.1|10\.0\.2\.2/);
  });

  it('sin URL configurada falla con un error que dice que falta y donde ponerla', () => {
    expect(() => resolverUrlDeLaApi(undefined)).toThrow(/EXPO_PUBLIC_ATLAS_API_URL/);
    expect(() => resolverUrlDeLaApi('   ')).toThrow(/\.env/);
    expect(resolverUrlDeLaApi('https://api.atlas.invalid/api/v1')).toBe('https://api.atlas.invalid/api/v1');
  });

  it('un build de EAS sin URL no se construye; fuera de EAS (expo start) no se corta la configuracion', () => {
    // `app.config.js` es CommonJS de Node (lo carga Expo, no Metro).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { exigirUrlEnBuildDeEas } = require('../app.config.js') as {
      exigirUrlEnBuildDeEas: (url: string | undefined, entorno: Record<string, string | undefined>) => void;
    };
    expect(() => exigirUrlEnBuildDeEas(undefined, { EAS_BUILD: 'true', EAS_BUILD_PROFILE: 'production' })).toThrow(
      /production.*EXPO_PUBLIC_ATLAS_API_URL/,
    );
    expect(() => exigirUrlEnBuildDeEas(undefined, { EAS_BUILD_PROFILE: 'preview' })).toThrow();
    expect(() => exigirUrlEnBuildDeEas('https://a.invalid/api/v1', { EAS_BUILD: 'true' })).not.toThrow();
    expect(() => exigirUrlEnBuildDeEas(undefined, {})).not.toThrow();
  });

  it('cada perfil de EAS, con su herencia, lleva la URL de la API', () => {
    const resuelto = (nombre: string): Perfil => {
      const p = perfil(nombre) as Perfil & { extends?: string };
      const base = p.extends ? resuelto(p.extends) : {};
      return { ...base, ...p, env: { ...(base as Perfil).env, ...p.env } };
    };
    for (const nombre of Object.keys(eas.build)) {
      expect(resuelto(nombre).env?.EXPO_PUBLIC_ATLAS_API_URL).toMatch(/^https:\/\/[^/]+\/api\/v1$/);
    }
  });
});
