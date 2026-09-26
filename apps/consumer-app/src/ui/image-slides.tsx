/**
 * Las capturas del carnet, en slides que se pasan de lado.
 *
 * ## Por que dejaron de ser tres tarjetas apiladas
 *
 * Porque una foto de un carnet en una tarjeta de lista se ve del tamaño de un sello. La pantalla
 * tenia tres tarjetas, cada una con una miniatura de 88x66 al lado de dos lineas de metadatos, y
 * con eso NADIE puede comprobar lo unico que hay que comprobar antes de enviar: si en la foto se
 * lee el numero, si hay un reflejo encima de la fecha, si la cara sale entera. La persona pulsaba
 * «Enviar» sin haber visto de verdad lo que enviaba, y el rechazo llegaba despues, cuando ya no
 * tenia las fotos delante.
 *
 * Un carrusel a ancho completo le da a cada captura toda la pantalla, y pasarlas de lado es el
 * gesto que ya se usa para mirar fotos en cualquier telefono. Las tres siguen siendo tres pasos —el
 * indicador dice en cual va y cuantas faltan— pero se MIRAN como fotos, que es lo que son.
 *
 * ## Por que paginado y no scroll libre
 *
 * `pagingEnabled` con slides del ancho exacto del carrusel: cada gesto deja una captura centrada y
 * nunca media. Un scroll libre sobre tres elementos grandes acaba siempre a medio camino entre dos,
 * que es la version peor de las dos cosas — ni se ve una entera ni se ven las tres.
 *
 * ## Accesibilidad
 *
 * Cada slide se anuncia con su titulo y su estado, y el indicador es texto ademas de puntos: un
 * punto relleno no lo lee un lector de pantalla, y «2 de 3» si.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { AtlasText, Badge, Button } from './primitives';

export type ImageSlide = {
  /** Clave estable del paso. */
  key: string;
  title: string;
  hint: string;
  /** La imagen local, si ya se capturo. */
  uri?: string | null;
  /** Pie de foto tecnico: tamaño y huella. Solo cuando hay captura. */
  meta?: string | null;
  /** Etiqueta de estado que se pinta sobre la foto. */
  done: boolean;
  /** Que hacer al pulsar el boton de la slide. */
  onPress: () => void;
  actionLabel: string;
};

/**
 * Alto de la ventana de foto.
 *
 * Fijo y no proporcional al ancho: las tres capturas tienen proporciones distintas —el carnet es
 * apaisado, la selfie vertical— y una ventana que cambiara de alto entre slides haria saltar el
 * contenido de debajo en cada gesto. Con la ventana fija y `resizeMode="contain"`, cada foto se ve
 * ENTERA dentro de ella, que es justo lo que hay que poder comprobar.
 */
const ALTO_VENTANA = 220;

/**
 * Una peticion de ir a una lamina. Lleva un numero de pedido para que pedir DOS veces la misma
 * lamina —repetir el anverso con el reverso ya hecho— vuelva a moverse aunque la clave no cambie.
 */
export type PeticionDeLamina = { clave: string; pedido: number };

export function ImageSlides({
  slides,
  enfocar,
  ocupado = false,
}: Readonly<{
  slides: readonly ImageSlide[];
  /**
   * La lamina que hay que enseñar. Tras guardar una captura, la pantalla pide la SIGUIENTE pendiente:
   * sin esto el carrusel volvia a la primera, y quien acababa de hacer el anverso tenia que pasar de
   * lado para encontrar el reverso.
   */
  enfocar?: PeticionDeLamina | null;
  /** Mientras se sube una captura, el boton de la lamina no abre otra. */
  ocupado?: boolean;
}>) {
  const scroll = useRef<ScrollView>(null);
  const [ancho, setAncho] = useState(0);
  const [indice, setIndice] = useState(0);
  const atendida = useRef<number | null>(null);
  const pedidoAlMontar = useRef(enfocar?.pedido ?? null);

  /*
    Se atiende cuando ya hay ANCHO: antes de medir, `scrollTo` no sabe a que x ir. Sin animacion si
    la peticion ya estaba al montar (al volver de la camara la pantalla se monta de nuevo y la lamina
    tiene que estar ya en su sitio, no deslizarse delante de la persona); con animacion si llega con
    el carrusel a la vista, que es el caso del escaner del sistema.
  */
  const destino = enfocar ? slides.findIndex((slide) => slide.key === enfocar.clave) : -1;
  const pedido = enfocar?.pedido ?? null;
  useEffect(() => {
    if (ancho <= 0 || destino < 0 || pedido === null || atendida.current === pedido) return;
    atendida.current = pedido;
    scroll.current?.scrollTo({ x: destino * ancho, animated: pedido !== pedidoAlMontar.current });
    setIndice(destino);
  }, [ancho, destino, pedido]);

  const medir = (event: LayoutChangeEvent) => setAncho(event.nativeEvent.layout.width);

  /*
    El indice sale del desplazamiento y no de un estado que el carrusel controle.

    Es la unica forma de que el indicador acierte cuando la slide la cambia el DEDO y no un boton:
    llevar un indice propio obliga a sincronizarlo con el gesto, y esa sincronizacion se desfasa en
    cuanto el usuario suelta a medio camino y el `pagingEnabled` completa la animacion.
  */
  const alDesplazar = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (ancho <= 0) return;
    const actual = Math.round(event.nativeEvent.contentOffset.x / ancho);
    if (actual !== indice) setIndice(Math.max(0, Math.min(slides.length - 1, actual)));
  };

  const irA = (destino: number) => {
    const seguro = Math.max(0, Math.min(slides.length - 1, destino));
    scroll.current?.scrollTo({ x: seguro * ancho, animated: true });
    setIndice(seguro);
  };

  const activa = slides[indice];

  return (
    <View style={styles.contenedor} onLayout={medir} testID="carrusel-de-capturas">
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={alDesplazar}
        scrollEventThrottle={16}
        // El carrusel vive dentro del scroll vertical de la pantalla. Sin esto, en Android el gesto
        // horizontal se lo queda el padre y las slides no se pasan.
        nestedScrollEnabled
        accessibilityRole="adjustable"
      >
        {slides.map((slide) => (
          <View
            key={slide.key}
            style={[styles.slide, { width: ancho || undefined }]}
            accessible
            accessibilityLabel={`${slide.title}. ${slide.done ? 'Capturada' : 'Pendiente'}. ${slide.hint}`}
          >
            <View style={styles.ventana}>
              {slide.uri ? (
                <Image
                  source={{ uri: slide.uri }}
                  style={styles.foto}
                  resizeMode="contain"
                  accessibilityLabel={`Vista previa de ${slide.title}`}
                />
              ) : (
                <View style={styles.vacia}>
                  <AtlasText variant="caption" tone="tertiary">
                    Todavia no tomaste esta foto
                  </AtlasText>
                </View>
              )}
              <View style={styles.etiqueta}>
                <Badge dot label={slide.done ? 'listo' : 'pendiente'} tone={slide.done ? 'success' : 'warning'} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/*
        El pie va FUERA del carrusel y describe la slide activa.

        Dentro de cada slide obligaria a que las tres tuvieran la misma altura de texto para que el
        bloque no saltara al pasar, y el pie de una captura hecha tiene una linea mas que el de una
        pendiente. Fuera, el texto cambia y nada se mueve.
      */}
      {activa ? (
        <View style={styles.pie}>
          <View style={styles.pieTexto}>
            <AtlasText variant="title">{activa.title}</AtlasText>
            <AtlasText variant="caption" tone="secondary">
              {activa.hint}
            </AtlasText>
            {activa.meta ? (
              <AtlasText variant="caption" tone="tertiary" numberOfLines={1}>
                {activa.meta}
              </AtlasText>
            ) : null}
          </View>
          <Button label={activa.actionLabel} variant="secondary" onPress={activa.onPress} disabled={ocupado} />
        </View>
      ) : null}

      <View style={styles.indicador}>
        <View style={styles.puntos}>
          {slides.map((slide, posicion) => (
            <View
              key={slide.key}
              style={[styles.punto, posicion === indice ? styles.puntoActivo : null]}
              // Decorativo: lo que anuncia la posicion es el texto de al lado.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ))}
        </View>
        {/*
          El contador va en cifras TABULARES, como cualquier otro numero que cambia delante del
          usuario en esta app —la cuenta atras del codigo, los dias del calendario, los importes—.
          Es lo unico que se mueve al pasar de captura y esta pegado al borde derecho: con cifras
          proporcionales, «1 de 3» y «3 de 3» no miden lo mismo y el texto se desplaza un pixel en
          cada gesto, justo al lado de unos puntos que sí se quedan quietos.
        */}
        <AtlasText variant="amountMicro" tone="tertiary">
          {indice + 1} de {slides.length}
        </AtlasText>
      </View>

      {/*
        Los dos botones de paso existen para quien no puede hacer el gesto: un lector de pantalla no
        «desliza», y un carrusel sin controles alternativos es contenido inalcanzable. Se ocultan
        cuando no hay a donde ir, en vez de quedarse deshabilitados ocupando sitio.
      */}
      <View style={styles.pasos}>
        {indice > 0 ? (
          <Button label="Anterior" variant="ghost" haptic="none" onPress={() => irA(indice - 1)} />
        ) : null}
        {indice < slides.length - 1 ? (
          <Button label="Siguiente" variant="ghost" haptic="none" onPress={() => irA(indice + 1)} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: space.md },
  slide: { paddingRight: 0 },
  ventana: {
    height: ALTO_VENTANA,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: color.surface.sunken,
    borderWidth: 1,
    borderColor: color.border.subtle,
  },
  foto: { width: '100%', height: '100%' },
  vacia: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  etiqueta: { position: 'absolute', top: space.sm, right: space.sm },
  pie: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pieTexto: { flex: 1, gap: space.xxs },
  indicador: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  puntos: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  punto: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.border.strong,
  },
  puntoActivo: { width: 18, backgroundColor: color.action.primary },
  pasos: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
});
