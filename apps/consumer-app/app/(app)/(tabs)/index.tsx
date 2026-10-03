/**
 * Inicio.
 *
 * Responde en un vistazo las tres preguntas que trae quien abre la app: cuanto puedo gastar, cuanto
 * debo y que me vence primero. Todo lo demas baja en la jerarquia.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { isSandboxPurchase } from '../../../src/api/config';
import { formatMoney } from '../../../src/domain/money';
import { useSandbox } from '../../../src/sandbox/store';
import { useSession } from '../../../src/session/session';
import { space } from '../../../src/theme/tokens';
import { DataSourceBadge } from '../../../src/ui/brand';
import { Gap, Screen } from '../../../src/ui/layout';
import {
  AtlasText,
  Badge,
  BrandPanel,
  Button,
  Cargando,
  Card,
  CardHeader,
  Divider,
  EmptyState,
  ErrorState,
  IconChip,
  ListRow,
  Overline,
  ProgressBar,
  SectionHeader,
  Skeleton,
  Stat,
  StatRow,
} from '../../../src/ui/primitives';
import { PressSurface } from '../../../src/ui/motion';
import { PartnerBanner, usePartnerBanner } from '../../../src/ui/partner-banner';
import { downloadSpendingReport } from '../../../src/features/spending-report';
import { categoryLook, formatAmount } from '../../../src/features/spending-copy';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { useProgress } from '../../../src/features/use-progress';
import { NivelCard } from '../../../src/ui/nivel-card';
import { dueLabel, statusTone, statusLabel } from '../../../src/features/payment-copy';
import { TOUR_INICIO_KEY, TOUR_INICIO_TARGETS } from '../../../src/features/tour-inicio';
import { useCopy, useTourInicio } from '../../../src/features/use-contenido-remoto';
import { SurfaceContent, esBannerDePartner, useSurfaceContent } from '../../../src/ui/surface-content';
import { TourTarget, shouldAutoStart, useTour } from '../../../src/ui/tour';

export default function Home() {
  const router = useRouter();
  const session = useSession();
  const sandbox = useSandbox();

  const firstName = session.me?.profile.firstName ?? '';
  /*
   * El libro de credito REAL, del backend. Convive con el motor local de compra mientras el dominio
   * V3 no exista en el servidor: la linea y las compras siguen saliendo del sandbox, pero el dinero
   * que se debe, su reparto por rubro y la mora salen de `loans`, que es lo que de verdad se cobra.
   */
  const book = useCreditBook(session.customerId);
  const nivel = useProgress(session.customerId);
  const partnerBanner = usePartnerBanner();
  // Avisos y mensajes que negocio escribe para el inicio; los del banner de partner salen aparte.
  const avisosDeInicio = useSurfaceContent('home', esBannerDePartner);
  // El informe tarda: sin este estado el boton parece no responder y la gente lo pulsa dos veces.
  const [reportBusy, setReportBusy] = useState(false);
  const spending = book.spending;
  const creditLine = book.creditLine;
  const currency = spending?.currencyCode ?? 'BOB';
  /*
   * La próxima cuota REAL, del calendario del backend: vencidas primero, después la más cercana.
   * Es a donde lleva «Ver cómo pagar» cuando existe; la de la compra simulada sólo si no hay ninguna.
   * Antes la portada mandaba siempre a la pantalla simulada, que enseñaba un QR que ningún banco lee.
   */
  const proximaCuotaReal = (() => {
    const entradas = book.calendar?.entries ?? [];
    const pendientes = entradas.filter((entrada) => entrada.state === 'overdue' || entrada.state === 'upcoming');
    pendientes.sort((a, b) => (a.state === b.state ? a.dueDate.localeCompare(b.dueDate) : a.state === 'overdue' ? -1 : 1));
    return pendientes[0] ?? null;
  })();
  const activeOrders = sandbox.state.orders.filter((order) => order.status === 'ACTIVE' || order.status === 'WAITING_INITIAL_PAYMENT');

  const tour = useTour();
  // El texto del recorrido sale del portal; el de fábrica queda de respaldo (sin red, o sin pieza).
  const pasosTour = useTourInicio();
  const pasosTourRef = useRef(pasosTour);
  pasosTourRef.current = pasosTour;
  const t = useCopy();
  /*
    El recorrido se lanza solo una vez y SOLO si no hay nada que atender.

    Quien abre la app con una cuota por pagar entro a resolver eso; superponerle un tutorial de tres
    pasos convierte la ayuda en un obstaculo. Con compras activas tampoco hace falta: si llego a
    tener una, ya recorrio el flujo entero.

    Se espera a `sandbox.ready` porque hasta entonces la pantalla son esqueletos, y medir el objetivo
    sobre un esqueleto deja el recorte en el sitio equivocado.
  */
  useEffect(() => {
    /*
     * Y tampoco con MORA. La condicion miraba solo el motor local, asi que un cliente con cuotas
     * vencidas de verdad —que ahora vienen del backend— recibia el tutorial encima del aviso rojo.
     * Se vio en la primera captura de la demo: el paso 1 tapaba «tienes pagos pendientes».
     */
    if (!book.ready || (spending?.totals.overdue ?? 0) > 0) return;
    if (!sandbox.ready || activeOrders.length > 0 || sandbox.nextDue) return;
    let cancelled = false;
    void shouldAutoStart(TOUR_INICIO_KEY).then((should) => {
      if (should && !cancelled) tour.start(pasosTourRef.current, TOUR_INICIO_KEY);
    });
    return () => {
      cancelled = true;
    };
    // `tour.start` es estable y las dependencias reales son las tres condiciones de arranque.
  }, [sandbox.ready, sandbox.nextDue, activeOrders.length, tour, book.ready, spending]);

  if (!sandbox.ready) {
    return (
      <Screen>
        <Gap size="lg" />
        {/*
          El esqueleto tiene la geometria EXACTA de lo que viene: antetitulo, importe grande, dos
          cifras y el boton. Un esqueleto que no coincide con su contenido es peor que ninguno,
          porque la pantalla se recoloca entera en el momento en que llegan los datos.
        */}
        <Card>
          <Skeleton height={11} width="45%" />
          <Skeleton height={40} width="62%" />
          <Skeleton height={40} />
        </Card>
        <Card>
          <Skeleton height={17} width="40%" />
          <Skeleton height={1} />
          <Skeleton height={31} width="55%" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void session.refresh()}>
      <View style={styles.greeting}>
        <View style={styles.greetingText}>
          <AtlasText variant="caption" tone="secondary">
            Hola{firstName ? `, ${firstName}` : ''}
          </AtlasText>
          <AtlasText variant="h1">Tu línea Atlas</AtlasText>
        </View>
        {isSandboxPurchase ? <DataSourceBadge /> : null}
      </View>

      <SurfaceContent entries={avisosDeInicio} />

      {/*
        LO PRIMERO cuando hay mora, por encima incluso de la línea disponible.

        Quien abre la app debiendo dinero vencido no entro a ver cuanto puede gastar. Ensenarle
        primero el disponible sería invitarle a aumentar una deuda que ya no está pagando.
      */}
      {spending && spending.totals.overdue > 0 ? (
        <Card tone="danger">
          <CardHeader
            icon="alerta"
            iconTone="danger"
            eyebrow="Vencido"
            title="Tienes pagos que regularizar"
          />
          <AtlasText variant="amount" tone="danger">
            {formatAmount(spending.totals.overdue, currency)}
          </AtlasText>
          <AtlasText variant="body" tone="secondary">
            Mientras tengas pagos vencidos, tu puntaje baja. Regularízalos cuanto antes; la política de mora
            explica cómo se calcula.
          </AtlasText>
          <Button label="Ver qué debo pagar" onPress={() => router.push('/(app)/(tabs)/pagos')} />
          {/*
            La salida secundaria es un enlace, no un segundo boton.

            Dos botones apilados del mismo tamano dentro de un aviso rojo pesan lo mismo, y la
            pantalla deja de decir cual de las dos cosas hay que hacer. Aqui hay una accion —pagar—
            y una lectura.
          */}
          <Button
            label="Leer términos y condiciones"
            variant="ghost"
            onPress={() => router.push('/(app)/politica-mora')}
          />
        </Card>
      ) : null}

      <TourTarget id={TOUR_INICIO_TARGETS.linea}>
        <BrandPanel>
          <Overline>Disponible para comprar</Overline>
          {/*
            El limite sale del MOTOR, no de una constante.

            Hasta ahora esta cifra era `DEFAULT_LIMIT = minor(500_000)` escrita en la app: Bs 5.000
            para todo el mundo, decidida por nadie. Ahora la calcula la politica de suscripcion con
            el expediente real de cada persona. Mientras el motor no la haya calculado nunca, se
            dice —no se rellena con el numero viejo, que es lo que escondia el problema.
          */}
          {creditLine ? (
            <>
              {/*
                La cifra mas grande de la app, y por eso el unico `amountHero`. Es la respuesta a la
                pregunta con la que se abre la app.
              */}
              <AtlasText variant="amountHero">{formatAmount(creditLine.available, creditLine.currencyCode)}</AtlasText>
              <Divider />
              <StatRow>
                <Stat label="Límite aprobado" value={formatAmount(creditLine.approvedLimit, creditLine.currencyCode)} />
                <Stat
                  label="Por pagar"
                  value={formatAmount(creditLine.used, creditLine.currencyCode)}
                  tone={creditLine.used > 0 ? 'primary' : 'tertiary'}
                />
              </StatRow>
              {creditLine.maxAffordableInstallment !== null ? (
                <AtlasText variant="caption" tone="secondary">
                  Calculado sobre un ingreso disponible de{' '}
                  {formatAmount(creditLine.disposableIncome ?? 0, creditLine.currencyCode)} al mes. Tu cuota máxima sostenible es{' '}
                  {formatAmount(creditLine.maxAffordableInstallment, creditLine.currencyCode)}.
                </AtlasText>
              ) : null}
            </>
          ) : !book.ready ? (
            /*
              Todavía NO sabemos si hay línea: la petición sigue en el aire. Antes caía en la rama de
              abajo y se leía «—» y «Todavía estamos calculando tu línea…» durante la carga, el mismo
              texto que cuando el motor de verdad no la ha calculado: una espera pintada como un estado.
            */
            <>
              <Skeleton height={40} width="62%" />
              <Cargando texto="Consultando tu línea…" />
            </>
          ) : book.error ? (
            <ErrorState title="No pudimos cargar tu línea" detail={book.error} onRetry={() => void book.reload()} />
          ) : (
            <>
              <AtlasText variant="amountHero" tone="tertiary">
                —
              </AtlasText>
              <AtlasText variant="caption" tone="secondary">
                {t.texto('inicio.calculando')}
              </AtlasText>
            </>
          )}

          <TourTarget id={TOUR_INICIO_TARGETS.escanear}>
            <Button label="Escanear QR del comercio" onPress={() => router.push('/(app)/(tabs)/escanear')} />
          </TourTarget>
        </BrandPanel>
      </TourTarget>

      {/*
        El nivel, justo debajo de la línea: la línea dice cuánto puedes gastar y el nivel, cómo ampliarlo. Sale de
        la base de datos y no del motor, así que se ve igual aunque la línea aún no esté calculada.
      */}
      {nivel.fase === 'lista' ? <NivelCard progress={nivel.progress} onPress={() => router.push('/(app)/progreso')} /> : null}

      <TourTarget id={TOUR_INICIO_TARGETS.pagos}>
        {proximaCuotaReal ? (
          <Card>
            <CardHeader
              icon="reloj"
              title="Tu próximo pago"
              trailing={
                <Badge
                  dot
                  label={proximaCuotaReal.state === 'overdue' ? 'vencida' : 'próxima'}
                  tone={proximaCuotaReal.state === 'overdue' ? 'danger' : 'warning'}
                />
              }
            />
            <View>
              <AtlasText variant="amount">{formatAmount(proximaCuotaReal.pendingAmount, proximaCuotaReal.currencyCode)}</AtlasText>
              <AtlasText variant="caption" tone="secondary">
                {`${proximaCuotaReal.merchant.displayName} · cuota ${proximaCuotaReal.installmentNumber} · vence ${proximaCuotaReal.dueDate}`}
              </AtlasText>
            </View>
            <Button
              label="Ver cómo pagar"
              variant="secondary"
              onPress={() => router.push(`/(app)/cuota/${proximaCuotaReal.loanId}/${proximaCuotaReal.installmentNumber}`)}
            />
          </Card>
        ) : sandbox.nextDue ? (
          <Card>
            <CardHeader
              icon="reloj"
              title="Tu próximo pago"
              trailing={
                <Badge dot label={statusLabel(sandbox.nextDue.item.status)} tone={statusTone(sandbox.nextDue.item.status)} />
              }
            />
            <View>
              <AtlasText variant="amount">{formatMoney(sandbox.nextDue.item.amount)}</AtlasText>
              <AtlasText variant="caption" tone="secondary">
                {dueLabel(sandbox.nextDue.item)}
              </AtlasText>
            </View>
            <Button label="Ver cómo pagar" variant="secondary" onPress={() => router.push(`/(app)/pago/${sandbox.nextDue!.item.id}`)} />
          </Card>
        ) : (
          /*
            Sin próximo pago el paso del recorrido necesita igual algo a lo que apuntar. En vez de un
            hueco vacio se explica el invariante que va a nombrar, que ademas es justo lo que alguien
            sin compras se está preguntando: donde se paga esto.
          */
          <Card>
            <CardHeader icon="pagos" title="Tus pagos" />
            <AtlasText variant="body" tone="secondary">
              {t.texto('inicio.pagos.vacio')}
            </AtlasText>
          </Card>
        )}
      </TourTarget>

      {/* El tablero de gasto por rubro. Sale del comercio donde nacio cada credito. */}
      {spending && spending.categories.length > 0 ? (
        <Card>
          <CardHeader
            icon="grafico"
            title="En qué gastas"
            trailing={
              <Badge
                label={String(spending.totals.loanCount) + (spending.totals.loanCount === 1 ? ' compra' : ' compras')}
                tone="neutral"
              />
            }
          />

          <StatRow>
            <Stat label="Financiado" value={formatAmount(spending.totals.financed, currency)} />
            <Stat label="Por pagar" value={formatAmount(spending.totals.outstanding, currency)} />
          </StatRow>

          {spending.categories.map((item) => {
            const look = categoryLook(item.category);
            const others = item.merchants.length - 1;
            return (
              <PressSurface
                key={item.category}
                style={styles.categoryRow}
                onPress={() => router.push('/(app)/(tabs)/pagos')}
                accessibilityRole="button"
                accessibilityLabel={look.label + ': ' + item.share.toFixed(0) + ' por ciento de tu gasto'}
              >
                <IconChip name={look.icon} tone={item.overdue > 0 ? 'danger' : 'brand'} />
                <View style={styles.categoryText}>
                  <View style={styles.rowBetween}>
                    <AtlasText variant="title">{look.label}</AtlasText>
                    <AtlasText variant="amountMicro">{formatAmount(item.financed, currency)}</AtlasText>
                  </View>
                  {/*
                    La barra usa el porcentaje que YA calculo el servidor: recalcularlo aquí haria
                    que la pantalla y el PDF discreparan por redondeo.
                  */}
                  <ProgressBar value={item.share} label={look.label + ': ' + item.share.toFixed(0) + ' por ciento'} />
                  <AtlasText variant="caption" tone="tertiary">
                    {item.share.toFixed(0)}
                    {/* Espacio duro: el porcentaje y su signo son una sola unidad y no se separan al final de un renglon. */}
                    {'\u00A0% · '}
                    {item.merchants[0]?.displayName ?? 'sin comercio'}
                    {others > 0 ? ' y ' + others + ' más' : ''}
                  </AtlasText>
                </View>
              </PressSurface>
            );
          })}

          <Divider />
          {/*
            El informe lo compone el SERVIDOR y se abre en el visor del sistema. Traerlo a memoria
            para reescribirlo en disco no anade nada y deja una copia del documento en el teléfono.
          */}
          <Button
            label={reportBusy ? 'Preparando informe…' : 'Descargar informe en PDF'}
            variant="secondary"
            loading={reportBusy}
            onPress={() => {
              if (!session.customerId || reportBusy) return;
              setReportBusy(true);
              void downloadSpendingReport(session.customerId).then((outcome) => {
                setReportBusy(false);
                if (!outcome.ok) Alert.alert('Informe no disponible', outcome.reason);
              });
            }}
          />
        </Card>
      ) : null}

      <SectionHeader
        title="Tus compras"
        eyebrow={activeOrders.length > 0 ? `${activeOrders.length} en curso` : undefined}
      />

      {activeOrders.length === 0 ? (
        <EmptyState
          icon="billetera"
          title="Todavía no tienes compras"
          detail="Cuando compres en un comercio Atlas, aquí verás el detalle y tus cuotas."
          action={<Button label="Escanear un QR" variant="secondary" onPress={() => router.push('/(app)/(tabs)/escanear')} />}
        />
      ) : (
        <Card padding="tight">
          {activeOrders.map((order, index) => (
            <View key={order.id}>
              {index > 0 ? <Divider inset /> : null}
              <ListRow
                icon="comercio"
                title={order.context.tradeName}
                subtitle={`${order.orderCode} · ${formatMoney(order.grossAmount)}`}
                right={
                  <Badge
                    label={order.status === 'ACTIVE' ? 'activa' : 'falta inicial'}
                    tone={order.status === 'ACTIVE' ? 'success' : 'warning'}
                  />
                }
                onPress={() => router.push(`/(app)/compra/${order.id}`)}
              />
            </View>
          ))}
        </Card>
      )}

      {/* Al final del inicio: lo comercial nunca por encima de lo que el cliente debe. */}
      {partnerBanner ? (
        <PartnerBanner
          content={partnerBanner}
          onPress={partnerBanner.action ? () => void Linking.openURL(partnerBanner.action!.url) : undefined}
        />
      ) : null}
      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  greetingText: { gap: space.xxs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  categoryText: { flex: 1, gap: space.xs },
});
