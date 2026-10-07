/**
 * La guía de la app en PDF: «Tu app Atlas, paso a paso».
 *
 * Es un archivo estático que publica la web de la app (`public/guias/`), no una respuesta de la API:
 * así se descarga igual con o sin sesión, y el teléfono la abre en su visor de PDF sin que la app
 * tenga que guardar nada.
 *
 * ## Por qué la dirección sale de la base de la API
 *
 * En el navegador la base es relativa (`/api/v1`) y la guía vive en el mismo origen, así que basta la
 * ruta. En el teléfono no hay «mismo origen»: la base es absoluta y apunta al dominio que sirve la
 * web y reenvía la API (ver `eas.json`), que es justo donde está publicado el PDF.
 */
import { apiConfig } from '../api/config';

export const RUTA_GUIA_PDF = '/guias/ATLAS-Guia-de-la-app.pdf';

export function urlDeLaGuia(baseUrl: string = apiConfig.baseUrl): string {
  const origen = /^https?:\/\/[^/]+/i.exec(baseUrl);
  return origen ? `${origen[0]}${RUTA_GUIA_PDF}` : RUTA_GUIA_PDF;
}
