/**
 * Telemetria de comportamiento y dispositivo.
 *
 * ## Por que existia el endpoint y no lo llamaba nadie
 *
 * La app ya ABRE una sesion de telemetria al entrar —lo hace `session.tsx` desde que se sabe quien
 * es— y ya sabe que permisos concedio la persona. Lo que faltaba era el otro extremo: nada enviaba
 * un solo evento a `/customers/:id/telemetry/batch`, asi que las senales que el backend pide «para
 * prevencion de fraude y mejora de conversion» se calculaban en el telefono y se tiraban.
 *
 * ## Que se manda y que no
 *
 * Se manda lo que la persona YA decidio y el sistema ya observo: si concedio camara, ubicacion o
 * contactos, y cuando. No se manda contenido —ni un contacto, ni una foto, ni una coordenada—:
 * `permission_event` dice que hubo una decision, no que hay detras del permiso.
 *
 * ## Idempotente por lote
 *
 * `clientBatchId` lo genera la app y el backend deduplica por el. Un reintento tras perder red no
 * duplica eventos, que es lo que convertiria una senal de fraude en ruido.
 */
import { newIdempotencyKey, request } from '../client';

export type TelemetryEventType =
  | 'form_field_interaction'
  | 'permission_event'
  | 'auth_event'
  | 'device_risk_event'
  | 'sim_observation'
  | 'ip_reputation_observation'
  | 'customer_observation'
  | 'customer_action'
  | 'onboarding_step_event';

export type TelemetryEvent = {
  eventType: TelemetryEventType;
  eventCode: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export type TelemetryMetric = {
  metricCode: string;
  value: number | string | boolean | Record<string, unknown>;
  computedAt?: string;
  confidenceScore?: number;
};

export type TelemetryBatch = {
  sessionId: string;
  deviceId: string;
  capturedFrom: string;
  capturedUntil: string;
  events?: TelemetryEvent[];
  onDeviceMetrics?: TelemetryMetric[];
};

export const enviarLote = (customerId: string, lote: TelemetryBatch) =>
  request<{ accepted: number; duplicated: boolean } | Record<string, unknown>>(
    `/customers/${customerId}/telemetry/batch`,
    {
      method: 'POST',
      idempotent: true,
      body: { ...lote, clientBatchId: newIdempotencyKey() },
    },
  );
