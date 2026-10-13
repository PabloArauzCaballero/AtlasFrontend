/**
 * Inicio.
 *
 * Responde en un vistazo las tres preguntas que trae quien abre la app: cuanto puedo gastar, cuanto
 * debo y que me vence primero. Nada mas: el nivel, la calificacion, cuanto puede crecer el credito y
 * el gasto por rubro salieron de la portada (Pablo, 2026-10-12); los tres primeros siguen en Perfil.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { formatMoney } from '../../../src/domain/money';
import { useSandbox } from '../../../src/sandbox/store';
import { useSession } from '../../../src/session/session';
import { color, radius, space, marca } from '../../../src/theme/tokens';
import { AtlasMark } from '../../../src/ui/brand';
import { Gap, Screen } from '../../../src/ui/layout';
import {
  AtlasText,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  EmptyState,
  ListRow,
  SectionHeader,
  Skeleton,
} from '../../../src/ui/primitives';
import { PartnerBanner, usePartnerBanner } from '../../../src/ui/partner-banner';
import { formatAmount } from '../../../src/features/spending-copy';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { useAlVolver, useTirarParaRecargar } from '../../../src/features/al-volver';
import { CreditoHabilitadoCard } from '../../../src/ui/credito-habilitado-card';
import { dueLabel } from '../../../src/features/payment-copy';
import { ProximoPagoCard, fechaDeVencimiento } from '../../../src/ui/proximo-pago-card';
import { TOUR_INICIO_KEY, TOUR_INICIO_TARGETS } from '../../../src/features/tour-inicio';
import { useCopy, useTourInicio } from '../../../src/features/use-contenido-remoto';
import { SurfaceContent, esBannerDePartner, useSurfaceContent } from '../../../src/ui/surface-content';
import { TourTarget, shouldAutoStart, useTour } from '../../../src/ui/tour';

/** «Vence mañana» → «vence mañana»: la frase va detrás del importe, no al principio de un renglón. */
const minusculaInicial = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

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
  // Al volver a Inicio, tras pagar y cada minuto a la vista: la línea y los créditos al día.
  const recargarTodo = () => Promise.all([session.refresh(), book.reload()]);
  useAlVolver(recargarTodo);
  const tirar = useTirarParaRecargar(recargarTodo);
  const partnerBanner = usePartnerBanner();
  // Avisos y mensajes que negocio escribe para el inicio; los del banner de partner salen aparte.
  const avisosDeInicio = useSurfaceContent('home', esBannerDePartner);
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
    /*
      Tirar hacia abajo recarga TODO lo que pinta la portada. Antes solo recargaba el perfil (`session.refresh`):
      la línea, las compras y los puntos seguían como estaban, y lo único que los traía era cerrar la app.
    */
    <Screen {...tirar}>
      <View style={styles.greeting}>
        <View style={styles.greetingText}>
          <AtlasText variant="caption" tone="secondary">
            Hola{firstName ? `, ${firstName}` : ''}
          </AtlasText>
          <AtlasText variant="h1">Tu línea {marca.nombre}</AtlasText>
        </View>
        {/* El botón de la marca: abre «Conoce Atlas», las pantallas de presentación de antes (Pablo, 2026-10-08). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Conoce ${marca.nombre}`}
          onPress={() => router.push('/(app)/conoce-atlas')}
          style={({ pressed }) => [styles.botonAtlas, pressed && styles.botonAtlasPulsado]}
          testID="inicio-conoce-atlas"
        >
          <AtlasMark size={22} />
          <AtlasText variant="captionStrong">{marca.nombre}</AtlasText>
        </Pressable>
      </View>

      <SurfaceContent entries={avisosDeInicio} />

      <TourTarget id={TOUR_INICIO_TARGETS.linea}>
        {/*
          Cuánto crédito hay habilitado, en su propia tarjeta (pedido de Pablo, 2026-10-06). La cifra sale del
          MOTOR, no de una constante: era `DEFAULT_LIMIT = minor(500_000)`, Bs 5.000 para todo el mundo.
        */}
        <CreditoHabilitadoCard
          creditLine={creditLine}
          ready={book.ready}
          error={book.creditLineError ?? book.error}
          onRetry={() => void book.reload()}
          textoSinCalcular={t.texto('inicio.calculando')}
        >
          <TourTarget id={TOUR_INICIO_TARGETS.escanear}>
            <Button label="Escanear QR del comercio" onPress={() => router.push('/(app)/(tabs)/escanear')} />
          </TourTarget>
        </CreditoHabilitadoCard>
      </TourTarget>

      {/*
        La mora va PEGADA a la línea, justo debajo: lo primero de la portada es siempre cuánto crédito
        hay habilitado (pedido de Pablo, 2026-10-05), y lo segundo, si se debe dinero vencido, eso.

        Antes iba por encima de la línea para no invitar a aumentar una deuda que no se está pagando.
        Esa protección no dependía del orden: con pagos vencidos la línea disponible ya baja, y el
        aviso rojo sigue siendo lo primero que se lee después de la cifra.
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
            Mientras tengas pagos vencidos, tu calificación baja. Regularízalos cuanto antes; la política de mora
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

      <TourTarget id={TOUR_INICIO_TARGETS.pagos}>
        {proximaCuotaReal ? (
          <ProximoPagoCard
            importe={formatAmount(proximaCuotaReal.pendingAmount, proximaCuotaReal.currencyCode)}
            cuando={`${proximaCuotaReal.state === 'overdue' ? 'venció' : 'vence'} el ${fechaDeVencimiento(proximaCuotaReal.dueDate)}`}
            vencido={proximaCuotaReal.state === 'overdue'}
            onPress={() => router.push(`/(app)/cuota/${proximaCuotaReal.loanId}/${proximaCuotaReal.installmentNumber}`)}
          />
        ) : sandbox.nextDue ? (
          <ProximoPagoCard
            importe={formatMoney(sandbox.nextDue.item.amount)}
            cuando={minusculaInicial(dueLabel(sandbox.nextDue.item))}
            vencido={sandbox.nextDue.item.status === 'OVERDUE'}
            onPress={() => router.push(`/(app)/pago/${sandbox.nextDue!.item.id}`)}
          />
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

      <SectionHeader
        title="Tus compras"
        eyebrow={activeOrders.length > 0 ? `${activeOrders.length} en curso` : undefined}
      />

      {activeOrders.length === 0 ? (
        <EmptyState
          icon="billetera"
          title="Todavía no tienes compras"
          detail={`Cuando compres en un comercio ${marca.nombre}, aquí verás el detalle y tus cuotas.`}
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
  /*
    El botón de la marca (Pablo, 2026-10-08: «el padding de Atlas está bugueado»): el logo iba pegado al borde izquierdo
    (relleno asimétrico), el resplandor se salía de la píldora y quedaba arriba del todo en vez de a la altura del
    título. Ahora relleno simétrico, centrado con el saludo y un borde de marca en vez de sombra.
  */
  botonAtlas: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.feedbackBorder.brand,
    backgroundColor: color.surface.raised,
  },
  botonAtlasPulsado: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  greetingText: { gap: space.xxs },
});
