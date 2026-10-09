import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * La CSP de la web (`nginx.cabeceras-seguridad.conf`, auditoría 2026-10-09) sólo admite scripts del
 * propio origen: un `<script>` en línea en `public/index.html` se bloquea en el navegador sin que nada
 * falle en las pruebas. Pasó el 2026-10-09 con el script de la apariencia oscura.
 */
describe('public/index.html', () => {
  const html = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf8');

  it('no tiene scripts en línea: todo <script> lleva src', () => {
    const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const etiqueta of scripts) expect(etiqueta).toMatch(/\ssrc=/i);
  });

  it('no usa manejadores en línea (onload=, onclick=…)', () => {
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });
});
