import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cada motivo de rechazo del extracto tiene su título y su acción en «Recalcular mi línea».
 *
 * La lista de motivos vive en el contrato (`RejectionCategory`) y los textos en la pantalla: un motivo nuevo del
 * backend sin texto se pintaba como «No pudimos usarlo» y sin acción. El último que llegó, el titular distinto
 * (2026-10-16), es justo uno en el que la acción lo es todo.
 */
const raiz = join(__dirname, '..', 'src');
const contrato = readFileSync(join(raiz, 'api', 'endpoints', 'credit-line.ts'), 'utf8');
const pantalla = readFileSync(join(raiz, 'features', 'onboarding', 'pantalla-extracto.tsx'), 'utf8');

const categorias = [...(/export type RejectionCategory =([^;]+);/.exec(contrato)?.[1] ?? '').matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]!);

describe('motivos de rechazo del extracto', () => {
  it('el contrato trae el del titular distinto', () => {
    expect(categorias).toContain('TITULAR_NO_COINCIDE');
  });

  it.each(categorias)('%s tiene título y acción en la pantalla', (categoria) => {
    expect(pantalla).toMatch(new RegExp(`\\n  ${categoria}: \\{\\n    titulo: "[^"]+",\\n    accion:`));
  });

  it('la pantalla dice que la cuenta tiene que ser suya', () => {
    expect(pantalla).toMatch(/cuenta a tu nombre/);
  });
});
