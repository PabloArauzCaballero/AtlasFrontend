/**
 * El botón flotante de Atlas Assist: la puerta al asistente, en el lateral derecho.
 *
 * ## Dónde está y dónde NO está
 *
 * Vive en el área autenticada entera, montado UNA vez en su layout, y se quita de en medio cuando
 * estorbaría: en el chat humano de soporte (taparía la conversación que es su propio escalado),
 * durante el recorrido guiado (el foco del tour es sagrado), con el teclado abierto (flotaría
 * encima de lo que se escribe) y en los modales de pago (nada compite con confirmar un pago).
 *
 * ## Por qué desaparece entero cuando el backend dice 404
 *
 * `ASSIST_ENABLED` apagada significa «este despliegue no tiene asistente»: un botón que abre una
 * hoja rota es peor que ningún botón. La sonda es la misma llamada que rehidrata el hilo.
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AssistScreen } from '../api/endpoints/assist';
import { useAssist } from '../features/assist';
import { color, shadow, space } from '../theme/tokens';
import { AssistSheet } from './assist-sheet';
import { Icon } from './icons';
import { PressSurface } from './motion';
import { useTour } from './tour';
import { useTramo } from './responsive';
import { webData } from '../web/estilo';

/**
 * El alto de la barra de pestañas, sin el área segura. Es el `BAR_HEIGHT` de
 * `app/(app)/(tabs)/_layout.tsx`; se repite aquí porque un archivo de ruta de expo-router no debe
 * exportar constantes, y este número es parte del contrato visual de la barra (72 = icono + rótulo).
 */
const ALTO_BARRA = 72;

/** Diámetro del botón: por encima del mínimo táctil (48) porque es un objeto flotante, no un ⓘ. */
const DIAMETRO = 56;

/**
 * Las rutas que SÍ llevan la barra de pestañas debajo. Sólo ahí el botón se levanta por encima de
 * ella; en cualquier otra (Privacidad, Crédito, un caso de soporte…) no hay barra y subirlo 72 px lo
 * dejaba flotando a media pantalla, «muy arriba» (visto en el iPhone, 2026-10-02).
 */
const CON_BARRA = [/^\/?$/, /^\/index$/, /^\/escanear(\/|$)/, /^\/pagos(\/|$)/, /^\/avisos(\/|$)/, /^\/perfil(\/|$)/];

/** Las pantallas donde el botón estorbaría más de lo que ayuda. */
const OCULTO_EN = [/^\/soporte(\/|$)/, /^\/compra\/monto$/, /^\/pago\//, /^\/pagar\//];

/** Desde qué pantalla escribe la persona: es lo que hace que «aquí» signifique algo. */
function pantallaDe(pathname: string): AssistScreen {
  if (pathname === '/' || pathname === '/index') return 'inicio';
  if (pathname.startsWith('/escanear')) return 'escanear';
  if (pathname.startsWith('/pagos')) return 'pagos';
  if (pathname.startsWith('/avisos')) return 'avisos';
  if (pathname.startsWith('/perfil')) return 'perfil';
  return 'otra';
}

/** Si hay un teclado en pantalla. En web no aplica: el teclado no tapa nada. */
function useTecladoVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // En iOS «will» llega antes de que el teclado suba: el botón se quita ANTES de que lo tape.
    const aparece = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const desaparece = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      aparece.remove();
      desaparece.remove();
    };
  }, []);
  return visible;
}

export function AssistFab() {
  const assist = useAssist();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const tramo = useTramo();
  const { activo: tourActivo } = useTour();
  const teclado = useTecladoVisible();
  const [abierta, setAbierta] = useState(false);
  const fabRef = useRef<View>(null);

  const cerrar = () => {
    setAbierta(false);
    /*
      En web, al cerrar con Escape o con «Cerrar», el foco tiene que VOLVER al botón que abrió la
      hoja: sin esto queda en el body y quien navega con teclado empieza otra vez desde arriba.
    */
    if (Platform.OS === 'web') {
      requestAnimationFrame(() => (fabRef.current as unknown as { focus?: () => void } | null)?.focus?.());
    }
  };

  // Sin asistente en este despliegue no hay botón; mientras se sondea, tampoco (evita el parpadeo).
  // Con la hoja ABIERTA no se corta nunca: devolver `null` aquí desmontaba también la hoja, y el chat
  // se cerraba solo en cuanto la persona tocaba el campo para escribir (aparece el teclado).
  if (!abierta) {
    if (assist.disponible !== true) return null;
    if (OCULTO_EN.some((regla) => regla.test(pathname))) return null;
  }
  // El teclado y el tour sólo esconden el BOTÓN, no la conversación.
  const botonOculto = tourActivo || teclado;

  /*
    La posición. En el teléfono, por ENCIMA de la barra de pestañas (72 + área segura + aire); en
    la web ancha la barra no existe —la cáscara de la landing pone la navegación arriba— y la hoja
    de estilo web lo fija a la ventana en 24/24 (`[data-atlas="asistente-fab"]`). En una tableta
    nativa de escritorio la barra es un carril lateral: abajo sólo queda el área segura.
  */
  const conCascara = Platform.OS === 'web' && tramo !== 'telefono';
  const carrilLateral = tramo === 'escritorio' && !conCascara;
  const conBarra = CON_BARRA.some((regla) => regla.test(pathname));
  const bottom = carrilLateral
    ? insets.bottom + space.xl
    : conBarra
      ? ALTO_BARRA + insets.bottom + space.sm
      : insets.bottom + space.lg;

  return (
    <>
      {botonOculto ? null : (
      <PressSurface
        ref={fabRef}
        onPress={() => setAbierta(true)}
        accessibilityRole="button"
        accessibilityLabel="Abrir asistente de ayuda"
        accessibilityHint="Abre un chat que contesta dudas sobre cómo usar la app"
        style={[styles.fab, { bottom, right: space.md }]}
        testID="asistente-fab"
        {...webData('asistente-fab')}
      >
        <Icon name="asistente" size={26} tint={color.text.onBrand} />
      </PressSurface>
      )}
      <AssistSheet visible={abierta} onClose={cerrar} pantalla={pantallaDe(pathname)} assist={assist} />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: DIAMETRO,
    height: DIAMETRO,
    borderRadius: DIAMETRO / 2,
    backgroundColor: color.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.brandGlow,
    // Por encima del contenido de la pantalla; por debajo de cualquier Modal (velo del tour, hojas).
    zIndex: 40,
    elevation: 6,
  },
});
