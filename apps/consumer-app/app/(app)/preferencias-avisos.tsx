/**
 * Por donde quieres que te avisemos.
 *
 * ## Que se puede apagar y que no
 *
 * Casi todo. NO se pueden apagar los avisos que el servidor marca `isMandatory`: el recordatorio de
 * cuota, el aviso de mora y las alertas de seguridad. La pantalla ensena el candado JUNTO A SU
 * MOTIVO, que llega del servidor con cada aviso: un control desactivado sin explicacion se lee como
 * un error de la app o como abuso, y ninguna de las dos lecturas es la que corresponde.
 *
 * ## Por que ya no hay un diccionario de codigos aqui
 *
 * Porque lo habia, y era el motivo de que un aviso nuevo saliera en pantalla como
 * `loan.installment.due_soon` hasta que alguien publicara una version de la app con su traduccion.
 * Ahora el nombre, la explicacion y el grupo llegan del catalogo del servidor. Anadir un aviso o
 * reescribir una frase que se entiende mal dejo de ser un despliegue.
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
import { activarAvisos, estadoAvisos, type EstadoAvisos } from '../../src/device/push';
import { color, radius, space } from '../../src/theme/tokens';
import { Icon, type IconName } from '../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { Switch } from '../../src/ui/fields';
import { AtlasText, Badge, Button, Card, Divider, EmptyState, ErrorState, Skeleton } from '../../src/ui/primitives';

/** El canal, dicho como lo diria la persona. Es lo unico que sigue aqui: son cinco y no cambian. */
const CHANNEL_LABEL: Record<string, { label: string; icon: IconName }> = {
  email: { label: 'Correo', icon: 'sobre' },
  sms: { label: 'SMS', icon: 'telefono' },
  push: { label: 'Notificación del teléfono', icon: 'alerta' },
  whatsapp: { label: 'WhatsApp', icon: 'telefono' },
  in_app: { label: 'Dentro de la app', icon: 'inicio' },
};

/** Como se llama cada grupo en pantalla. El servidor manda la clave; esto solo la titula. */
const CATEGORY_TITLE: Record<string, string> = {
  pagos: 'Tus pagos',
  credito: 'Tu crédito',
  seguridad: 'Seguridad',
  novedades: 'Novedades',
  general: 'Otros avisos',
};

type Preference = notificationsApi.NotificationPreference;

/** La clave con la que se identifica una preferencia. El servidor ya no devuelve `id`. */
function keyOf(preference: Pick<Preference, 'eventCode' | 'channel'>): string {
  return `${preference.eventCode}:${preference.channel}`;
}

export default function PreferenciasAvisos() {
  const session = useSession();
  const [items, setItems] = useState<Preference[]>([]);
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

  const toggle = async (preference: Preference, next: boolean) => {
    if (!session.customerId || preference.isMandatory) return;
    const key = keyOf(preference);
    setSaving(key);

    // Se pinta primero y se guarda despues: un interruptor que tarda medio segundo en moverse se
    // toca dos veces, y la segunda deshace la primera.
    const previous = items;
    setItems((current) => current.map((entry) => (keyOf(entry) === key ? { ...entry, isEnabled: next, isExplicit: true } : entry)));

    try {
      const updated = await notificationsApi.updatePreferences(session.customerId, [
        { eventCode: preference.eventCode, channel: preference.channel, isEnabled: next },
      ]);
      // La respuesta trae el catalogo entero, ya reconciliado. Se adopta tal cual: si el servidor
      // decidio algo distinto de lo que se pinto, gana el servidor y la pantalla no queda mintiendo.
      if (Array.isArray(updated) && updated.length > 0) setItems(updated);
      setError(null);
    } catch (caught) {
      setItems(previous);
      setError(caught);
    } finally {
      setSaving(null);
    }
  };

  const described = error ? describeError(error) : null;

  const [avisos, setAvisos] = useState<EstadoAvisos>('no-disponible');
  const [pidiendoAvisos, setPidiendoAvisos] = useState(false);

  useEffect(() => {
    void estadoAvisos().then(setAvisos);
  }, []);

  const pedirAvisos = async () => {
    if (!session.customerId) return;
    setPidiendoAvisos(true);
    try {
      setAvisos(await activarAvisos(session.customerId));
    } finally {
      setPidiendoAvisos(false);
    }
  };

  /** Agrupado por evento dentro de su categoria: es la unidad sobre la que la persona decide. */
  const byCategory = new Map<string, Map<string, Preference[]>>();
  for (const preference of items) {
    const category = byCategory.get(preference.category) ?? new Map<string, Preference[]>();
    const bucket = category.get(preference.eventCode) ?? [];
    bucket.push(preference);
    category.set(preference.eventCode, bucket);
    byCategory.set(preference.category, category);
  }

  return (
    <Screen>
      <ScreenHeader title="Cómo te avisamos" subtitle="Elige por dónde quieres recibir cada aviso." onBack="auto" />

      {/*
        El permiso del sistema, dicho antes que las preferencias.

        Sin el, todos los interruptores de push de esta pantalla son promesas que el sistema
        operativo no va a cumplir: la preferencia se guarda y el aviso no sale de aqui. Se enseña
        arriba porque es la condicion de todo lo demas, y se pide con un boton —no al abrir la
        pantalla— para que la pregunta llegue cuando ya se entiende para que sirve.
      */}
      {avisos === 'denegado' ? (
        <ErrorState
          title="Los avisos están desactivados en tu teléfono"
          detail="Aunque los enciendas aquí, tu teléfono no los va a mostrar. Actívalos para Atlas en los ajustes del sistema."
        />
      ) : avisos === 'no-disponible' ? (
        <Card>
          <AtlasText variant="bodyStrong">Recibir avisos en este teléfono</AtlasText>
          <AtlasText variant="caption" tone="secondary">
            Te avisamos cuando vence una cuota y cuando se aprueba una compra. Nada más.
          </AtlasText>
          <Button label="Activar avisos" variant="secondary" onPress={pedirAvisos} loading={pidiendoAvisos} />
        </Card>
      ) : null}

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
          title="No pudimos cargar tus avisos"
          detail="Vuelve a intentarlo en un momento. Mientras tanto seguimos avisándote de todo lo importante."
        />
      ) : null}

      {[...byCategory.entries()].map(([category, events]) => (
        <View key={category}>
          <AtlasText variant="caption" tone="tertiary">
            {(CATEGORY_TITLE[category] ?? category).toUpperCase()}
          </AtlasText>
          <Gap size="xs" />

          {[...events.entries()].map(([eventCode, preferences]) => {
            const head = preferences[0]!;
            const mandatory = preferences.some((preference) => preference.isMandatory);
            return (
              <Card key={eventCode}>
                <View style={styles.eventHeader}>
                  <AtlasText variant="h3" style={styles.flex}>
                    {head.label}
                  </AtlasText>
                  {mandatory ? <Badge label="Siempre activo" tone="info" /> : null}
                </View>

                {head.description ? (
                  <AtlasText variant="caption" tone="secondary">
                    {head.description}
                  </AtlasText>
                ) : null}

                {/*
                  El motivo del candado, con el mismo peso visual que un aviso: es lo que convierte
                  «no puedes apagarlo» en «no te conviene apagarlo, y por esto».
                */}
                {mandatory ? (
                  <View style={styles.lockRow}>
                    <Icon name="candado" size={14} tint={color.text.tertiary} />
                    <AtlasText variant="caption" tone="tertiary" style={styles.flex}>
                      {preferences.find((preference) => preference.mandatoryReason)?.mandatoryReason ??
                        'Este aviso no se puede apagar: es el que evita que te enteres tarde de una deuda tuya.'}
                    </AtlasText>
                  </View>
                ) : null}

                <Divider />

                {preferences.map((preference, index) => {
                  const channel = CHANNEL_LABEL[preference.channel] ?? { label: preference.channel, icon: 'sobre' as IconName };
                  return (
                    <View key={keyOf(preference)}>
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
                          disabled={preference.isMandatory || saving === keyOf(preference)}
                          accessibilityLabel={`${channel.label} para ${preference.label}`}
                        />
                      </View>
                    </View>
                  );
                })}
              </Card>
            );
          })}
        </View>
      ))}

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
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
