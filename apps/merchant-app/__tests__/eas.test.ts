/**
 * Ningún perfil de EAS puede apuntar a la API por http: iOS bloquea el tráfico en claro (ATS) y la
 * app arrancaría con el logo y se quedaría en «Sin conexión» con el servidor sano (memoria «Nunca
 * http en un build de iPhone»). Misma regla que `consumer-app/__tests__/eas-distribucion.test.ts`.
 */
import eas from '../eas.json';

type Perfil = { env?: Record<string, string>; extends?: string };
const perfiles = eas.build as Record<string, Perfil>;

function urlDe(nombre: string): string | undefined {
  const perfil = perfiles[nombre];
  return perfil?.env?.EXPO_PUBLIC_ATLAS_API_URL ?? (perfil?.extends ? urlDe(perfil.extends) : undefined);
}

test.each(Object.keys(perfiles))('el perfil «%s» usa la API del ERP por https', (nombre) => {
  const url = urlDe(nombre);
  expect(url).toMatch(/^https:\/\/[^/]+\/api\/v1$/);
});
