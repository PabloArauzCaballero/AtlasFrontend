/**
 * Avisos.
 *
 * ## Por que es una pestana y no una campanita
 *
 * Porque lo que llega aqui no es ruido de producto: son los avisos de sus pagos, de su verificacion y
 * de su cuenta (los de vencimiento y mora todavia no los emite Core: ver `features/avisos-copy.ts`). Escondido tras un icono con un punto rojo, el aviso que dice «te vence
 * una cuota manana» compite con la notificacion del sistema y pierde. En la barra, tiene el mismo
 * peso que sus pagos — que es el que le corresponde.
 *
 * ## Lo que ya existia y no se usaba
 *
 * El backend lleva tiempo generando y entregando estas notificaciones —lista, contador de no
 * leidas, marcar como leida—. La app no las pedia, asi que el cliente no tenia donde verlas: los
 * avisos existian del lado del servidor y nunca llegaban a una pantalla.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as notificationsApi from '../../../src/api/endpoints/notifications';
import { useSession } from '../../../src/session/session';
import { color, radius, space, marca } from '../../../src/theme/tokens';
import type { IconName } from '../../../src/ui/icons';
import { Gap, HeaderAction, Screen, ScreenHeader } from '../../../src/ui/layout';
import { PressSurface } from '../../../src/ui/motion';
import { useCopy } from '../../../src/features/use-contenido-remoto';
import {
  AtlasText,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  IconChip,
  Overline,
  Skeleton,
} from '../../../src/ui/primitives';

/**
 * El icono y el color de cada familia de aviso.
 *
 * La categoria la manda el servidor; lo que hace la app es traducirla a algo que se distinga de un
 * vistazo. Una bandeja donde todos los avisos se ven igual obliga a leerlos todos para encontrar el
 * unico que importa.
 */
type AvisoLook = { icon: IconName; tone: React.ComponentProps<typeof IconChip>['tone'] };

/*
 * El tono es un NOMBRE, no un color.
 *
 * Antes cada fila se pintaba el fondo de su icono concatenando la alfa al hexadecimal
 * —`look.tint + '22'`—, que es un color literal escrito en una pantalla: justo lo que el sistema de
 * tokens existe para impedir. Ademas ese 13 % fijo daba un fondo distinto segun el color de partida,
 * asi que el chip rojo y el ambar no pesaban lo mismo aunque el codigo dijera que si.
 */
const CATEGORY_LOOK: Record<string, AvisoLook> = {
  delinquency: { icon: 'alerta', tone: 'danger' },
  mora: { icon: 'alerta', tone: 'danger' },
  payment: { icon: 'pagos', tone: 'warning' },
  pago: { icon: 'pagos', tone: 'warning' },
  credit: { icon: 'billetera', tone: 'brand' },
  credito: { icon: 'billetera', tone: 'brand' },
  onboarding: { icon: 'documento', tone: 'brand' },
  security: { icon: 'escudo', tone: 'brand' },
};

const DEFAULT_LOOK: AvisoLook = { icon: 'sobre', tone: 'neutral' };

function lookOf(category: string | null): AvisoLook {
  return CATEGORY_LOOK[(category ?? '').toLowerCase()] ?? DEFAULT_LOOK;
}

/**
 * En que tramo del tiempo cae un aviso.
 *
 * La bandeja era una lista plana con «hace 3 h» repetido fila tras fila, y con veinte avisos eso
 * obliga a leer cada marca de tiempo para saber donde acaba lo de hoy. Agrupar dice lo mismo una
 * sola vez por tramo y deja la fecha relativa para el detalle.
 */
type Tramo = 'hoy' | 'semana' | 'antes';

const TRAMO_LABEL: Record<Tramo, string> = { hoy: 'Hoy', semana: 'Esta semana', antes: 'Anteriores' };

function tramoDe(iso: string): Tramo {
  const hours = (Date.now() - Date.parse(iso)) / 3_600_000;
  if (!Number.isFinite(hours)) return 'antes';
  if (hours < 24) return 'hoy';
  if (hours < 24 * 7) return 'semana';
  return 'antes';
}

/** «hace 3 h» dice mas que una fecha completa cuando lo que importa es si es reciente. */
function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  return new Date(iso).toLocaleDateString('es-BO');
}

export default function Avisos() {
  const t = useCopy();
  const router = useRouter();
  const session = useSession();

  const [items, setItems] = useState<notificationsApi.CustomerNotification[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session.customerId) {
      setReady(true);
      return;
    }
    try {
      /*
       * Se comprueba que sea un array antes de guardarlo.
       *
       * El backend envuelve la lista DOS veces —`{requestId,{data,pagination}}`— y un cambio en esa
       * forma llegaba aqui como objeto: `items.filter` pasaba a ser `undefined` y la pestana entera
       * reventaba con «undefined is not a function», tirando la app al escritorio. Una lista vacia
       * es un estado que la pantalla sabe pintar; un objeto inesperado no puede tumbarla.
       */
      const fetched = await notificationsApi.listNotifications(session.customerId);
      setItems(Array.isArray(fetched) ? fetched : []);
      setError(null);
    } catch {
      setError('No pudimos cargar tus avisos.');
    } finally {
      setReady(true);
    }
  }, [session.customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /*
   * Marcar como leido NO espera al servidor para pintar.
   *
   * El punto de «no leido» es una marca de lectura, no un movimiento de dinero: hacer esperar medio
   * segundo a que confirme el backend hace que la lista parezca trabada. Si la llamada falla, la
   * proxima carga lo devuelve a no leido, que es el peor caso aceptable.
   */
  const abrir = async (item: notificationsApi.CustomerNotification) => {
    if (!session.customerId || item.readAt) return;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)));
    await notificationsApi.markRead(session.customerId, item.id).catch(() => undefined);
  };

  const marcarTodo = async () => {
    if (!session.customerId) return;
    const now = new Date().toISOString();
    setItems((current) => current.map((entry) => ({ ...entry, readAt: entry.readAt ?? now })));
    await notificationsApi.markAllRead(session.customerId).catch(() => undefined);
  };

  const unread = items.filter((item) => !item.readAt).length;

  /*
    Los tres tramos, en orden y sin los que esten vacios. Se calcula en el render y no en un
    `useMemo` porque depende de la hora actual: memorizarlo dejaria «Hoy» conteniendo lo de ayer en
    una app que llevara abierta desde antes de medianoche.
  */
  const tramos = (['hoy', 'semana', 'antes'] as Tramo[])
    .map((tramo) => [tramo, items.filter((item) => tramoDe(item.createdAt) === tramo)] as const)
    .filter(([, avisos]) => avisos.length > 0);

  if (!ready) {
    return (
      <Screen>
        <Gap size="lg" />
        <Card padding="tight">
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Gap size="sm" />
      <ScreenHeader
        title="Avisos"
        subtitle={unread > 0 ? `Tienes ${unread} sin leer.` : 'Todo al día.'}
        action={
          <HeaderAction
            // El engranaje y no el embudo: este botón abre las PREFERENCIAS, no filtra la lista. Con el embudo la
            // gente esperaba filtrar sus avisos y acababa en otra pantalla.
            icon="ajustes"
            label="Preferencias de avisos"
            onPress={() => router.push('/(app)/preferencias-avisos')}
          />
        }
      />

      {error ? <ErrorState title="No pudimos cargar tus avisos" detail={error} onRetry={() => void load()} /> : null}

      {items.length === 0 && !error ? (
        <EmptyState
          icon="sobre"
          title="Todavía no tienes avisos"
          detail={`Aquí verás lo que te avisamos. ${t.texto('avisos.resumen')}`}
          action={<Button label="Elegir cómo te avisamos" variant="secondary" onPress={() => router.push('/(app)/preferencias-avisos')} />}
        />
      ) : null}

      {tramos.map(([tramo, avisos]) => (
        <View key={tramo} style={styles.tramo}>
          <Overline>{TRAMO_LABEL[tramo]}</Overline>
          <Card padding="tight">
            {avisos.map((item, index) => {
              const look = lookOf(item.category);
              const unreadItem = !item.readAt;
              return (
                <View key={item.id}>
                  {index > 0 ? <Divider inset /> : null}
                  <PressSurface
                    style={styles.row}
                    onPress={() => void abrir(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title ?? item.subject ?? 'Aviso'}
                  >
                    <IconChip name={look.icon} tone={look.tone} size="sm" />
                    <View style={styles.rowText}>
                      <View style={styles.rowTitle}>
                        <AtlasText variant="title" tone={unreadItem ? 'primary' : 'secondary'} style={styles.flex}>
                          {item.title ?? item.subject ?? `Aviso de ${marca.nombre}`}
                        </AtlasText>
                        {/* El punto sustituye a la palabra «nuevo»: ocupa menos y se ve antes. */}
                        {unreadItem ? <View style={styles.dot} /> : null}
                      </View>
                      {item.body ? (
                        <AtlasText variant="caption" tone={unreadItem ? 'secondary' : 'tertiary'} numberOfLines={3}>
                          {item.body}
                        </AtlasText>
                      ) : null}
                      <AtlasText variant="caption" tone="tertiary">
                        {relativeTime(item.createdAt)}
                      </AtlasText>
                    </View>
                  </PressSurface>
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      {unread > 0 ? <Button label="Marcar todo como leído" variant="ghost" onPress={() => marcarTodo()} /> : null}

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tramo: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  rowText: { flex: 1, gap: space.xxs },
  // El punto viaja al lado del TITULO, no al borde de la fila: junto al texto que marca como nuevo
  // se lee de un vistazo; en el extremo derecho de una fila de tres lineas queda sin nada a lo que
  // referirse y parece un adorno.
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: color.action.primary },
});
