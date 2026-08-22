/**
 * Avisos.
 *
 * ## Por que es una pestana y no una campanita
 *
 * Porque lo que llega aqui no es ruido de producto: son vencimientos, moras y cambios en la linea
 * de credito de la persona. Escondido tras un icono con un punto rojo, el aviso que dice «te vence
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
import { color, radius, space } from '../../../src/theme/tokens';
import { Icon, type IconName } from '../../../src/ui/icons';
import { Gap, Screen } from '../../../src/ui/layout';
import { PressSurface } from '../../../src/ui/motion';
import { AtlasText, Button, Card, Divider, EmptyState, ErrorState, Skeleton } from '../../../src/ui/primitives';

/**
 * El icono y el color de cada familia de aviso.
 *
 * La categoria la manda el servidor; lo que hace la app es traducirla a algo que se distinga de un
 * vistazo. Una bandeja donde todos los avisos se ven igual obliga a leerlos todos para encontrar el
 * unico que importa.
 */
const CATEGORY_LOOK: Record<string, { icon: IconName; tint: string }> = {
  delinquency: { icon: 'alerta', tint: color.feedback.danger },
  mora: { icon: 'alerta', tint: color.feedback.danger },
  payment: { icon: 'pagos', tint: color.feedback.warning },
  pago: { icon: 'pagos', tint: color.feedback.warning },
  credit: { icon: 'billetera', tint: color.action.primary },
  credito: { icon: 'billetera', tint: color.action.primary },
  onboarding: { icon: 'documento', tint: color.action.primary },
  security: { icon: 'escudo', tint: color.action.primary },
};

const DEFAULT_LOOK = { icon: 'sobre' as IconName, tint: color.text.secondary };

function lookOf(category: string | null): { icon: IconName; tint: string } {
  return CATEGORY_LOOK[(category ?? '').toLowerCase()] ?? DEFAULT_LOOK;
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

  if (!ready) {
    return (
      <Screen>
        <Gap size="lg" />
        <Card>
          <Skeleton height={16} width="50%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Gap size="sm" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AtlasText variant="h1">Avisos</AtlasText>
          <AtlasText variant="body" tone="secondary">
            {unread > 0 ? `Tienes ${unread} sin leer.` : 'Todo al día.'}
          </AtlasText>
        </View>
        <PressSurface
          style={styles.gear}
          onPress={() => router.push('/(app)/preferencias-avisos')}
          accessibilityRole="button"
          accessibilityLabel="Preferencias de avisos"
        >
          <Icon name="filtro" size={20} tint={color.text.primary} />
        </PressSurface>
      </View>

      {error ? <ErrorState title="No pudimos cargar tus avisos" detail={error} onRetry={() => void load()} /> : null}

      {items.length === 0 && !error ? (
        <EmptyState
          title="Todavía no tienes avisos"
          detail="Aquí llegarán tus vencimientos, los cambios en tu línea y cualquier cosa que necesites saber de tu cuenta."
          action={<Button label="Elegir cómo te avisamos" variant="secondary" onPress={() => router.push('/(app)/preferencias-avisos')} />}
        />
      ) : null}

      {items.length > 0 ? (
        <Card>
          {items.map((item, index) => {
            const look = lookOf(item.category);
            const unreadItem = !item.readAt;
            return (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <PressSurface
                  style={styles.row}
                  onPress={() => void abrir(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.title ?? item.subject ?? 'Aviso'}
                >
                  <View style={[styles.icon, { backgroundColor: look.tint + '22' }]}>
                    <Icon name={look.icon} size={18} tint={look.tint} />
                  </View>
                  <View style={styles.rowText}>
                    <AtlasText variant={unreadItem ? 'bodyStrong' : 'body'} tone={unreadItem ? 'primary' : 'secondary'}>
                      {item.title ?? item.subject ?? 'Aviso de Atlas'}
                    </AtlasText>
                    {item.body ? (
                      <AtlasText variant="caption" tone="tertiary" numberOfLines={3}>
                        {item.body}
                      </AtlasText>
                    ) : null}
                    <AtlasText variant="caption" tone="tertiary">
                      {relativeTime(item.createdAt)}
                    </AtlasText>
                  </View>
                  {/* El punto sustituye a la palabra «nuevo»: ocupa menos y se ve antes. */}
                  {unreadItem ? <View style={styles.dot} /> : null}
                </PressSurface>
              </View>
            );
          })}
        </Card>
      ) : null}

      {unread > 0 ? <Button label="Marcar todo como leído" variant="ghost" onPress={() => void marcarTodo()} /> : null}

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headerText: { flex: 1, gap: space.xxs },
  gear: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.action.primary, marginTop: 6 },
});
