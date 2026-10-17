/**
 * «Mis compras» en Inicio: las últimas compras en tarjetas que se deslizan hacia la derecha (Pablo, 2026-10-17), con
 * el mismo dibujo que las cuentas en la portada de un banco: el importe arriba, una línea, y debajo el comercio, la
 * fecha y el estado.
 *
 * Las compras salen del LIBRO del backend (`useCreditBook().loans`), lo mismo que «Mis compras». Antes la portada
 * pintaba las órdenes del motor local de compra, que no se llenaba con las compras reales: quien había comprado
 * veía «Todavía no tienes compras».
 *
 * Una compra sólo es préstamo cuando el comercio confirma el pago inicial (`disburse_confirmed_purchases`). Hasta
 * entonces vive en el teléfono como orden «falta el inicial», y va delante: es la que pide algo a la persona.
 *
 * Se enseñan las `COMPRAS_EN_PORTADA` más recientes y, si hay más, una última tarjeta lleva al historial entero. Cinco
 * caben en dos deslizamientos de pulgar; más ya es buscar, y buscar se hace mejor en «Mis compras», con filtros.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import type { LoanSummary } from '../api/endpoints/loans';
import { estadoDeCompra, fechaDeCompra } from '../features/historial-compras';
import { categoryLook, formatAmount } from '../features/spending-copy';
import { color, radius, shadow, space } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface } from './motion';
import { AtlasText, Badge, Divider, IconChip } from './primitives';

export const COMPRAS_EN_PORTADA = 5;

/** El ancho de cada tarjeta: deja ver dos y asomar la tercera, que es lo que dice «esto se desliza». */
const ANCHO_TARJETA = 172;

/** Las compras de la portada: la más reciente primero, y como mucho `COMPRAS_EN_PORTADA`. */
export function comprasDePortada(loans: readonly LoanSummary[]): LoanSummary[] {
  return [...loans]
    .sort((a, b) => (fechaDeCompra(b) ?? '').localeCompare(fechaDeCompra(a) ?? ''))
    .slice(0, COMPRAS_EN_PORTADA);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «14 oct 2026». A mano: con la fecha en UTC, `toLocaleDateString` en Bolivia podía restar un día. */
function fechaCorta(iso: string | null): string {
  const partes = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return partes ? `${Number(partes[3])} ${MESES[Number(partes[2]) - 1]} ${partes[1]}` : 'Sin fecha';
}

/** Una compra hecha que todavía no es préstamo: espera que el comercio confirme el pago inicial. */
export type CompraPorConfirmar = { id: string; comercio: string; importe: string; onPress: () => void };

export function ComprasCarrusel({
  loans,
  porConfirmar = [],
  onAbrir,
  onVerTodas,
}: {
  loans: readonly LoanSummary[];
  porConfirmar?: readonly CompraPorConfirmar[];
  onAbrir: (loanId: string) => void;
  onVerTodas: () => void;
}) {
  const visibles = comprasDePortada(loans);
  const restantes = loans.length - visibles.length;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fila}
      decelerationRate="fast"
      snapToInterval={ANCHO_TARJETA + space.md}
      snapToAlignment="start"
      testID="compras-carrusel"
    >
      {porConfirmar.map((compra) => (
        <PressSurface
          key={compra.id}
          accessibilityRole="button"
          accessibilityLabel={`Compra en ${compra.comercio}: ${compra.importe}, falta el pago inicial. Toca para ver cómo pagarlo.`}
          onPress={compra.onPress}
          style={styles.tarjeta}
          testID={`compra-por-confirmar-${compra.id}`}
        >
          <AtlasText variant="amountSmall" numberOfLines={1} adjustsFontSizeToFit style={styles.centro}>
            {compra.importe}
          </AtlasText>
          <Divider />
          <View style={styles.pie}>
            <AtlasText variant="title" numberOfLines={1} style={styles.centro}>
              {compra.comercio}
            </AtlasText>
            <AtlasText variant="caption" tone="secondary" style={styles.centro}>
              En curso
            </AtlasText>
            <Badge dot label="Falta el inicial" tone="warning" />
          </View>
        </PressSurface>
      ))}
      {visibles.map((compra) => {
        const estado = estadoDeCompra(compra);
        const comercio = compra.merchant?.displayName ?? 'Compra sin comercio';
        const importe = formatAmount(Number(compra.principalAmount), compra.currencyCode);
        const fecha = fechaCorta(fechaDeCompra(compra));
        return (
          <PressSurface
            key={compra.loanId}
            accessibilityRole="button"
            accessibilityLabel={`Compra en ${comercio}: ${importe}, ${fecha}, ${estado.texto}. Toca para ver el detalle.`}
            onPress={() => onAbrir(compra.loanId)}
            style={styles.tarjeta}
            testID={`compra-portada-${compra.loanId}`}
          >
            <AtlasText variant="amountSmall" numberOfLines={1} adjustsFontSizeToFit style={styles.centro}>
              {importe}
            </AtlasText>
            <Divider />
            <View style={styles.pie}>
              <AtlasText variant="title" numberOfLines={1} style={styles.centro}>
                {comercio}
              </AtlasText>
              <AtlasText variant="caption" tone="secondary" style={styles.centro}>
                {fecha}
              </AtlasText>
              <Badge dot label={estado.texto} tone={estado.tono === 'neutral' ? 'info' : estado.tono} />
            </View>
          </PressSurface>
        );
      })}
      {restantes > 0 ? (
        <PressSurface
          accessibilityRole="button"
          accessibilityLabel={`Ver todas tus compras, ${restantes} más`}
          onPress={onVerTodas}
          style={[styles.tarjeta, styles.verTodas]}
          testID="compras-ver-todas"
        >
          <IconChip name={categoryLook('sin_comercio').icon} tone="brand" />
          <AtlasText variant="title" style={styles.centro}>
            Ver todas
          </AtlasText>
          <AtlasText variant="caption" tone="secondary" style={styles.centro}>
            {restantes === 1 ? '1 compra más' : `${restantes} compras más`}
          </AtlasText>
          <Icon name="adelante" size={18} tint={color.text.tertiary} />
        </PressSurface>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Aire abajo para que la sombra de las tarjetas no la corte el borde del desplazamiento.
  fila: { gap: space.md, paddingBottom: space.sm, paddingRight: space.lg },
  tarjeta: {
    width: ANCHO_TARJETA,
    padding: space.base,
    gap: space.sm,
    backgroundColor: color.surface.raised,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.surface.cardBorder,
    ...shadow.card,
  },
  pie: { alignItems: 'center', gap: space.xs },
  centro: { textAlign: 'center' },
  verTodas: { alignItems: 'center', justifyContent: 'center' },
});
