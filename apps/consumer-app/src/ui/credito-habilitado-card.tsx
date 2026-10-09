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
import type { CreditLine } from '../api/endpoints/credit-line';
import { formatAmount } from '../features/spending-copy';
import { AtlasText, Cargando, Card, CardHeader, Divider, ErrorState, Skeleton, Stat, StatRow } from './primitives';
import { marca } from '../theme/tokens';

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

export function CreditoHabilitadoCard({ creditLine, ready, error, onRetry, textoSinCalcular, children }: Props) {
  return (
    <Card testID="credito-habilitado-card">
      <CardHeader icon="billetera" eyebrow="Disponible para comprar" title="Crédito habilitado" divider={false} />
      {creditLine ? (
        <>
          {/* La cifra más grande de la app: es la respuesta a la pregunta con la que se abre. */}
          <AtlasText variant="amountHero">{formatAmount(creditLine.available, creditLine.currencyCode)}</AtlasText>
          <Divider />
          <StatRow>
            <Stat label="Límite aprobado" value={formatAmount(creditLine.approvedLimit, creditLine.currencyCode)} />
            <Stat label="Por pagar" value={formatAmount(creditLine.used, creditLine.currencyCode)} tone={creditLine.used > 0 ? 'primary' : 'tertiary'} />
          </StatRow>
          {creditLine.maxAffordableInstallment !== null ? (
            <AtlasText variant="caption" tone="secondary">
              Calculado sobre un ingreso disponible de {formatAmount(creditLine.disposableIncome ?? 0, creditLine.currencyCode)} al mes. Tu cuota máxima
              sostenible es {formatAmount(creditLine.maxAffordableInstallment, creditLine.currencyCode)}.
            </AtlasText>
          ) : null}
          {/* Sólo se afirma la procedencia cuando hay una ejecución del motor que la respalde. */}
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
