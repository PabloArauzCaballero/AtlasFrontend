/**
 * Por donde quieres que te avisemos.
 *
 * ## Que se puede apagar y que no
 *
 * Casi todo. NO se pueden apagar los avisos que el servidor marca `isRequired`: vencimientos, mora
 * y cambios en la linea de credito. No es una limitacion tecnica —es la decision de no dejar que
 * alguien se entere tarde de una deuda suya—. La pantalla lo dice en vez de esconder el interruptor:
 * un control desactivado sin explicacion se lee como un error de la app.
 *
 * ## Por que se agrupa por AVISO y no por canal
 *
 * Porque la persona piensa «no quiero que me escriban por promociones», no «quiero apagar el canal
 * email». Agrupar por canal obligaria a recorrer la lista entera para responder a una pregunta que
 * es de una sola linea.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as notificationsApi from '../../src/api/endpoints/notifications';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { color, radius, space } from '../../src/theme/tokens';
import { Icon, type IconName } from '../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { Switch } from '../../src/ui/fields';
import { AtlasText, Badge, Card, Divider, EmptyState, ErrorState, Skeleton } from '../../src/ui/primitives';

/** El canal, dicho como lo diria la persona. */
const CHANNEL_LABEL: Record<string, { label: string; icon: IconName }> = {
  email: { label: 'Correo', icon: 'sobre' },
  sms: { label: 'SMS', icon: 'telefono' },
  push: { label: 'Notificación del teléfono', icon: 'alerta' },
  whatsapp: { label: 'WhatsApp', icon: 'telefono' },
  in_app: { label: 'Dentro de la app', icon: 'inicio' },
};

/**
 * El evento, traducido.
 *
 * Los codigos que no esten aqui se ensenan tal cual y no se ocultan: un aviso sin traducir es feo,
 * pero uno escondido deja a la persona sin poder decidir sobre el.
 */
const EVENT_LABEL: Record<string, string> = {
  'loan.installment.due_soon': 'Cuando una cuota está por vencer',
  'loan.installment.overdue': 'Cuando tienes una cuota vencida',
  'loan.delinquency.bucket_changed': 'Cuando tu situación de mora cambia',
  'loan.disbursed': 'Cuando se aprueba una compra',
  'loan.paid_off': 'Cuando terminas de pagar un crédito',
  'credit.line.updated': 'Cuando cambia tu línea de crédito',
  'credit.application.decided': 'Cuando se decide una solicitud',
  'customer.onboarding.completed': 'Cuando se completa tu registro',
  'customer.identity.verified': 'Cuando se verifica tu identidad',
  'marketing.campaign': 'Novedades y promociones',
};

function eventLabel(code: string): string {
  return EVENT_LABEL[code] ?? code.replace(/[._]/g, ' ');
}

export default function PreferenciasAvisos() {
  const session = useSession();
  const [items, setItems] = useState<notificationsApi.NotificationPreference[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!session.customerId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    notificationsApi
      .getPreferences(session.customerId)
      .then((value) => {
        // Igual que en la bandeja: un objeto inesperado no puede tumbar la pantalla.
        if (!cancelled) setItems(Array.isArray(value) ? value : []);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.customerId]);

  const toggle = async (preference: notificationsApi.NotificationPreference, next: boolean) => {
    if (!session.customerId || preference.isRequired) return;
    const key = `${preference.eventCode}:${preference.channel}`;
    setSaving(key);

    // Se pinta primero y se guarda despues: un interruptor que tarda medio segundo en moverse se
    // toca dos veces, y la segunda deshace la primera.
    const previous = items;
    setItems((current) =>
      current.map((entry) => (entry.id === preference.id ? { ...entry, isEnabled: next } : entry)),
    );

    try {
      const updated = await notificationsApi.updatePreferences(session.customerId, [
        { eventCode: preference.eventCode, channel: preference.channel, isEnabled: next, isRequired: preference.isRequired },
      ]);
      if (Array.isArray(updated) && updated.length > 0) {
        setItems((current) =>
          current.map((entry) => updated.find((fresh) => fresh.id === entry.id) ?? entry),
        );
      }
      setError(null);
    } catch (caught) {
      setItems(previous);
      setError(caught);
    } finally {
      setSaving(null);
    }
  };

  const described = error ? describeError(error) : null;

  /** Agrupado por evento: es la unidad sobre la que la persona decide. */
  const byEvent = new Map<string, notificationsApi.NotificationPreference[]>();
  for (const preference of items) {
    const bucket = byEvent.get(preference.eventCode);
    if (bucket) bucket.push(preference);
    else byEvent.set(preference.eventCode, [preference]);
  }

  return (
    <Screen>
      <ScreenHeader title="Cómo te avisamos" subtitle="Elige por dónde quieres recibir cada aviso." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {!ready ? (
        <Card>
          <Skeleton height={16} width="60%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="70%" />
        </Card>
      ) : null}

      {ready && items.length === 0 ? (
        <EmptyState
          title="Todavía no hay preferencias que ajustar"
          detail="En cuanto tengas actividad en tu cuenta, aquí podrás elegir por dónde te avisamos de cada cosa."
        />
      ) : null}

      {[...byEvent.entries()].map(([eventCode, preferences]) => {
        const required = preferences.some((preference) => preference.isRequired);
        return (
          <Card key={eventCode}>
            <View style={styles.eventHeader}>
              <AtlasText variant="h3" style={styles.flex}>
                {eventLabel(eventCode)}
              </AtlasText>
              {required ? <Badge label="Siempre activo" tone="info" /> : null}
            </View>

            {required ? (
              <AtlasText variant="caption" tone="tertiary">
                Este aviso no se puede apagar: es el que evita que te enteres tarde de una deuda tuya.
              </AtlasText>
            ) : null}

            <Divider />

            {preferences.map((preference, index) => {
              const channel = CHANNEL_LABEL[preference.channel] ?? { label: preference.channel, icon: 'sobre' as IconName };
              return (
                <View key={preference.id}>
                  {index > 0 ? <Gap size="xs" /> : null}
                  <View style={styles.channelRow}>
                    <View style={styles.channelIcon}>
                      <Icon name={channel.icon} size={16} tint={color.text.secondary} />
                    </View>
                    <AtlasText variant="body" tone="secondary" style={styles.flex}>
                      {channel.label}
                    </AtlasText>
                    <Switch
                      value={preference.isEnabled}
                      onValueChange={(next) => void toggle(preference, next)}
                      disabled={preference.isRequired || saving === `${preference.eventCode}:${preference.channel}`}
                      accessibilityLabel={`${channel.label} para ${eventLabel(eventCode)}`}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        );
      })}

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xxs },
  channelIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.sunken,
  },
});
