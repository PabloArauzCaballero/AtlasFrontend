/**
 * El buscador de Preguntas frecuentes, sin pantalla: qué preguntas se muestran para lo que la persona escribió.
 *
 * Busca en el título, el cuerpo y las viñetas, sin distinguir mayúsculas ni tildes («limite» encuentra «límite»).
 * Una pregunta sin título no se muestra nunca: un desplegable sin encabezado no dice qué abre.
 */
import type { ContentEntry } from '../api/endpoints/app-content';

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function filtrarPreguntas<T extends Pick<ContentEntry, 'title' | 'body' | 'bullets'>>(preguntas: readonly T[], busqueda: string): T[] {
  const conTitulo = preguntas.filter((p) => Boolean(p.title));
  const q = normalizar(busqueda.trim());
  if (!q) return conTitulo;
  return conTitulo.filter((p) => normalizar([p.title ?? '', p.body ?? '', ...(p.bullets ?? []).map((b) => b.text)].join(' ')).includes(q));
}
