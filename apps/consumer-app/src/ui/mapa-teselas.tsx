/**
 * Un mapa de teselas hecho aquí, para los teléfonos donde el mapa nativo no se dibuja.
 *
 * ## Por qué existe
 *
 * `expo-maps` pinta el mapa de Apple con SwiftUI `Map`, que sólo existe desde **iOS 17**. En un
 * iPhone con iOS 16 —todos los que Apple dejó en esa versión: iPhone 8, 8 Plus, X— su vista nativa
 * se queda sin nada dentro y se ve un rectángulo negro (Pablo, 2026-10-08: «al abrir el mapa sale
 * negro en algunos celulares»). No hay error ni aviso: el alta pedía señalar la casa en un mapa que
 * no estaba.
 *
 * Este mapa es JavaScript puro —imágenes y un gesto de arrastre—, así que funciona en cualquier
 * versión y llega por actualización OTA, sin build nuevo. Hace lo que el alta necesita: arrastrar
 * hasta que el pin del centro quede sobre la casa, acercarse, y cambiar a satélite para ver el tejado.
 *
 * Las cuentas (Mercator, qué teselas tocan) están en `features/teselas.ts`, con sus pruebas.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import {
  ATRIBUCION,
  aMundo,
  deMundo,
  teselasVisibles,
  urlDeTesela,
  ZOOM_MAX,
  ZOOM_MIN,
  type Coordenada,
  type Estilo,
} from '../features/teselas';
import { alpha, color, luz, radius, space } from '../theme/tokens';
import { AtlasText } from './primitives';

/** Menos de esto entre que el dedo baja y sube es un toque, no un arrastre. */
const UMBRAL_TOQUE_PX = 6;

export function MapaTeselas({
  camara,
  zoomInicial = 17,
  marcadores = [],
  onCentro,
}: {
  /** A dónde lleva la cámara quien usa el mapa: al abrir, o al tocar un sitio frecuente. */
  camara: Coordenada;
  zoomInicial?: number;
  marcadores?: readonly Coordenada[];
  /** El punto bajo el pin del centro, cada vez que el mapa se queda quieto. */
  onCentro: (punto: Coordenada) => void;
}) {
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  const [centro, setCentro] = useState<Coordenada>(camara);
  const [zoom, setZoom] = useState(zoomInicial);
  const [estilo, setEstilo] = useState<Estilo>('calles');
  const arrastre = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pendienteDeSoltar = useRef(false);

  // La cámara la mueve quien usa el mapa (abrir, tocar un sitio): se obedece y se avisa del punto.
  useEffect(() => {
    setCentro(camara);
  }, [camara.lat, camara.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
    Al soltar, el centro nuevo y el desplazamiento a cero tienen que llegar en el MISMO fotograma: si
    el arrastre vuelve a cero antes de que las teselas se recoloquen, el mapa da un salto atrás y
    vuelve. Se pone a cero aquí, en el `useLayoutEffect` del render que ya trae el centro nuevo.
  */
  useLayoutEffect(() => {
    if (!pendienteDeSoltar.current) return;
    pendienteDeSoltar.current = false;
    arrastre.setValue({ x: 0, y: 0 });
  }, [centro, arrastre]);

  const estado = useRef({ centro, zoom, tamano, onCentro });
  estado.current = { centro, zoom, tamano, onCentro };

  const moverA = (destino: Coordenada) => {
    pendienteDeSoltar.current = true;
    setCentro(destino);
    estado.current.onCentro(destino);
  };

  const gesto = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: Animated.event([null, { dx: arrastre.x, dy: arrastre.y }], { useNativeDriver: false }),
        onPanResponderRelease: (evento, { dx, dy }) => {
          const { centro: actual, zoom: z, tamano: t } = estado.current;
          const enMundo = aMundo(actual, z);
          if (Math.abs(dx) < UMBRAL_TOQUE_PX && Math.abs(dy) < UMBRAL_TOQUE_PX) {
            // Un toque lleva el centro al punto tocado, como en el mapa nativo.
            const { locationX, locationY } = evento.nativeEvent;
            moverA(deMundo({ x: enMundo.x + (locationX - t.ancho / 2), y: enMundo.y + (locationY - t.alto / 2) }, z));
            return;
          }
          moverA(deMundo({ x: enMundo.x - dx, y: enMundo.y - dy }, z));
        },
        onPanResponderTerminate: () => {
          arrastre.setValue({ x: 0, y: 0 });
        },
      }),
    // El gesto lee el estado por la referencia: crearlo una vez evita perder un arrastre a medias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const enMundo = aMundo(centro, zoom);
  const teselas = tamano.ancho > 0 ? teselasVisibles(enMundo, zoom, tamano.ancho, tamano.alto) : [];
  const acercar = (paso: number) => setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + paso)));

  return (
    <View
      style={[StyleSheet.absoluteFill, estilo === 'satelite' ? styles.fondoSatelite : styles.fondoCalles]}
      onLayout={(e) => setTamano({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })}
      testID="mapa-teselas"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: arrastre.getTranslateTransform() }]}
        {...gesto.panHandlers}
      >
        {teselas.map((t) => (
          <Image
            key={`${estilo}-${t.clave}`}
            source={{ uri: urlDeTesela(estilo, t) }}
            style={[styles.tesela, { left: t.izquierda, top: t.arriba }]}
            fadeDuration={150}
          />
        ))}
        {marcadores.map((m, i) => {
          const p = aMundo(m, zoom);
          return (
            <View
              key={`m-${i}`}
              pointerEvents="none"
              style={[styles.marcador, { left: p.x - enMundo.x + tamano.ancho / 2 - 7, top: p.y - enMundo.y + tamano.alto / 2 - 7 }]}
            />
          );
        })}
      </Animated.View>

      <View style={styles.controles} pointerEvents="box-none">
        <BotonMapa etiqueta="+" accesible="Acercar el mapa" onPress={() => acercar(1)} />
        <BotonMapa etiqueta="−" accesible="Alejar el mapa" onPress={() => acercar(-1)} />
        <BotonMapa
          etiqueta={estilo === 'calles' ? 'Satélite' : 'Mapa'}
          accesible={estilo === 'calles' ? 'Ver el mapa en satélite' : 'Ver el mapa de calles'}
          onPress={() => setEstilo((e) => (e === 'calles' ? 'satelite' : 'calles'))}
          ancho
        />
      </View>
      <View style={styles.atribucion} pointerEvents="none">
        <AtlasText variant="micro" style={styles.atribucionTexto}>
          {ATRIBUCION[estilo]}
        </AtlasText>
      </View>
    </View>
  );
}

function BotonMapa({ etiqueta, accesible, onPress, ancho }: { etiqueta: string; accesible: string; onPress: () => void; ancho?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accesible}
      hitSlop={6}
      style={({ pressed }) => [styles.boton, ancho ? styles.botonAncho : null, pressed ? styles.botonPulsado : null]}
    >
      <AtlasText variant={ancho ? 'caption' : 'h3'} style={styles.botonTexto}>
        {etiqueta}
      </AtlasText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fondoCalles: { backgroundColor: color.map.streets, overflow: 'hidden' },
  fondoSatelite: { backgroundColor: color.map.satellite, overflow: 'hidden' },
  tesela: { position: 'absolute', width: 256, height: 256 },
  marcador: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: alpha(color.map.point, 0.35),
    borderWidth: 2,
    borderColor: color.map.point,
  },
  controles: { position: 'absolute', right: space.md, top: space.md, gap: space.sm, alignItems: 'flex-end' },
  boton: {
    minWidth: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.map.chip,
    borderWidth: 1,
    // Filo de luz sobre la ficha oscura: `border.subtle` es oscuro en el tema claro y ahi no se veria.
    borderColor: alpha(luz.blanco, 0.09),
  },
  botonAncho: { paddingHorizontal: space.md },
  botonPulsado: { opacity: 0.7 },
  botonTexto: { color: color.text.onDark },
  atribucion: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: color.map.attribution,
  },
  atribucionTexto: { color: color.map.attributionInk, fontSize: 10 },
});
