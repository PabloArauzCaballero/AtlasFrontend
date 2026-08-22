/**
 * Motor de tutoriales guiados.
 *
 * ## Que resuelve
 *
 * Hay cosas de ATLAS que no se deducen mirando la pantalla: que el dinero va directo al comercio,
 * que Atlas nunca lo toca, que el correo se guarda por su dominio y el telefono por sus cuatro
 * ultimas cifras. Un cliente puede usar la app entera sin enterarse, y esas son justo las que
 * responden «¿esto es seguro?».
 *
 * El recorrido las senala **sobre la pantalla real**, no en una serie de laminas de bienvenida que
 * se pasan sin leer y que nunca vuelven a estar disponibles.
 *
 * ## Reglas que se aplican aqui una vez
 *
 * - **Se ve una vez y se puede repetir.** Se recuerda por clave en almacenamiento local; el usuario
 *   puede volver a lanzarlo desde la pantalla. Un tutorial que solo existe el primer dia no sirve a
 *   quien lo necesita al tercero.
 * - **Se sale en cualquier momento.** «Saltar» siempre visible. Un tutorial del que no se puede
 *   salir es un secuestro, no una ayuda.
 * - **Nunca bloquea una tarea.** No se lanza solo si hay algo que atender; ver `shouldAutoStart`.
 * - **El foco recorta de verdad.** El resaltado se dibuja con cuatro paneles alrededor del objetivo
 *   en vez de con un rectangulo translucido encima: asi el elemento senalado se ve a su color real y
 *   no atenuado, que es la diferencia entre «mira esto» y «esto esta deshabilitado».
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Modal, StyleSheet, View, useWindowDimensions, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, spring } from '../theme/tokens';
import { Icon } from './icons';
import { Appear } from './motion';
import { AtlasText, Button, Card } from './primitives';

export type TourStep = {
  /** Identificador del objetivo. Debe coincidir con el `id` de un `<TourTarget>` montado. */
  target: string;
  title: string;
  body: string;
  /** Icono que encabeza el paso. Refuerza el tema sin repetir el titulo. */
  icon?: React.ComponentProps<typeof Icon>['name'];
};

type Rect = LayoutRectangle;

type TourContextValue = {
  register: (id: string, rect: Rect | null) => void;
  start: (steps: TourStep[], persistKey?: string) => void;
};

const TourContext = React.createContext<TourContextValue | null>(null);

const SEEN_PREFIX = 'atlas.tour.seen.';

/** Margen entre el recorte y el elemento resaltado. Sin el, el foco parece un error de alineacion. */
const HALO = 8;

type Foco = { x: number; y: number; width: number; height: number };

/**
 * El foco VIAJA de un paso al siguiente; no reaparece en otro sitio.
 *
 * Es la diferencia entre un recorrido guiado y una serie de laminas. Cuando el recorte salta, cada
 * paso obliga a buscar otra vez donde esta ahora el hueco —y la app entera cambia de aspecto en un
 * fotograma, porque lo que se mueve es el 90 % de la pantalla oscurecida—. Cuando se desplaza, el
 * ojo lo sigue sin decidir nada y llega al elemento nuevo ya mirandolo.
 *
 * Va con `spring.glide` —el muelle mas conducido de los tres— y no con una curva, porque es un
 * recorrido largo y de distancia variable: entre dos pestanas vecinas viaja unos pixeles y entre la
 * cabecera y la barra inferior cruza la pantalla. Un muelle reparte la energia segun la distancia;
 * una duracion fija hace que el trayecto corto parezca lento y el largo, disparado.
 *
 * **La primera colocacion no se anima.** Ahi no hay «de donde»: el foco no venia de ningun sitio, y
 * arrancarlo desde la esquina seria inventar un recorrido que no ocurrio.
 */
function useFocoAnimado(foco: Foco | null) {
  const reduced = useReducedMotion();
  const x = useSharedValue(foco?.x ?? 0);
  const y = useSharedValue(foco?.y ?? 0);
  const ancho = useSharedValue(foco?.width ?? 0);
  const alto = useSharedValue(foco?.height ?? 0);
  const yaColocado = React.useRef(false);

  React.useEffect(() => {
    if (!foco) return;
    const instantaneo = !yaColocado.current || reduced;
    yaColocado.current = true;
    const llevar = (valor: { value: number }, destino: number) => {
      valor.value = instantaneo ? destino : withSpring(destino, spring.glide);
    };
    llevar(x, foco.x);
    llevar(y, foco.y);
    llevar(ancho, foco.width);
    llevar(alto, foco.height);
  }, [foco, reduced, x, y, ancho, alto]);

  /*
    Se animan `top`/`left`/`width`/`height` y no una transformacion.

    Un `scale` sobre el recorte deformaria el borde del anillo —2 px que pasarian a 3 en un paso y a
    1 en el siguiente— y, sobre todo, aqui no hay UN elemento que mover: el hueco lo forman cuatro
    paneles que tienen que seguir cerrando entre ellos en cada fotograma intermedio. Con
    transformaciones se abririan rendijas por las que se veria la pantalla sin oscurecer.
  */
  return {
    arriba: useAnimatedStyle(() => ({ top: 0, left: 0, right: 0, height: y.value })),
    abajo: useAnimatedStyle(() => ({ top: y.value + alto.value, left: 0, right: 0, bottom: 0 })),
    izquierda: useAnimatedStyle(() => ({ top: y.value, left: 0, width: x.value, height: alto.value })),
    derecha: useAnimatedStyle(() => ({ top: y.value, left: x.value + ancho.value, right: 0, height: alto.value })),
    anillo: useAnimatedStyle(() => ({ top: y.value, left: x.value, width: ancho.value, height: alto.value })),
  };
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const targets = React.useRef(new Map<string, Rect>());
  const [steps, setSteps] = React.useState<TourStep[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [persistKey, setPersistKey] = React.useState<string | null>(null);
  // Fuerza un re-render cuando llega la medida de un objetivo que todavia no se habia medido.
  const [measureTick, setMeasureTick] = React.useState(0);

  const register = React.useCallback((id: string, rect: Rect | null) => {
    if (rect) targets.current.set(id, rect);
    else targets.current.delete(id);
    setMeasureTick((tick) => tick + 1);
  }, []);

  const start = React.useCallback((next: TourStep[], key?: string) => {
    setSteps(next);
    setIndex(0);
    setPersistKey(key ?? null);
  }, []);

  const close = React.useCallback(async () => {
    // Se marca como visto tanto al terminarlo como al saltarlo: quien lo salta ya decidio que no lo
    // quiere, y volver a lanzarselo en cada arranque es ignorar esa decision.
    if (persistKey) await AsyncStorage.setItem(`${SEEN_PREFIX}${persistKey}`, '1').catch(() => undefined);
    setSteps(null);
    setIndex(0);
    setPersistKey(null);
  }, [persistKey]);

  const value = React.useMemo<TourContextValue>(() => ({ register, start }), [register, start]);

  const step = steps?.[index] ?? null;
  const rect = step ? (targets.current.get(step.target) ?? null) : null;

  return (
    <TourContext.Provider value={value}>
      {children}
      {step ? (
        <TourOverlay
          key={`${step.target}-${measureTick}`}
          step={step}
          rect={rect}
          index={index}
          total={steps!.length}
          onNext={() => (index + 1 < steps!.length ? setIndex(index + 1) : void close())}
          onSkip={() => void close()}
        />
      ) : null}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = React.useContext(TourContext);
  if (!context) throw new Error('useTour necesita estar dentro de <TourProvider>.');
  return context;
}

/**
 * Marca un elemento como objetivo de un paso del recorrido.
 *
 * Se mide con `onLayout` en coordenadas de ventana. Envolver es preferible a pedirle a cada pantalla
 * que exponga una `ref`: el objetivo se declara donde esta el elemento, y si se mueve al reordenar
 * la pantalla, la medida se mueve con el.
 */
export function TourTarget({ id, children }: { id: string; children: React.ReactNode }) {
  const { register } = useTour();
  const ref = React.useRef<View>(null);

  React.useEffect(() => () => register(id, null), [id, register]);

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => {
        // `measureInWindow` en vez de las coordenadas de `onLayout`: estas son relativas al padre, y
        // el recorte se dibuja sobre la ventana completa.
        ref.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) register(id, { x, y, width, height });
        });
      }}
    >
      {children}
    </View>
  );
}

/**
 * Decide si el recorrido debe lanzarse solo.
 *
 * Devuelve `false` si ya se vio. La pantalla anade sus propias condiciones: nunca se interrumpe a
 * alguien que entro a resolver algo.
 */
export async function shouldAutoStart(persistKey: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(`${SEEN_PREFIX}${persistKey}`)) === null;
  } catch {
    // Si el almacenamiento falla se prefiere NO lanzarlo. Un tutorial que reaparece cada vez molesta
    // mas que uno que no aparece.
    return false;
  }
}

/** Olvida que se vio, para poder repetirlo desde la pantalla. */
export async function resetTour(persistKey: string): Promise<void> {
  await AsyncStorage.removeItem(`${SEEN_PREFIX}${persistKey}`).catch(() => undefined);
}

/* ------------------------------------------------------------------ capa */

function TourOverlay({
  step,
  rect,
  index,
  total,
  onNext,
  onSkip,
}: {
  step: TourStep;
  rect: Rect | null;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const focus = React.useMemo(
    () =>
      rect
        ? {
            x: Math.max(0, rect.x - HALO),
            y: Math.max(0, rect.y - HALO),
            width: Math.min(screenWidth, rect.width + HALO * 2),
            height: rect.height + HALO * 2,
          }
        : null,
    // Memorizado por sus numeros: el objeto se recalcula en cada render —la medida de un objetivo
    // que llega tarde provoca uno— y sin esto el efecto que mueve el foco se relanzaria con el
    // mismo destino, cortando el muelle a medio camino y dejandolo lento.
    [rect?.x, rect?.y, rect?.width, rect?.height, screenWidth],
  );

  const foco = useFocoAnimado(focus);

  // La tarjeta va debajo del objetivo salvo que ahi no quepa, en cuyo caso va encima. Taparlo con la
  // propia explicacion es el fallo clasico de este patron.
  const below = focus ? focus.y + focus.height + space.base : screenHeight / 2;
  const fitsBelow = !focus || below + 260 < screenHeight - insets.bottom;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={styles.fill} accessibilityViewIsModal accessibilityLabel={`Paso ${index + 1} de ${total}: ${step.title}`}>
        {focus ? (
          <>
            {/* Cuatro paneles alrededor del hueco. El elemento senalado queda a su color real. */}
            <Animated.View style={[styles.scrim, foco.arriba]} />
            <Animated.View style={[styles.scrim, foco.abajo]} />
            <Animated.View style={[styles.scrim, foco.izquierda]} />
            <Animated.View style={[styles.scrim, foco.derecha]} />
            <Animated.View pointerEvents="none" style={[styles.ring, foco.anillo]} />
          </>
        ) : (
          <View style={[styles.scrim, StyleSheet.absoluteFill]} />
        )}

        {/*
          `key` por paso: la tarjeta se rehace, no se reescribe.

          Sin el, entre un paso y otro cambiaban el titulo y el cuerpo sobre la misma tarjeta y sin
          ningun movimiento, justo mientras el foco viajaba por debajo. Se leia como un fallo de
          pintado. Rehaciendola, `Appear` vuelve a correr y el texto nuevo entra como lo que es:
          otra explicacion.
        */}
        <Appear
          key={index}
          style={{
            ...styles.cardHolder,
            ...(fitsBelow ? { top: below } : { bottom: screenHeight - (focus?.y ?? screenHeight) + space.base }),
          }}
        >
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              {step.icon ? <Icon name={step.icon} size={20} tint={color.action.primary} /> : null}
              <AtlasText variant="micro" tone="brand">
                {`PASO ${index + 1} DE ${total}`}
              </AtlasText>
            </View>
            <AtlasText variant="h3">{step.title}</AtlasText>
            <AtlasText variant="body" tone="secondary">
              {step.body}
            </AtlasText>
            <View style={styles.cardActions}>
              <Button label="Saltar" variant="ghost" onPress={onSkip} style={styles.action} haptic="none" />
              <Button label={index + 1 === total ? 'Entendido' : 'Siguiente'} onPress={onNext} style={styles.action} />
            </View>
          </Card>
        </Appear>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { position: 'absolute', backgroundColor: color.overlay.scrim },
  ring: {
    position: 'absolute',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.action.primary,
  },
  cardHolder: { position: 'absolute', left: space.lg, right: space.lg },
  card: { backgroundColor: color.surface.sheet },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardActions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  action: { flex: 1 },
});
