/**
 * La tarjeta de confianza: por que pedimos cada dato y que hacemos para protegerlo.
 *
 * ## Que problema resuelve
 *
 * Un formulario de alta de credito pide cosas que en cualquier otro contexto nadie daria: fecha de
 * nacimiento, cuanto ganas, donde vives, una foto de tu carnet y la cara. La app las pedia sin
 * decir para que, con una linea de letra pequena al final de alguna pantalla —«la direccion se
 * guarda cifrada»— que se lee despues de haberla escrito, cuando ya no sirve de nada.
 *
 * El abandono en un alta no ocurre en el campo dificil: ocurre en el campo que la persona no
 * entiende por que le piden. Esta tarjeta responde esa pregunta EN la pantalla donde se hace, dato
 * por dato, y añade lo unico que la calma de verdad: que pasa con ese dato despues.
 *
 * ## Por que va al FINAL y plegada entera
 *
 * Encima del formulario, aunque estuviera plegada, la tarjeta se cobraba el primer tercio de la
 * pantalla y empujaba los campos fuera: lo primero que veia quien entra a rellenar no era que
 * rellenar, era una explicacion. Al final no le quita sitio a nada y sigue estando donde se busca
 * —al terminar de leer un formulario es cuando aparece la duda de si darle a enviar—.
 *
 * Plegada entera, y no fila a fila. Una tarjeta con cuatro filas desplegables obliga a cuatro
 * toques para leerla y deja al ojo decidiendo cual abrir; plegada es UN renglon que dice que la
 * explicacion existe, y un toque la muestra completa. La confianza no la da leer el texto: la da
 * ver que esta ahi.
 *
 * ## Por que lleva el degradado de la marca
 *
 * `primitives.tsx` reserva el degradado a una sola superficie por pantalla, y en el alta no hay
 * ninguna otra que lo use: la linea de credito —la que se lo gasta en el inicio— todavia no existe
 * para esta persona. Aqui es la pieza que tiene que destacar sobre el formulario, porque es la que
 * contesta la objecion que hace abandonar. Fuera del alta esta tarjeta no debe usarse en una
 * pantalla que ya tenga `BrandPanel`.
 *
 * ## Lo que NO hace
 *
 * No promete nada que el backend no haga. Cada resguardo de `TRUST_*` describe un comportamiento
 * comprobable —el numero de carnet no se persiste, el telefono se guarda cifrado y en pantalla solo
 * aparecen sus ultimas cifras—, y por eso el contenido vive aqui y no en las pantallas: un texto
 * legal repartido por cinco archivos se contradice solo en cuanto alguien toca uno.
 */
import React from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { color, palette, radius, space, spring } from '../theme/tokens';
import { BrandHalo } from './brand';
import { Icon, type IconName } from './icons';
import { AtlasText } from './primitives';

// `LayoutAnimation` en Android exige encenderlo a mano y no hace nada sin esto.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type TrustItem = {
  icon: IconName;
  /** El dato, nombrado como lo nombra el formulario. Si ahi dice «Tu PIN», aqui tambien. */
  dato: string;
  /** Para que lo necesitamos. En una frase, y en terminos de lo que la persona consigue. */
  porque: string;
  /**
   * Que pasa con el dato despues, en etiquetas.
   *
   * Eran una frase, y una frase de dos renglones por dato convertia la tarjeta en un parrafo que
   * nadie lee encima de un formulario que hay que rellenar. Lo que calma no es el matiz: es
   * reconocer «cifrado», «no se guarda», «nunca al comercio» de un vistazo. Dos o tres por dato; a
   * la cuarta ya no se leen, se miran.
   */
  garantias: Garantia[];
};

export type Garantia = { icon: IconName; label: string };

export function TrustCard({ items, title = 'Por qué te pedimos esto' }: { items: TrustItem[]; title?: string }) {
  const [abierta, setAbierta] = React.useState(false);
  const reduced = useReducedMotion();
  const giro = useSharedValue(0);

  React.useEffect(() => {
    giro.value = reduced ? (abierta ? 1 : 0) : withSpring(abierta ? 1 : 0, spring.settle);
  }, [abierta, reduced, giro]);

  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value * 90}deg` }] }));

  const alternar = () => {
    if (!reduced) {
      /*
        `LayoutAnimation` y no Reanimated a proposito.

        Lo que cambia aqui es la ALTURA de un bloque de texto, que depende de cuantas lineas ocupe
        —y eso no se sabe hasta medirlo—. Reanimated anima valores que uno conoce de antemano; para
        un alto desconocido habria que medir en dos pasadas y se ve el salto de la primera.
        `LayoutAnimation` deja que el motor de reparto haga su trabajo y solo interpola el
        resultado, que es exactamente este caso.
      */
      LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    }
    setAbierta((actual) => !actual);
  };

  return (
    /*
      El filo con degradado: un degradado de 1 px de grosor con la superficie encima, lo que asoma
      por el contorno ES el borde. Mismo truco que `BrandPanel`; ver el porque alli.
    */
    <LinearGradient
      colors={[palette.brand500, palette.brand400, palette.brand700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.5, 1]}
      style={styles.edge}
    >
      <View style={styles.surface}>
        {/*
          El resplandor detras del escudo. Es lo unico «de mas» que lleva la tarjeta, y va justo
          debajo del icono que la encabeza: da profundidad al angulo por el que entra la mirada sin
          teñir el texto que hay que leer.
        */}
        <BrandHalo size={260} style={styles.halo} />

        <Pressable
          onPress={alternar}
          accessibilityRole="button"
          accessibilityState={{ expanded: abierta }}
          accessibilityLabel={`${title}. ${abierta ? 'Ocultar' : 'Ver'} qué datos te pedimos, para qué y cómo los protegemos.`}
          style={styles.head}
          hitSlop={6}
        >
          <View style={styles.shield}>
            <Icon name="escudo" size={20} tint={color.action.primary} />
          </View>
          <View style={styles.headText}>
            <AtlasText variant="bodyStrong">{title}</AtlasText>
            <AtlasText variant="caption" tone="secondary">
              Y qué hacemos para que esté a salvo.
            </AtlasText>
          </View>
          <Animated.View style={chevron}>
            <Icon name="adelante" size={18} tint={color.text.tertiary} />
          </Animated.View>
        </Pressable>

        {abierta ? (
          <View style={styles.list}>
            {items.map((item, indice) => (
              <TrustRow key={item.dato} item={item} primera={indice === 0} />
            ))}
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

/**
 * Una fila: el dato, para que lo pedimos y las garantias. Entera, sin plegar.
 *
 * Se pliega la tarjeta, no cada fila: abrir cuatro veces para leer cuatro frases de una linea es
 * mas trabajo del que ahorra, y ademas esconde justo lo unico que se mira —las etiquetas—.
 */
function TrustRow({ item, primera }: { item: TrustItem; primera: boolean }) {
  return (
    <View style={[styles.row, !primera && styles.rowSeparada]}>
      <View style={styles.rowHead}>
        {/*
          Ficha tintada, no un icono suelto. Un glifo gris de 18 px al margen se lee como una
          viñeta —decoracion— y a esa escala su dibujo no se distingue. Sobre su propia superficie
          el icono pasa a ser el objeto del que habla la fila, y de paso alinea las filas por algo
          mas solido que el ancho variable de un dibujo.
        */}
        <View style={styles.rowIcon}>
          <Icon name={item.icon} size={16} tint={color.action.primary} />
        </View>
        <AtlasText variant="body" style={styles.rowTitle}>
          {item.dato}
        </AtlasText>
      </View>

      {(
        <View style={styles.detalle}>
          <AtlasText variant="caption" tone="secondary">
            {item.porque}
          </AtlasText>
          {/*
            Las garantias, en fila y envolviendo. Son afirmaciones de otra naturaleza que el «por
            que» —una justifica, las otras se comprometen— y por eso no van en el mismo parrafo: en
            texto corrido la promesa queda al final de un bloque gris y se pierde justo la mitad que
            calma.
          */}
          <View style={styles.garantias}>
            {item.garantias.map((garantia) => (
              <View key={garantia.label} style={styles.garantia}>
                <Icon name={garantia.icon} size={12} tint={color.action.primary} />
                <AtlasText variant="micro" style={styles.garantiaTexto}>
                  {garantia.label}
                </AtlasText>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { borderRadius: radius.lg, padding: 1 },
  surface: {
    borderRadius: radius.lg - 1,
    backgroundColor: color.surface.sheet,
    padding: space.base,
    gap: space.md,
    // Recorta el halo al radio de la tarjeta: sin esto el resplandor asoma por las esquinas y
    // deshace justo el filo que le da el aspecto de pieza acabada.
    overflow: 'hidden',
  },
  // Centrado detras del escudo, no en la esquina: a 260 px de diametro y con el centro fuera de la
  // tarjeta lo unico que entraba era la cola del degradado, que es transparente. Asi el nucleo cae
  // justo bajo el icono, que es el sitio por donde entra la mirada.
  halo: { position: 'absolute', top: -95, left: -70 },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  shield: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.brandWash.from,
    borderWidth: 1,
    borderColor: color.surface.edge,
  },
  headText: { flex: 1, gap: 2 },

  list: { gap: space.xs },
  row: { gap: space.xs },
  rowSeparada: { borderTopWidth: 1, borderTopColor: color.border.subtle, paddingTop: space.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.brandWash.to,
  },
  rowTitle: { flex: 1 },

  // Sangrado hasta donde empieza el texto de la fila —ficha + hueco—, para que el detalle cuelgue
  // del dato y no del borde de la tarjeta.
  detalle: { gap: space.sm, paddingLeft: 28 + space.sm, paddingBottom: space.xs },
  garantias: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  garantia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    backgroundColor: color.surface.sunken,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.surface.edge,
    paddingVertical: space.xxs,
    paddingHorizontal: space.sm,
  },
  garantiaTexto: { color: color.text.secondary },
});
