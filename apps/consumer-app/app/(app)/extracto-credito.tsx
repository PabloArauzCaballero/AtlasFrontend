/**
 * Mi extracto de crédito: todo lo que pasó con el crédito, como el extracto de un banco (Pablo, 2026-10-08).
 *
 * Arriba lo que se financió, lo que se pagó y lo que se debe hoy. Después lo que viene (las cuotas por pagar) y la
 * lista de movimientos con el saldo de cada momento. Las cuentas viven en `features/extracto-credito.ts`.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import * as loansApi from "../../src/api/endpoints/loans";
import { useAlVolver } from "../../src/features/al-volver";
import {
  armarExtracto,
  type Extracto,
} from "../../src/features/extracto-credito";
import { formatAmount } from "../../src/features/spending-copy";
import { downloadCreditStatement } from "../../src/features/spending-report";
import { color, space, marca } from "../../src/theme/tokens";
import { useSession } from "../../src/session/session";
import { Gap, Screen, ScreenHeader } from "../../src/ui/layout";
import {
  AtlasText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Overline,
  SectionHeader,
  SkeletonLista,
} from "../../src/ui/primitives";
import { useSinCapturas } from '../../src/device/sin-capturas';

const fecha = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(
    "es-BO",
  );

export default function ExtractoCredito() {
  // PIN, carnet o datos bancarios: sin capturas ni grabaciones de pantalla (APP-18).
  useSinCapturas('extracto-credito');
  const session = useSession();
  const [extracto, setExtracto] = useState<Extracto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState(false);

  const cargar = useCallback(async () => {
    if (!session.customerId) return;
    setError(null);
    try {
      const { items } = await loansApi.listLoans(session.customerId);
      const detalles = await Promise.all(
        items.map((loan) => loansApi.getLoan(loan.loanId)),
      );
      setExtracto(armarExtracto(detalles));
    } catch {
      setError(
        "No pudimos cargar tu extracto. Revisa tu conexión y vuelve a intentar.",
      );
    }
  }, [session.customerId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useAlVolver(cargar);

  const moneda = "BOB";
  return (
    <Screen onRefresh={() => void cargar()}>
      <ScreenHeader
        title="Mi extracto de crédito"
        subtitle="Tus compras, tus pagos y lo que debes hoy."
        onBack="auto"
      />

      {error ? (
        <ErrorState
          title="Extracto no disponible"
          detail={error}
          onRetry={() => void cargar()}
        />
      ) : null}

      {!extracto && !error ? <SkeletonLista /> : null}

      {extracto ? (
        <>
          {/*
            Rediseño (Pablo, 2026-10-08: «están bugueados los paddings»). Tres cifras en tres columnas partían las
            etiquetas («FINANCIAD O») y los importes en dos líneas. Ahora la cifra que importa —lo que debes— va
            grande arriba, y las otras dos en dos columnas que sí caben.
          */}
          <Card testID="extracto-resumen">
            <Overline>Debes hoy</Overline>
            <AtlasText
              variant="amountHero"
              tone="brand"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatAmount(extracto.saldo, moneda)}
            </AtlasText>
            <Divider />
            <View style={styles.columnas}>
              <View style={styles.columna}>
                <Overline>Financiado</Overline>
                <AtlasText
                  variant="amount"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatAmount(extracto.totalFinanciado, moneda)}
                </AtlasText>
              </View>
              <View style={styles.separador} />
              <View style={styles.columna}>
                <Overline>Pagado</Overline>
                <AtlasText
                  variant="amount"
                  tone="success"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatAmount(extracto.totalPagado, moneda)}
                </AtlasText>
              </View>
            </View>
            <Button
              label={
                bajando ? "Preparando el PDF…" : "Descargar extracto en PDF"
              }
              icon="descargar"
              variant="secondary"
              loading={bajando}
              onPress={() => {
                if (!session.customerId || bajando) return;
                setBajando(true);
                void downloadCreditStatement(session.customerId).then((r) => {
                  setBajando(false);
                  if (!r.ok) Alert.alert("Extracto no disponible", r.reason);
                });
              }}
              testID="extracto-pdf"
            />
          </Card>

          <Gap size="md" />
          <SectionHeader
            title="Lo que viene"
            detail="Tus cuotas por pagar, de la más cercana a la más lejana."
          />
          {extracto.proximas.length === 0 ? (
            <EmptyState
              title="Nada por pagar"
              detail="Cuando tengas cuotas pendientes, aparecerán aquí."
            />
          ) : (
            <Card padding="tight">
              {extracto.proximas.map((cuota, i) => (
                <View key={cuota.id}>
                  {i > 0 ? <Divider inset /> : null}
                  <ListRow
                    title={cuota.concepto}
                    subtitle={`Vence el ${fecha(cuota.fecha)}`}
                    right={
                      <View style={styles.derecha}>
                        <AtlasText variant="bodyStrong">
                          {formatAmount(cuota.importe, moneda)}
                        </AtlasText>
                        {cuota.vencida ? (
                          <Badge label="Vencida" tone="danger" />
                        ) : null}
                      </View>
                    }
                  />
                </View>
              ))}
            </Card>
          )}

          <Gap size="md" />
          <SectionHeader
            title="Movimientos"
            detail="Más recientes primero, con lo que debías después de cada uno."
          />
          {extracto.movimientos.length === 0 ? (
            <EmptyState
              title="Todavía no hay movimientos"
              detail={`Cuando compres con ${marca.nombre}, tu extracto empieza aquí.`}
            />
          ) : (
            <Card padding="tight" testID="extracto-movimientos">
              {extracto.movimientos.map((mov, i) => (
                <View key={mov.id}>
                  {i > 0 ? <Divider inset /> : null}
                  <ListRow
                    title={mov.concepto}
                    subtitle={fecha(mov.fecha)}
                    right={
                      <View style={styles.derecha}>
                        <AtlasText
                          variant="bodyStrong"
                          tone={mov.tipo === "pago" ? "success" : "primary"}
                        >
                          {`${mov.tipo === "pago" ? "−" : "+"} ${formatAmount(Math.abs(mov.importe), moneda)}`}
                        </AtlasText>
                        <AtlasText variant="caption" tone="secondary">
                          {`Saldo ${formatAmount(mov.saldo, moneda)}`}
                        </AtlasText>
                      </View>
                    }
                  />
                </View>
              ))}
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  columnas: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: space.md,
    marginBottom: space.sm,
  },
  columna: { flex: 1, gap: space.xxs },
  separador: { width: 1, backgroundColor: color.border.subtle },
  derecha: { alignItems: "flex-end", gap: space.xxs },
});
