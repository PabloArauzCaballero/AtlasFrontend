/**
 * Qué acción de una pieza de contenido remoto se puede ejecutar (APP-17).
 *
 * El contenido lo escribe el portal, y lo que el portal escribe se trata como entrada no confiable:
 * un contenido mal cargado —o un portal comprometido— podía abrir con `Linking.openURL` cualquier
 * esquema: `tel:`, `sms:`, el deep link de otra app o, en el navegador, `javascript:`. Sólo pasan:
 *  - `screen`: una ruta INTERNA de la app (la misma regla que los avisos push, `ruta-del-aviso.ts`);
 *  - `tour`: una clave que resuelve la propia app, nunca se abre como URL;
 *  - el resto (enlace, WhatsApp): sólo `https:`. El backend ya arma WhatsApp como `https://wa.me/…`.
 */
import type { ContentAction } from '../api/endpoints/app-content';
import { esRutaInterna } from '../device/ruta-del-aviso';

export function enlaceExternoSeguro(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function accionPermitida(action: ContentAction | null | undefined): ContentAction | null {
  if (!action || typeof action.url !== 'string') return null;
  if (action.kind === 'screen') return esRutaInterna(action.url) ? action : null;
  if (action.kind === 'tour') return action.url.trim() ? action : null;
  return enlaceExternoSeguro(action.url) ? action : null;
}
