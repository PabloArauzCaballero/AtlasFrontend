/**
 * La tarjeta de un pago que espera la palabra del comercio: un comprobante de CUOTA o un pago
 * INICIAL. Las dos colas de la pestaña «Comprobantes» se dibujan igual porque se deciden igual: mirar
 * el comprobante, buscar el dinero en la cuenta, confirmar o rechazar con motivo.
 *
 * Jerarquía (Pablo, 2026-10-10): el importe grande y el estado a la izquierda, la miniatura del
 * comprobante a la derecha, UNA línea con la referencia del banco · fecha · caja, y los dos botones
 * al pie en una fila.
 */
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import type { OpcionSelect } from '@cliente/ui/form-controls';
import { AtlasText, Badge, Card } from '@cliente/ui/primitives';
import { MiniaturaDeComprobante, useImagenDeComprobante } from './comprobante-imagen';
import { DecisionConMotivo } from './decision-con-motivo';
import { LineaSecundaria } from './piezas';

export interface DecisionDeTarjeta {
  rechazando: boolean;
  motivo: string;
  motivos: OpcionSelect[];
  ayuda: string;
  hint: string;
  ocupado: boolean;
  onAceptar: () => void;
  onEmpezarRechazo: () => void;
  onMotivo: (valor: string) => void;
  onConfirmarRechazo: () => void;
  onCancelar: () => void;
}

export function TarjetaDeComprobante({
  id,
  partnerId,
  importe,
  estado,
  linea,
  referencia,
  tieneImagen,
  cargarImagen,
  sinImagen,
  decision,
  testID,
}: {
  id: string;
  partnerId: string;
  importe: string;
  estado: string;
  linea: string;
  referencia: string;
  tieneImagen: boolean;
  cargarImagen: (partnerId: string, id: string) => Promise<string>;
  /** La frase de la web cuando el cliente no subió imagen («Búsquelo en su extracto/cuenta…»). */
  sinImagen: string;
  decision: DecisionDeTarjeta;
  testID: string;
}) {
  const { uri, fallo } = useImagenDeComprobante(partnerId, id, cargarImagen, tieneImagen);
  return (
    <Card testID={testID}>
      <View style={styles.cuerpo}>
        <View style={styles.fila}>
          <View style={styles.texto}>
            <AtlasText variant="h2" numberOfLines={1} adjustsFontSizeToFit>
              {importe}
            </AtlasText>
            <View style={styles.estado}>
              <Badge label={estado} tone="warning" dot />
            </View>
            <LineaSecundaria texto={linea} referencia={referencia} />
          </View>
          {tieneImagen ? <MiniaturaDeComprobante uri={uri} fallo={fallo} id={id} /> : null}
        </View>
        {!tieneImagen ? (
          <AtlasText variant="caption" tone="warning" testID={`${testID}-sin-imagen`}>
            {`Sin comprobante adjunto. ${sinImagen}`}
          </AtlasText>
        ) : fallo ? (
          <AtlasText variant="caption" tone="warning">
            {`No se pudo mostrar el comprobante. ${fallo} Puede rechazarlo indicando que el comprobante no se lee.`}
          </AtlasText>
        ) : null}
      </View>
      <DecisionConMotivo {...decision} etiquetaAceptar="Confirmar" testID={testID} />
    </Card>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.sm },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  texto: { flex: 1, gap: space.xs },
  estado: { flexDirection: 'row' },
});
