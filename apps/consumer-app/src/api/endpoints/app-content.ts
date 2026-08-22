/**
 * Lo que la app enseña y no es un dato del cliente.
 *
 * ## Por que esto no vive en el codigo
 *
 * Porque estaba en el codigo. El eslogan, los pasos de bienvenida, las preguntas frecuentes y el
 * telefono de soporte eran constantes de la app: cambiar una frase costaba compilar, firmar, publicar
 * en dos tiendas y esperar a que cada persona actualizara. Mientras tanto convivian dos versiones
 * distintas de lo que Atlas dice ser — y cuando el texto alcanza a las condiciones del credito, eso
 * deja de ser un detalle de producto.
 *
 * ## La accion viene resuelta
 *
 * El servidor devuelve el enlace de WhatsApp ya armado, con prefijo de pais incluido. Componerlo aqui
 * significaria que «+591» vive en la app, y soportar un segundo pais —o corregir un prefijo— obligaria
 * a publicar otra vez.
 */
import { request } from '../client';

export type ContentBullet = { text: string; icon?: string | null; emphasis?: boolean };

export type ContentAction = { kind: string; label: string; url: string };

export type ContentEntry = {
  contentKey: string;
  surface: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  bullets: ContentBullet[];
  metadata: Record<string, unknown>;
  action: ContentAction | null;
  displayOrder: number;
};

type Envuelto<T> = { items: T };

/**
 * El contenido de una pantalla.
 *
 * Nunca lanza. Una pantalla de ayuda que revienta porque el servidor no respondio es peor que una
 * pantalla de ayuda incompleta: quien la abre suele estar ya con un problema, y este es justo el
 * momento en el que la app no puede sumarle otro.
 */
export const getContent = async (surface: string): Promise<ContentEntry[]> => {
  try {
    const envelope = await request<Envuelto<ContentEntry[]>>(`/app-content?surface=${encodeURIComponent(surface)}`);
    const items = Array.isArray(envelope) ? envelope : (envelope?.items ?? []);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};
