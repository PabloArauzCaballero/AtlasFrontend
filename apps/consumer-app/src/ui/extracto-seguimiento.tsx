/**
 * El seguimiento del extracto en «Recalcular mi línea»: en qué etapa va y, al terminar, qué le hizo a la línea.
 *
 * Pablo (2026-10-15): «no se está viendo o leyendo bien la solicitud de recalcular capacidad con el extracto». La
 * pantalla decía «Lo estamos revisando» y una pastilla en versalitas diminutas con la hora; al aplicarse enseñaba la
 * cuota que sostienes pero NO la línea, ni la de antes, ni por qué esa cifra. Aquí van las tres cosas: las etapas, el
 * antes → ahora, y la cuenta que lleva de una a otra. Las cuentas viven en `features/extracto-estado.ts`.
 */
import { StyleSheet, View } from 'react-native';
import type { LineChange } from '../api/endpoints/credit-line';
import { cuentaDeLaLinea, type Etapa, miles, resumenDelCambio } from '../features/extracto-estado';
import { color, marca, radius, space } from '../theme/tokens';
import { Icon } from './icons';
import { AtlasText, Badge, Divider } from './primitives';

const NODO = 22;

function Nodo({ estado }: { estado: Etapa['estado'] }) {
  if (estado === 'hecha')
    return (
      <View style={[styles.nodo, styles.nodoHecho]}>
        <Icon name="check" size={13} tint={color.text.onBrand} />
      </View>
    );
  if (estado === 'fallida')
    return (
      <View style={[styles.nodo, styles.nodoFallido]}>
        <Icon name="cerrar" size={12} tint={color.text.onBrand} />
      </View>
    );
  return <View style={[styles.nodo, estado === 'actual' && styles.nodoActual]}>{estado === 'actual' ? <View style={styles.punto} /> : null}</View>;
}

/** Las etapas, de arriba abajo, unidas por un filo que se llena hasta la que está en curso. */
export function EtapasDelExtracto({ etapas }: { etapas: readonly Etapa[] }) {
  return (
    <View style={styles.etapas} testID="extracto-etapas">
      {etapas.map((etapa, i) => {
        const ultima = i === etapas.length - 1;
        return (
          <View
            key={etapa.clave}
            style={styles.etapa}
            accessibilityLabel={`${etapa.titulo}. ${etapa.estado === 'hecha' ? 'Hecho' : etapa.estado === 'actual' ? 'En curso' : etapa.estado === 'fallida' ? 'No se pudo' : 'Pendiente'}. ${etapa.detalle}`}
          >
            <View style={styles.columnaNodo}>
              <Nodo estado={etapa.estado} />
              {ultima ? null : <View style={[styles.filo, etapa.estado === 'hecha' && styles.filoHecho]} />}
            </View>
            <View style={[styles.textoEtapa, !ultima && styles.textoConAire]}>
              <AtlasText variant="bodyStrong" tone={etapa.estado === 'pendiente' ? 'tertiary' : etapa.estado === 'actual' ? 'brand' : 'primary'}>
                {etapa.titulo}
              </AtlasText>
              <AtlasText variant="caption" tone={etapa.estado === 'pendiente' ? 'tertiary' : 'secondary'}>
                {etapa.detalle}
              </AtlasText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** La línea de antes y la de ahora, en grande, con cuánto cambió. */
export function CambioDeLinea({ cambio }: { cambio: LineChange }) {
  const resumen = resumenDelCambio(cambio);
  return (
    <View style={styles.cambio} testID="extracto-cambio-de-linea" accessibilityLabel={`Tu línea ${cambio.previousLimit === null ? '' : `pasó de Bs ${miles(cambio.previousLimit)} `}a Bs ${miles(cambio.newLimit)}. ${resumen.texto}`}>
      <AtlasText variant="overline" tone="secondary">
        Tu línea
      </AtlasText>
      <View style={styles.cifras}>
        {cambio.previousLimit !== null ? (
          <>
            <AtlasText variant="amountSmall" tone="tertiary" style={styles.tachado}>
              {`Bs ${miles(cambio.previousLimit)}`}
            </AtlasText>
            <Icon name="adelante" size={18} tint={color.text.tertiary} />
          </>
        ) : null}
        <AtlasText variant="amount">{`Bs ${miles(cambio.newLimit)}`}</AtlasText>
      </View>
      <AtlasText variant="captionStrong" tone={resumen.tono}>
        {resumen.texto}
      </AtlasText>
    </View>
  );
}

/** La cuenta, fila a fila: lo que soporta el extracto, los topes, la propuesta, el ajuste por riesgo y la línea. */
export function CuentaDeLaLinea({ cambio }: { cambio: LineChange }) {
  const filas = cuentaDeLaLinea(cambio, marca.nombre);
  if (filas.length === 0) return null;
  return (
    <View style={styles.cuenta} testID="extracto-cuenta">
      <AtlasText variant="title">Cómo se calculó</AtlasText>
      <AtlasText variant="caption" tone="tertiary">
        Tu línea es el menor de estos topes, ajustado por riesgo. Lo que la frena hoy está marcado.
      </AtlasText>
      <View style={styles.tabla}>
        {filas.map((fila) => (
          <View key={fila.clave}>
            {fila.total ? <Divider /> : null}
            <View style={[styles.fila, fila.manda && styles.filaManda]} testID={`cuenta-${fila.clave}`}>
              <View style={styles.etiquetaFila}>
                <AtlasText variant={fila.total ? 'bodyStrong' : 'caption'} tone={fila.total || fila.manda ? 'primary' : 'secondary'}>
                  {fila.etiqueta}
                </AtlasText>
                {fila.manda ? <Badge label="Es lo que manda" tone="info" style={styles.manda} /> : null}
              </View>
              <AtlasText variant={fila.total ? 'amountSmall' : 'amountMicro'} tone={fila.ajuste ? (fila.valor < 0 ? 'danger' : 'success') : 'primary'} align="right">
                {fila.ajuste ? `${fila.valor < 0 ? '−' : '+'}Bs ${miles(Math.abs(fila.valor))}` : `Bs ${miles(fila.valor)}`}
              </AtlasText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  etapas: { gap: 0 },
  etapa: { flexDirection: 'row', gap: space.md },
  columnaNodo: { width: NODO, alignItems: 'center' },
  nodo: {
    width: NODO,
    height: NODO,
    borderRadius: NODO / 2,
    borderWidth: 2,
    borderColor: color.border.strong,
    backgroundColor: color.surface.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodoHecho: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  nodoFallido: { backgroundColor: color.feedback.danger, borderColor: color.feedback.danger },
  nodoActual: { borderColor: color.action.primary },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.action.primary },
  filo: { flex: 1, width: 2, minHeight: space.md, backgroundColor: color.border.strong, marginVertical: 2 },
  filoHecho: { backgroundColor: color.action.primary },
  textoEtapa: { flex: 1, gap: 2, paddingTop: 1 },
  textoConAire: { paddingBottom: space.md },
  cambio: { gap: space.xxs },
  cifras: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.sm },
  tachado: { textDecorationLine: 'line-through' },
  cuenta: { gap: space.xs },
  tabla: { gap: 2, marginTop: space.xs },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs, paddingHorizontal: space.xs, borderRadius: radius.md },
  filaManda: { backgroundColor: color.feedbackSoft.info },
  etiquetaFila: { flex: 1, gap: space.xxs, alignItems: 'flex-start' },
  manda: { alignSelf: 'flex-start' },
});
