/**
 * El encuadre de una captura: la mira de cuatro esquinas sobre el visor.
 *
 * ## Por que esquinas y no un marco
 *
 * Un marco cerrado alrededor de la imagen tapa justo la franja donde suele caer el borde de lo que
 * se esta fotografiando —el filo del carnet, el borde del QR— y el ojo lo lee como el contorno del
 * visor, es decir, como parte del aparato, en lugar de como la zona donde hay que encuadrar. Las
 * esquinas dicen lo mismo y dejan el centro limpio; ademas es como lo dice cualquier lector de
 * codigos o escaner de documentos que la persona ya haya usado.
 *
 * ## Por que vive aqui
 *
 * Porque la app apunta la camara a dos cosas —el QR del comercio y el carnet— y estaban resueltas
 * de dos maneras distintas: un borde de 2 px en una pantalla y nada en la otra. Dos superficies de
 * captura que no se parecen se leen como dos apps.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { color, radius, space } from '../theme/tokens';

const CORNER = 34;
const CORNER_WIDTH = 3;

export function CameraFrame({
  children,
  ratio,
  mira,
  style,
}: {
  children: React.ReactNode;
  /**
   * La proporcion del visor. `1` para un QR —que es cuadrado y se encuadra centrado— y `undefined`
   * para que llene el hueco que le den, que es lo que necesita la captura del carnet a pantalla
   * completa.
   */
  ratio?: number;
  /**
   * La proporcion de la MIRA (ancho / alto), cuando no es la del visor.
   *
   * El carnet es apaisado (ID-1, 1,586) y el visor a pantalla completa es vertical: con la mira
   * pegada al visor, las esquinas pedian un rectangulo de pie y el carnet acababa ocupando una
   * franja pequeña de la foto. Con `mira`, el VISOR sigue llenando el hueco —la camara no cambia de
   * tamaño— y solo las esquinas adoptan la forma del documento, centradas y tan anchas como caben.
   * Sin `mira`, lo de siempre: las esquinas a un 12 % del borde del visor (el QR, la selfie).
   */
  mira?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.frame, ratio ? { aspectRatio: ratio } : styles.fill, style]}>
      {children}
      {mira ? (
        <View style={styles.centrado} pointerEvents="none">
          <View style={[styles.miraConForma, { aspectRatio: mira }]} testID="mira-con-forma">
            <Esquinas />
          </View>
        </View>
      ) : (
        <View style={styles.reticle} pointerEvents="none">
          <Esquinas />
        </View>
      )}
    </View>
  );
}

function Esquinas() {
  return (
    <>
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
    backgroundColor: color.surface.secondary,
  },
  fill: { flex: 1 },
  // El margen en porcentaje y no en pixeles: la mira tiene que guardar la misma proporcion con el
  // visor tanto en un telefono estrecho como en una tableta.
  reticle: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, margin: '12%' },
  // La mira con forma propia: centrada, al 88 % del ancho del visor (cuanto mas ancha, mas grande sale
  // el carnet en la foto) y sin pasar del 76 % del alto, por si el visor es bajo y ancho.
  centrado: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  miraConForma: { width: '88%', maxHeight: '76%' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: color.action.primary },
  topLeft: { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderTopLeftRadius: radius.lg },
  topRight: { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderTopRightRadius: radius.lg },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: radius.lg,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: radius.lg,
  },
});

export const CAMERA_FRAME_GAP = space.base;
