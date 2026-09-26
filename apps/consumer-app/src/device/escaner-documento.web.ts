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
import { escanerDocumentoActivado } from '../api/config';
import type { ResultadoEscaneo } from './escaner-documento-tipos';

export type { MotivoSinEscaner, ResultadoEscaneo } from './escaner-documento-tipos';

/** La misma bandera que en el movil; ver `escaner-documento.ts`. */
export function escanerHabilitado(): boolean {
  return escanerDocumentoActivado;
}

export async function escanearDocumento(): Promise<ResultadoEscaneo> {
  return { tipo: 'no_disponible', motivo: 'web' };
}
