#!/usr/bin/env node
/**
 * Compara el bloque `env` de un perfil de eas.json con las variables del entorno EAS del mismo
 * nombre. Build y `eas update --environment X` leen fuentes distintas; si difieren, el binario y
 * sus updates hablan con backends distintos sin que nada falle.
 *
 *   node scripts/check-eas-env.mjs preview      (sale 1 si difieren o falta algo)
 *
 * Solo maneja variables EXPO_PUBLIC_* (publicas, en texto plano); no imprime valores.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const entorno = process.argv[2] ?? 'preview';
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const esperado = eas.build[entorno]?.env;
if (!esperado) {
  console.error(`eas.json no tiene un perfil «${entorno}» con env.`);
  process.exit(1);
}

let salida;
try {
  salida = execFileSync('npx', ['--yes', 'eas-cli', 'env:list', entorno, '--format', 'short'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  console.error(`No se pudo leer el entorno EAS «${entorno}» (¿sesión iniciada? \`npx eas-cli whoami\`).\n${e.stderr ?? e.message}`);
  process.exit(1);
}
const remoto = Object.fromEntries(
  salida
    .split('\n')
    .filter((l) => /^EXPO_PUBLIC_[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const problemas = [];
for (const [k, v] of Object.entries(esperado)) {
  if (!(k in remoto)) problemas.push(`falta en el entorno EAS «${entorno}»: ${k}`);
  else if (remoto[k] !== v) problemas.push(`difiere: ${k}`);
}
for (const k of Object.keys(remoto)) if (!(k in esperado)) problemas.push(`sobra en el entorno EAS (no está en eas.json): ${k}`);

if (problemas.length) {
  console.error(problemas.join('\n'));
  process.exit(1);
}
console.log(`eas.json[${entorno}] y el entorno EAS «${entorno}» coinciden (${Object.keys(esperado).length} variables).`);
