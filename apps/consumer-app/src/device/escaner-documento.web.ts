/**
 * El escaner de documentos en el navegador: no hay.
 *
 * La web sigue con la camara de `expo-camera`, como siempre. Hacer el recuadro en vivo en el
 * navegador pediria OpenCV.js (unos 9 MB antes de ver nada; plan del 2026-09-26, §6).
 *
 * Este fichero NO nombra la libreria nativa, ni con `import` ni con `require`: Metro empaqueta todo
 * lo que un `require` literal alcanza, aunque nunca se ejecute, y la libreria no tiene nada que
 * hacer en el bundle web. `__tests__/escaner-documento.test.ts` lo comprueba sobre el texto.
 */
import type { ResultadoEscaneo } from './escaner-documento-tipos';

export type { MotivoSinEscaner, ResultadoEscaneo } from './escaner-documento-tipos';

/**
 * Siempre `false`, con la bandera como este: en el navegador la pantalla va directa a la camara de
 * siempre. Si dijera la bandera, la pantalla «abriria» un escaner que no existe y la bitacora
 * anotaria `escanea` + `respaldo_camara` en cada captura de la web, que no es lo que paso. El origen
 * que viaja al backend no depende de esto (`features/origen-de-captura.ts` mira la bandera).
 */
export function escanerHabilitado(): boolean {
  return false;
}

export async function escanearDocumento(): Promise<ResultadoEscaneo> {
  return { tipo: 'no_disponible', motivo: 'web' };
}
