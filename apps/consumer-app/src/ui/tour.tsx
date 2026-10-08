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
import { BackHandler, StyleSheet, View, useWindowDimensions, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, spring } from '../theme/tokens';
import { DesplazamientoContext, type Desplazar } from './desplazamiento';
import { ANCHO_COLUMNA } from './responsive';
import { Icon } from './icons';
import { Appear } from './motion';
import { AtlasText, Button, Card, IconChip, Overline } from './primitives';

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
  register: (id: string, objetivo: Objetivo | null) => void;
  start: (steps: TourStep[], persistKey?: string) => void;
  /** Si hay un recorrido en pantalla. Lo consultan las capas flotantes que no deben taparlo. */
  activo: boolean;
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

/** Lo que registra cada objetivo: su vista (para medirla en el momento) y cómo mover su pantalla. */
type Objetivo = { vista: React.RefObject<View | null>; desplazar: Desplazar | null };

/** Cuánto se espera a que aparezca un objetivo que aún no se montó (navegación, datos que llegan). */
const ESPERA_OBJETIVO_MS = 2500;
/** Lo que tarda un `scrollTo` animado en asentarse antes de volver a medir. */
const ASIENTO_DESPLAZAMIENTO_MS = 420;
/** Alto reservado para la tarjeta del paso al decidir si cabe encima o debajo del objetivo. */
const ALTO_TARJETA = 260;

function medir(vista: View | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!vista || typeof vista.measureInWindow !== 'function') return resolve(null);
    // Con plazo: una vista que se desmonta a medio medir no llama nunca de vuelta, y el paso se quedaría
    // esperando con el velo puesto.
    const plazo = setTimeout(() => resolve(null), 300);
    vista.measureInWindow((x, y, width, height) => {
      clearTimeout(plazo);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
  ## Por qué el recorrido se rehízo (2026-10-06)

  En el teléfono estaba «bugueadísimo» y la primera vez llegaba a dejar la app colgada. Tres causas:

  - **El `Modal` se rehacía con cada medida.** La capa llevaba `key={paso-measureTick}` y cualquier
    objetivo que se volviera a maquetar —la pantalla de inicio entra escalonada y carga datos— subía
    el contador: el `Modal` se desmontaba y se volvía a presentar varias veces por segundo, con su
    fundido. En iOS presentar y retirar un `Modal` en ráfaga, encima de otra hoja que se está yendo,
    deja la ventana bloqueada. Ahora NO hay `Modal`: la capa se pinta sobre la navegación, igual que
    el corte de marca, y no se rehace nunca entre pasos.
  - **La tarjeta podía quedar fuera de la ventana.** El tercer objetivo está bajo el pliegue; la
    tarjeta se colocaba relativa a él y caía por debajo del borde. Con el velo tapándolo todo y sin
    «Siguiente» ni «Saltar» a la vista, la app parecía colgada. Ahora el objetivo se trae a la vista
    desplazando su pantalla, y la tarjeta siempre se recorta dentro del área segura.
  - **Se medía a mitad de la animación de entrada.** `onLayout` llega antes de que `Appear` termine
    de subir el bloque, así que el recorte quedaba desplazado. Ahora se mide al ACTIVAR cada paso.
*/
export function TourProvider({ children }: { children: React.ReactNode }) {
  const objetivos = React.useRef(new Map<string, Objetivo>());
  const [steps, setSteps] = React.useState<TourStep[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [persistKey, setPersistKey] = React.useState<string | null>(null);
  /** La medida del paso activo; `undefined` mientras se busca el objetivo. */
  const [rect, setRect] = React.useState<Rect | null | undefined>(undefined);
  const { height: altoVentana } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const register = React.useCallback((id: string, objetivo: Objetivo | null) => {
    if (objetivo) objetivos.current.set(id, objetivo);
    else objetivos.current.delete(id);
  }, []);

  const start = React.useCallback((next: TourStep[], key?: string) => {
    // Un recorrido sin pasos no se abre: dejaría el velo sin tarjeta y sin forma de salir.
    if (next.length === 0) return;
    setSteps(next);
    setIndex(0);
    setRect(undefined);
    setPersistKey(key ?? null);
  }, []);

  const close = React.useCallback(() => {
    // Se marca como visto tanto al terminarlo como al saltarlo: quien lo salta ya decidio que no lo
    // quiere, y volver a lanzarselo en cada arranque es ignorar esa decision. Se cierra YA y se
    // guarda después: esperar al almacenamiento dejaba el velo puesto si el disco tardaba.
    if (persistKey) void AsyncStorage.setItem(`${SEEN_PREFIX}${persistKey}`, '1').catch(() => undefined);
    setSteps(null);
    setIndex(0);
    setRect(undefined);
    setPersistKey(null);
  }, [persistKey]);

  const step = steps?.[index] ?? null;

  // Al activar un paso: esperar a su objetivo, traerlo a la vista si está fuera y medirlo ya quieto.
  React.useEffect(() => {
    if (!step) return;
    let vivo = true;
    void (async () => {
      const limite = Date.now() + ESPERA_OBJETIVO_MS;
      let medida: Rect | null = null;
      while (vivo && Date.now() < limite) {
        const objetivo = objetivos.current.get(step.target);
        medida = await medir(objetivo?.vista.current ?? null);
        if (medida) {
          const arriba = insets.top + space.base;
          // Debajo cabe la barra de pestañas; lo que quede tapado por ella no cuenta como visible.
          const abajo = altoVentana - insets.bottom - 96;
          const fuera = medida.y < arriba || medida.y + Math.min(medida.height, abajo - arriba) > abajo;
          if (fuera && objetivo?.desplazar) {
            // Se deja el objetivo a un cuarto de la ventana: queda sitio debajo para la tarjeta.
            objetivo.desplazar(medida.y - (arriba + (abajo - arriba) * 0.25));
            await esperar(ASIENTO_DESPLAZAMIENTO_MS);
            medida = await medir(objetivo.vista.current);
          } else {
            // Un respiro para que termine la entrada escalonada antes de la medida definitiva.
            await esperar(120);
            medida = (await medir(objetivo?.vista.current ?? null)) ?? medida;
          }
          break;
        }
        await esperar(150);
      }
      // Si el objetivo no apareció, el paso se explica igual, con la tarjeta al centro.
      if (vivo) setRect(medida);
    })();
    return () => {
      vivo = false;
    };
  }, [step, altoVentana, insets.top, insets.bottom]);

  // El botón «atrás» de Android cierra el recorrido, como cerraba el `Modal`.
  React.useEffect(() => {
    if (!step) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [step, close]);

  const value = React.useMemo<TourContextValue>(() => ({ register, start, activo: steps !== null }), [register, start, steps]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {step ? (
        <TourOverlay
          step={step}
          rect={rect}
          index={index}
          total={steps!.length}
          onNext={() => {
            if (index + 1 < steps!.length) {
              setRect(undefined);
              setIndex(index + 1);
            } else close();
          }}
          onSkip={close}
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
 * Registra la VISTA, no una medida: la medida se toma cuando el paso se activa, que es el único
 * momento en que importa dónde está. Medir en `onLayout` daba la posición a mitad de la animación
 * de entrada y se quedaba vieja en cuanto la pantalla se desplazaba.
 */
export function TourTarget({ id, children }: { id: string; children: React.ReactNode }) {
  const { register } = useTour();
  const desplazar = React.useContext(DesplazamientoContext);
  const ref = React.useRef<View>(null);

  React.useEffect(() => {
    register(id, { vista: ref, desplazar });
    return () => register(id, null);
  }, [id, register, desplazar]);

  return (
    <View ref={ref} collapsable={false}>
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
  /** `undefined` mientras se busca el objetivo; `null` si no apareció (tarjeta al centro). */
  rect: Rect | null | undefined;
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
    // Memorizado por sus numeros: un objeto nuevo con el mismo destino relanzaria el muelle y lo
    // cortaria a medio camino. La excepcion a la regla es intencionada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rect?.x, rect?.y, rect?.width, rect?.height, screenWidth],
  );

  const foco = useFocoAnimado(focus);

  /*
    Dónde va la tarjeta: debajo del objetivo si cabe, encima si no, y si tampoco —un objetivo alto en
    una pantalla corta— pegada al pie. NUNCA fuera del área segura: una tarjeta caída por debajo del
    borde deja el velo puesto sin «Siguiente» ni «Saltar», y eso es una app colgada.
  */
  const techo = insets.top + space.base;
  const suelo = screenHeight - insets.bottom - space.base;
  /*
    El alto REAL de la tarjeta, medido. Con un alto supuesto (260) en un iPhone de 4,7" —donde el título
    y el texto ocupan más renglones— la tarjeta medía más de lo previsto, se colocaba «debajo» y su pie
    caía fuera de la pantalla: sin «Siguiente» ni «Saltar», el recorrido parecía colgado (Pablo, 2026-10-08:
    «en algunos iOS, en especial los antiguos, se buguea el tutorial»).
  */
  const [altoTarjeta, setAltoTarjeta] = React.useState(ALTO_TARJETA);
  const top = (() => {
    const alto = Math.min(altoTarjeta, suelo - techo);
    if (!focus) return Math.max(techo, screenHeight / 2 - alto / 2);
    const debajo = focus.y + focus.height + space.base;
    if (debajo + alto <= suelo) return debajo;
    const encima = focus.y - space.base - alto;
    if (encima >= techo) return encima;
    // No cabe ni encima ni debajo: pegada al pie, siempre entera dentro del área segura.
    return Math.max(techo, suelo - alto);
  })();
  /*
    El ancho NO es el del objetivo. Antes la tarjeta copiaba el ancho del elemento señalado, y con un
    objetivo estrecho —una pestaña, un botón— quedaba una columna de 70 px con una palabra por renglón,
    altísima, que se salía por abajo. Ahora mide la columna de lectura y se centra sobre el foco sin
    salirse de la pantalla.
  */
  const anchoTarjeta = Math.min(screenWidth - space.lg * 2, ANCHO_COLUMNA - space.lg * 2);
  const left = focus
    ? Math.max(space.lg, Math.min(screenWidth - space.lg - anchoTarjeta, focus.x + focus.width / 2 - anchoTarjeta / 2))
    : (screenWidth - anchoTarjeta) / 2;

  const buscando = rect === undefined;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.capa]}
      accessibilityViewIsModal
      accessibilityLabel={`Paso ${index + 1} de ${total}: ${step.title}`}
    >
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
        `key` por paso: la tarjeta se rehace, no se reescribe, y `Appear` vuelve a correr para que el
        texto nuevo entre como lo que es: otra explicacion. Mientras se busca el objetivo no hay
        tarjeta; sólo el velo, una fracción de segundo.
      */}
      {buscando ? null : (
        <Appear key={index} style={{ ...styles.cardHolder, top, left, width: anchoTarjeta }}>
          <View onLayout={(e) => setAltoTarjeta(Math.ceil(e.nativeEvent.layout.height))}>
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                {step.icon ? <IconChip name={step.icon} size="sm" /> : null}
                {/* Las versalitas las pone `Overline`, no un literal en mayusculas: ver `primitives.tsx`. */}
                <Overline tone="brand">{`Paso ${index + 1} de ${total}`}</Overline>
              </View>
              <AtlasText variant="h2">{step.title}</AtlasText>
              <AtlasText variant="body" tone="secondary">
                {step.body}
              </AtlasText>
              <View style={styles.cardActions}>
                <Button label="Saltar" variant="ghost" onPress={onSkip} style={styles.action} haptic="none" testID="tour-saltar" />
                <Button
                  label={index + 1 === total ? 'Entendido' : 'Siguiente'}
                  onPress={onNext}
                  style={styles.action}
                  testID="tour-siguiente"
                />
              </View>
            </Card>
          </View>
        </Appear>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sobre toda la navegación —barra de pestañas incluida— y por encima del botón de Assist.
  capa: { zIndex: 1000, elevation: 1000 },
  scrim: { position: 'absolute', backgroundColor: color.overlay.scrim },
  ring: {
    position: 'absolute',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.action.primary,
  },
  /*
    La tarjeta del paso no se estira con la ventana: en escritorio una tarjeta de 1.400 px de ancho
    con dos frases dentro deja de leerse como una nota y se lee como una franja. Se centra y se
    limita a la columna de lectura, que es lo que senala.
  */
  cardHolder: { position: 'absolute' },
  card: { backgroundColor: color.surface.sheet, width: '100%' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardActions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  action: { flex: 1 },
});
