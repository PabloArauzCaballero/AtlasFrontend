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
 * Una preferencia por tipo de aviso y canal.
 *
 * `required` marca las que NO se pueden apagar: vencimientos, mora y cambios en la linea. No es
 * una limitacion tecnica sino una decision —son las que protegen a la persona de enterarse tarde
 * de una deuda suya, y apagarlas seria dejar de avisarle de lo unico que no puede ignorar.
 */
export type NotificationPreference = {
  id: string;
  eventCode: string;
  channel: string;
  isEnabled: boolean;
  isRequired: boolean;
};

export const getPreferences = async (customerId: string): Promise<NotificationPreference[]> => {
  const envelope = await request<Envuelto<NotificationPreference[]>>(`/customers/${customerId}/notification-preferences`);
  return Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
};

export type PreferenceUpdate = { eventCode: string; channel: string; isEnabled: boolean; isRequired: boolean };

export const updatePreferences = async (customerId: string, preferences: PreferenceUpdate[]): Promise<NotificationPreference[]> => {
  const envelope = await request<Envuelto<NotificationPreference[]>>(`/customers/${customerId}/notification-preferences`, {
    method: 'PATCH',
    body: { preferences },
  });
  return Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
};
