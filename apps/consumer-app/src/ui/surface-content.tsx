/**
 * Las piezas de contenido que negocio escribe en el portal para una pantalla de la app.
 *
 * ## Por que existe
 *
 * El portal ofrece siete superficies (Bienvenida, Preguntas, Ayuda, Inicio, Legal, Perfil, Credito)
 * pero la app solo pintaba cuatro. Lo que se publicaba en Inicio, Perfil o Credito se guardaba y
 * ningun cliente lo veia, y quien lo escribia no tenia manera de enterarse. Aqui se pinta cada
 * pieza como una tarjeta: titulo, subtitulo, texto, lista de puntos y boton.
 *
 * ## Por que nunca lanza ni deja un hueco
 *
 * `getContent` devuelve `[]` si el servidor no responde, y una pieza sin nada que decir no se pinta:
 * una tarjeta vacia seria peor que ninguna.
 */
import { useEffect, useState } from 'react';
import { getContent, type ContentEntry } from '../api/endpoints/app-content';
import { ContentActionButton, ContentBullets } from './content';
import { Markdown } from './markdown';
import { AtlasText, Card, CardHeader } from './primitives';

/** Una pieza dice algo si tiene titulo, subtitulo, texto o al menos un punto con texto. */
export function tieneContenido(entry: ContentEntry): boolean {
  return Boolean(
    entry.title?.trim() || entry.subtitle?.trim() || entry.body?.trim() || entry.bullets.some((bullet) => bullet.text.trim()),
  );
}

/**
 * Las piezas visibles de una superficie, en el orden del portal.
 *
 * `omitir` deja fuera las que ya pinta otro componente: en Inicio, las que llevan
 * `metadata.partnerName` son el banner de partner y no deben salir dos veces.
 */
export function piezasVisibles(entries: readonly ContentEntry[], omitir?: (entry: ContentEntry) => boolean): ContentEntry[] {
  return entries.filter((entry) => tieneContenido(entry) && !omitir?.(entry));
}

export const esBannerDePartner = (entry: ContentEntry): boolean =>
  typeof entry.metadata?.partnerName === 'string' && entry.metadata.partnerName.trim().length > 0;

export function useSurfaceContent(surface: string, omitir?: (entry: ContentEntry) => boolean): ContentEntry[] {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    void getContent(surface).then((loaded) => {
      if (!cancelled) setEntries(piezasVisibles(loaded, omitir));
    });
    return () => {
      cancelled = true;
    };
    // `omitir` es una funcion fija de quien llama: no debe volver a pedir el contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface]);
  return entries;
}

export function SurfaceContent({ entries }: { entries: readonly ContentEntry[] }) {
  return (
    <>
      {entries.map((entry) => (
        <Card key={entry.contentKey} testID={`contenido-${entry.contentKey}`}>
          {entry.title?.trim() ? <CardHeader title={entry.title} detail={entry.subtitle?.trim() || undefined} divider={false} /> : null}
          {!entry.title?.trim() && entry.subtitle?.trim() ? (
            <AtlasText variant="bodyStrong">{entry.subtitle}</AtlasText>
          ) : null}
          {entry.body?.trim() ? <Markdown variant="body">{entry.body}</Markdown> : null}
          {entry.bullets.length > 0 ? <ContentBullets bullets={entry.bullets.filter((bullet) => bullet.text.trim())} /> : null}
          <ContentActionButton action={entry.action} onScreen={undefined} onTour={undefined} />
        </Card>
      ))}
    </>
  );
}
