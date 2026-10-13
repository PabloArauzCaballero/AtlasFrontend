/**
 * Cuánto crédito tiene habilitado la persona, en su propia tarjeta y primera de Inicio (pedido de Pablo,
 * 2026-10-06).
 *
 * La cifra sale del MOTOR de decisión, no de la app: el backend le pide la línea con el expediente real y, si el
 * motor no responde, no inventa otra. Por eso la tarjeta dice quién y cuándo la decidió, y mientras el motor no la
 * haya calculado nunca lo dice en vez de rellenarla con un número cualquiera.
 *
 * Cuatro estados, todos resueltos aquí: con línea, cargando, sin calcular todavía, y error con reintento.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CreditLine } from '../api/endpoints/credit-line';
import { formatAmount } from '../features/spending-copy';
import { AtlasText, Cargando, Card, Divider, ErrorState, Skeleton } from './primitives';
import { BarraViva } from './cuenta-arriba';
import { EncabezadoTarjeta } from './encabezado-tarjeta';
import { marca, space } from '../theme/tokens';

type Props = {
  creditLine: CreditLine | null;
  ready: boolean;
  error: string | null;
  onRetry: () => void;
  textoSinCalcular: string;
  /** La acción principal de la portada (escanear), que vive con la cifra que la hace posible. */
  children?: ReactNode;
};

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'long' });

/** Qué parte del límite está usada, de 0 a 100. Sin límite (0) no hay nada que consumir: barra vacía, no una división por cero. */
export function porcentajeUsado(linea: Pick<CreditLine, 'used' | 'approvedLimit'>): number {
  if (!(linea.approvedLimit > 0)) return 0;
  return Math.max(0, Math.min(100, (linea.used / linea.approvedLimit) * 100));
}

/** El importe sin céntimos cuando son cero («Bs 640»), que es como se lee en una frase; con céntimos, completo. */
function importeCorto(importe: number, moneda: string): string {
  return formatAmount(importe, moneda).replace(/,00$/, '');
}

export function CreditoHabilitadoCard({ creditLine, ready, error, onRetry, textoSinCalcular, children }: Props) {
  return (
    <Card testID="credito-habilitado-card">
      <EncabezadoTarjeta icono="billetera" etiqueta="Disponible para comprar" />
      {creditLine ? (
        <>
          {/* La cifra más grande de la app: es la respuesta a la pregunta con la que se abre. */}
          <AtlasText variant="amountHero">{formatAmount(creditLine.available, creditLine.currencyCode)}</AtlasText>
          {/*
            Cómo se va consumiendo la línea (Pablo, 2026-10-12): la barra se LLENA con lo usado, así que una barra
            casi llena es poco crédito libre. Antes eran dos cifras sueltas —límite y por pagar— y la resta la hacía
            la persona de cabeza.
          */}
          <View style={styles.consumo}>
            <BarraViva
              value={porcentajeUsado(creditLine)}
              label={`Usaste ${importeCorto(creditLine.used, creditLine.currencyCode)} de tu límite de ${importeCorto(creditLine.approvedLimit, creditLine.currencyCode)}`}
              grosor="lg"
              punto={false}
              alRas
            />
            <AtlasText variant="captionStrong" tone="secondary" testID="credito-consumo">
              {`${importeCorto(creditLine.used, creditLine.currencyCode)} usado de ${importeCorto(creditLine.approvedLimit, creditLine.currencyCode)} de límite`}
            </AtlasText>
          </View>
          {creditLine.maxAffordableInstallment !== null ? (
            <AtlasText variant="caption" tone="secondary">
              Calculado sobre un ingreso disponible de {formatAmount(creditLine.disposableIncome ?? 0, creditLine.currencyCode)} al mes. Tu cuota máxima
              sostenible es {formatAmount(creditLine.maxAffordableInstallment, creditLine.currencyCode)}.
            </AtlasText>
          ) : null}
          {/* Sólo se afirma la procedencia cuando hay una ejecución del motor que la respalde. */}
          {creditLine.decision?.executionId ? <Divider /> : null}
          {creditLine.decision?.executionId ? (
            <AtlasText variant="caption" tone="tertiary" testID="credito-procedencia">
              Lo decidió el motor de decisión de {marca.nombre} el {fechaCorta(creditLine.decision.calculatedAt)}.
            </AtlasText>
          ) : null}
        </>
      ) : !ready ? (
        <>
          <Skeleton height={40} width="62%" />
          <Cargando texto="Consultando tu crédito…" />
        </>
      ) : error ? (
        <ErrorState title="No pudimos cargar tu crédito" detail={error} onRetry={onRetry} />
      ) : (
        <>
          <AtlasText variant="amountHero" tone="tertiary">
            —
          </AtlasText>
          <AtlasText variant="caption" tone="secondary">
            {textoSinCalcular}
          </AtlasText>
        </>
      )}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  consumo: { gap: space.xs },
});
