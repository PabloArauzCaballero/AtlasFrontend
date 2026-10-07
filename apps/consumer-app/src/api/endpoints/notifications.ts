/**
 * Notificaciones del cliente y sus preferencias.
 *
 * El backend ya tenia todo esto —lista, contador de no leidas, marcar leida, preferencias— y la app
 * no lo usaba: los avisos de vencimiento y de mora existian del lado del servidor y el cliente no
 * tenia donde verlos. Lo unico que faltaba en el backend era que las preferencias fueran accesibles
 * para su DUENO y no solo para operaciones.
 */
import { request } from '../client';

export type CustomerNotification = {
  id: string;
  title: string | null;
  body: string | null;
  subject: string | null;
  channel: string;
  status: string;
  category: string | null;
  icon: string | null;
  priority: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * El sobre llega DOS veces envuelto.
 *
 * El servicio de notificaciones devuelve `{ data, pagination }` y el interceptor global lo mete
 * dentro de su propio `{ requestId, data }`. El cliente HTTP desenvuelve uno, asi que aqui todavia
 * queda `{ data, pagination }`. Tipar esto como un array hacia que `items.filter` fuera `undefined`
 * y la pestana entera reventaba con «undefined is not a function».
 */
type Envuelto<T> = { data: T; pagination?: { page: number; limit: number; total: number; totalPages: number } };

export const listNotifications = async (customerId: string): Promise<CustomerNotification[]> => {
  const envelope = await request<Envuelto<CustomerNotification[]>>(`/customers/${customerId}/notifications`);
  // Defensivo a proposito: si el backend deja de envolver algun dia, esto sigue funcionando.
  return Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
};

export const unreadCount = (customerId: string) =>
  request<{ unread: number }>(`/customers/${customerId}/notifications/unread-count`);

export const markRead = (customerId: string, notificationId: string) =>
  request<unknown>(`/customers/${customerId}/notifications/${notificationId}/read`, { method: 'POST' });

export const markAllRead = (customerId: string) =>
  request<unknown>(`/customers/${customerId}/notifications/read-all`, { method: 'POST' });

/**
 * Un aviso del catalogo, con lo que el cliente eligio encima.
 *
 * ## Por que la etiqueta viaja desde el servidor
 *
 * Porque antes vivia aqui, en un diccionario de codigos a frases. Un aviso nuevo salia en la pantalla
 * como `loan.installment.due_soon` hasta que alguien publicara una version de la app con su
 * traduccion, y corregir una explicacion que se entendia mal costaba lo mismo. Ahora el texto lo
 * escribe quien tiene que escribirlo y llega a todo el mundo a la vez.
 *
 * ## `isMandatory` y su motivo
 *
 * Marca los que NO se pueden apagar, y viene con el porque. Antes el flag lo mandaba la propia app en
 * la peticion —bastaba enviarlo en `false` para poder silenciar el aviso de mora—; ahora lo declara
 * el servidor. El motivo no es adorno: un interruptor bloqueado sin explicacion se lee como abuso.
 */
export type NotificationPreference = {
  eventCode: string;
  channel: string;
  label: string;
  description: string | null;
  category: string;
  icon: string | null;
  isMandatory: boolean;
  mandatoryReason: string | null;
  isEnabled: boolean;
  /** `true` solo si la persona lo eligio. Distingue «lo dejaste asi» de «viene asi». */
  isExplicit: boolean;
  displayOrder: number;
};

export const getPreferences = async (customerId: string): Promise<NotificationPreference[]> => {
  const envelope = await request<Envuelto<NotificationPreference[]>>(`/customers/${customerId}/notification-preferences`);
  return Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
};

/**
 * `isRequired` ya no viaja.
 *
 * El servidor dejo de leerlo justamente porque permitia que la app declarara su propia
 * obligatoriedad. Mandarlo igualmente no romperia nada —se ignora—, pero dejarlo en el tipo invitaria
 * a volver a construir la pantalla alrededor de un campo que no decide nada.
 */
export type PreferenceUpdate = { eventCode: string; channel: string; isEnabled: boolean };

export const updatePreferences = async (customerId: string, preferences: PreferenceUpdate[]): Promise<NotificationPreference[]> => {
  const envelope = await request<Envuelto<NotificationPreference[]>>(`/customers/${customerId}/notification-preferences`, {
    method: 'PATCH',
    body: { preferences },
  });
  return Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
};
