/**
 * Un markdown mínimo, a propósito, para los textos que edita una persona desde el portal.
 *
 * Los artículos de ayuda y las preguntas frecuentes se escriben con `## Por transferencia`, `**Importante:**` y listas
 * numeradas. La app los pintaba como texto plano, así que el cliente leía los símbolos tal cual («## En efectivo»,
 * «**Importante:**»). Aquí se entiende lo que se usa y NADA más:
 *
 *  - bloques: títulos `#`/`##`/`###`, listas con `-`/`*`/`•`, listas numeradas `1.`, citas `>`, regla `---`, párrafos;
 *  - en línea: **negrita**, *cursiva*, `código` y [enlaces](https://…).
 *
 * Es un parser, no un renderizador: devuelve datos para poder probarlo sin montar nada, y no tiene dependencias (una
 * librería completa pesa más que todo el contenido de ayuda de la app, y trae HTML, imágenes y plugins que nadie usa).
 *
 * ## Qué NO hace, y por qué
 *
 * No ejecuta ni interpreta HTML: el texto lo escribe una persona con acceso al portal, y lo que no es markdown se pinta
 * como texto. Sólo se aceptan enlaces `http(s)://`: un `javascript:` o un esquema propio no se vuelve enlace.
 */

export type Inline = { tipo: 'texto' | 'negrita' | 'cursiva' | 'codigo'; texto: string } | { tipo: 'enlace'; texto: string; url: string };

export type Bloque =
  | { tipo: 'parrafo'; inline: Inline[] }
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; inline: Inline[] }
  | { tipo: 'lista'; ordenada: boolean; items: Inline[][] }
  | { tipo: 'cita'; inline: Inline[] }
  | { tipo: 'regla' };

// Orden de las alternativas: la negrita (`**`) antes que la cursiva (`*`) para que `**x**` no se lea como dos cursivas.
const EN_LINEA = /(\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

/** Parte un texto en trozos de formato. Lo que no coincide con nada es texto llano. */
export function parsearEnLinea(texto: string): Inline[] {
  const salida: Inline[] = [];
  let desde = 0;
  for (const coincidencia of texto.matchAll(EN_LINEA)) {
    const trozo = coincidencia[0];
    const inicio = coincidencia.index ?? 0;
    if (inicio > desde) salida.push({ tipo: 'texto', texto: texto.slice(desde, inicio) });
    if (trozo.startsWith('**')) salida.push({ tipo: 'negrita', texto: trozo.slice(2, -2) });
    else if (trozo.startsWith('`')) salida.push({ tipo: 'codigo', texto: trozo.slice(1, -1) });
    else if (trozo.startsWith('[')) {
      const partes = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(trozo);
      if (partes) salida.push({ tipo: 'enlace', texto: partes[1] as string, url: partes[2] as string });
    } else salida.push({ tipo: 'cursiva', texto: trozo.slice(1, -1) });
    desde = inicio + trozo.length;
  }
  if (desde < texto.length) salida.push({ tipo: 'texto', texto: texto.slice(desde) });
  return salida.length > 0 ? salida : [{ tipo: 'texto', texto }];
}

const TITULO = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const VINETA = /^\s*[-*•]\s+(.+)$/;
const NUMERADA = /^\s*\d+[.)]\s+(.+)$/;
const CITA = /^\s*>\s?(.*)$/;
const REGLA = /^\s*([-*_])(\s*\1){2,}\s*$/;

/**
 * Convierte un texto en bloques. Las líneas seguidas de un mismo tipo se agrupan (los ítems de una lista, las líneas de un
 * párrafo); una línea en blanco cierra el bloque. Un salto de línea simple DENTRO de un párrafo se conserva: quien escribe
 * en el portal espera ver su renglón, no que se le junten.
 */
export function parsearMarkdown(texto: string | null | undefined): Bloque[] {
  if (!texto || !texto.trim()) return [];
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];
  let lista: { ordenada: boolean; items: Inline[][] } | null = null;

  const cerrarParrafo = () => {
    if (parrafo.length > 0) bloques.push({ tipo: 'parrafo', inline: parsearEnLinea(parrafo.join('\n')) });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) bloques.push({ tipo: 'lista', ordenada: lista.ordenada, items: lista.items });
    lista = null;
  };

  for (const linea of lineas) {
    if (!linea.trim()) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }
    // La regla va antes que la viñeta: `---` y `* * *` también empiezan como un marcador de lista.
    if (REGLA.test(linea)) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: 'regla' });
      continue;
    }
    const titulo = TITULO.exec(linea);
    if (titulo) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: 'titulo', nivel: (titulo[1] as string).length as 1 | 2 | 3, inline: parsearEnLinea(titulo[2] as string) });
      continue;
    }
    const numerada = NUMERADA.exec(linea);
    const vineta = numerada ? null : VINETA.exec(linea);
    if (numerada || vineta) {
      cerrarParrafo();
      const ordenada = Boolean(numerada);
      // Cambiar de lista con viñetas a numerada (o al revés) abre otra lista.
      if (lista && lista.ordenada !== ordenada) cerrarLista();
      lista ??= { ordenada, items: [] };
      lista.items.push(parsearEnLinea(((numerada ?? vineta) as RegExpExecArray)[1] as string));
      continue;
    }
    const cita = CITA.exec(linea);
    if (cita) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: 'cita', inline: parsearEnLinea(cita[1] as string) });
      continue;
    }
    cerrarLista();
    parrafo.push(linea.trim());
  }
  cerrarParrafo();
  cerrarLista();
  return bloques;
}

/** ¿Este texto trae algo de markdown? Sirve para no envolver en bloques lo que es una frase suelta. */
export const tieneMarkdown = (texto: string | null | undefined): boolean =>
  Boolean(texto) && parsearMarkdown(texto).some((b) => b.tipo !== 'parrafo' || b.inline.some((i) => i.tipo !== 'texto'));
