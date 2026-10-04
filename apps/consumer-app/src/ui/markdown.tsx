/**
 * Pinta un texto con markdown (títulos, negritas, listas, citas, enlaces) con los componentes de la app.
 *
 * Existe porque los artículos de ayuda y las preguntas frecuentes se editan desde el portal CON markdown y la app los
 * pintaba como texto plano: «## En efectivo» y «**Importante:**» aparecían literales en la pantalla del cliente. Ver
 * `src/features/markdown.ts` para lo que entiende y lo que no.
 *
 * Todo sale de `AtlasText` y de los tokens: ningún tamaño ni color escrito aquí. Los enlaces sólo abren `http(s)://`
 * (el parser ya descarta cualquier otro esquema).
 */
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { parsearMarkdown, type Bloque, type Inline } from '../features/markdown';
import { color, radius, space, stroke } from '../theme/tokens';
import { AtlasText } from './primitives';

type Tono = 'primary' | 'secondary';
type Variante = 'body' | 'caption';

function abrir(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Los trozos en línea de un bloque, anidados dentro del `AtlasText` que lo contiene para que fluyan como un solo párrafo. */
function EnLinea({ trozos, variante, tono }: { trozos: Inline[]; variante: Variante; tono: Tono }) {
  const fuerte = variante === 'caption' ? 'captionStrong' : 'bodyStrong';
  return (
    <>
      {trozos.map((trozo, i) => {
        switch (trozo.tipo) {
          case 'negrita':
            return (
              <AtlasText key={i} variant={fuerte} tone={tono}>
                {trozo.texto}
              </AtlasText>
            );
          case 'cursiva':
            return (
              <AtlasText key={i} variant={variante} tone={tono} style={styles.cursiva}>
                {trozo.texto}
              </AtlasText>
            );
          case 'codigo':
            return (
              <AtlasText key={i} variant={variante} tone={tono} style={styles.codigo}>
                {trozo.texto}
              </AtlasText>
            );
          case 'enlace':
            return (
              <AtlasText
                key={i}
                variant={fuerte}
                tone="brand"
                style={styles.enlace}
                accessibilityRole="link"
                onPress={() => abrir(trozo.url)}
              >
                {trozo.texto}
              </AtlasText>
            );
          default:
            return <React.Fragment key={i}>{trozo.texto}</React.Fragment>;
        }
      })}
    </>
  );
}

function BloqueView({ bloque, variante, tono }: { bloque: Bloque; variante: Variante; tono: Tono }) {
  switch (bloque.tipo) {
    case 'titulo':
      // Un `#` del portal es un título de bloque; `##` y `###` son subtítulos del artículo: de menor a mayor jerarquía.
      return (
        <AtlasText variant={bloque.nivel === 1 ? 'h3' : 'title'} accessibilityRole="header" style={styles.titulo}>
          <EnLinea trozos={bloque.inline} variante="body" tono="primary" />
        </AtlasText>
      );
    case 'lista':
      return (
        <View style={styles.lista}>
          {bloque.items.map((item, i) => (
            <View key={i} style={styles.item}>
              <AtlasText variant={variante} tone={tono} style={styles.marcador}>
                {bloque.ordenada ? `${i + 1}.` : '•'}
              </AtlasText>
              <AtlasText variant={variante} tone={tono} style={styles.itemTexto}>
                <EnLinea trozos={item} variante={variante} tono={tono} />
              </AtlasText>
            </View>
          ))}
        </View>
      );
    case 'cita':
      return (
        <View style={styles.cita}>
          <AtlasText variant={variante} tone="secondary" style={styles.cursiva}>
            <EnLinea trozos={bloque.inline} variante={variante} tono="secondary" />
          </AtlasText>
        </View>
      );
    case 'regla':
      return <View style={styles.regla} />;
    default:
      return (
        <AtlasText variant={variante} tone={tono}>
          <EnLinea trozos={bloque.inline} variante={variante} tono={tono} />
        </AtlasText>
      );
  }
}

export function Markdown({ children, variant = 'body', tone = 'secondary', testID }: { children: string | null | undefined; variant?: Variante; tone?: Tono; testID?: string }) {
  const bloques = parsearMarkdown(children);
  if (bloques.length === 0) return null;
  return (
    <View style={styles.raiz} testID={testID}>
      {bloques.map((bloque, i) => (
        <BloqueView key={i} bloque={bloque} variante={variant} tono={tone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: space.sm },
  // Un título pide aire ARRIBA (separa el apartado anterior) y poco abajo (se pega a lo que encabeza).
  titulo: { paddingTop: space.sm },
  lista: { gap: space.xs },
  item: { flexDirection: 'row', gap: space.sm },
  marcador: { minWidth: space.lg, textAlign: 'right' },
  itemTexto: { flex: 1 },
  cursiva: { fontStyle: 'italic' },
  codigo: { backgroundColor: color.surface.raisedStrong, borderRadius: radius.sm },
  enlace: { textDecorationLine: 'underline' },
  cita: { borderLeftWidth: stroke.hairline * 3, borderLeftColor: color.border.strong, paddingLeft: space.md },
  regla: { height: stroke.hairline, backgroundColor: color.border.hairline, marginVertical: space.xs },
});
