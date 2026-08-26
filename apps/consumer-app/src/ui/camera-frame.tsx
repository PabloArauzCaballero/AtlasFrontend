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
  style,
}: {
  children: React.ReactNode;
  /**
   * La proporcion del visor. `1` para un QR —que es cuadrado y se encuadra centrado— y `undefined`
   * para que llene el hueco que le den, que es lo que necesita la captura del carnet a pantalla
   * completa.
   */
  ratio?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.frame, ratio ? { aspectRatio: ratio } : styles.fill, style]}>
      {children}
      <View style={styles.reticle} pointerEvents="none">
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>
    </View>
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
