/**
 * Del evento interno al contrato del servidor.
 *
 * El backend ya tiene los tipos que hacen falta (`customer-telemetry.schemas.ts`): no se añade
 * ninguno. Cada evento interno cae en uno de ellos y el resto viaja en `metadata`, que el servidor
 * guarda tal cual en `payload_json`.
 *
 * | interno      | eventType                | eventCode          |
 * |--------------|--------------------------|--------------------|
 * | flujo        | onboarding_step_event    | `flujo`            |
 * | pantalla     | onboarding_step_event    | la pantalla        |
 * | validacion   | onboarding_step_event    | la pantalla        |
 * | envio        | onboarding_step_event    | la pantalla        |
 * | captura      | onboarding_step_event    | `captura_<que>`    |
 * | permiso      | onboarding_step_event    | `permiso_<cual>`   |
 * | toque        | customer_action          | `tap`              |
 * | campo        | form_field_interaction   | el campo           |
 *
 * `permiso` NO va a `permission_event`: esa tabla la escribe la sesion con la decision autoritativa
 * del sistema, y duplicarla desde aqui la ensuciaria. Aqui se anota cuando se PREGUNTO y que
 * contesto la persona en la pantalla, que es otra cosa.
 */
import type { TelemetryEvent } from '../../api/endpoints/telemetry';
import type { Reloj } from './reloj';
import type { EventoBitacora } from './tipos';

export function traducir(evento: EventoBitacora, reloj: Reloj): TelemetryEvent {
  const occurredAt = reloj.marcaDe(evento.t);
  const elapsedMs = evento.t;

  switch (evento.tipo) {
    case 'flujo':
      return {
        eventType: 'onboarding_step_event',
        eventCode: 'flujo',
        occurredAt,
        metadata: { eventType: evento.accion, elapsedMs, ...(evento.detalle ? { detail: evento.detalle } : {}) },
      };
    case 'pantalla':
      return {
        eventType: 'onboarding_step_event',
        eventCode: evento.pantalla,
        occurredAt,
        metadata: {
          eventType: evento.accion === 'entra' ? 'enter' : evento.accion === 'sale' ? 'leave' : 'back',
          elapsedMs,
          ...(evento.desdeEntradaMs !== undefined ? { sinceEnterMs: evento.desdeEntradaMs } : {}),
        },
      };
    case 'validacion':
      return {
        eventType: 'onboarding_step_event',
        eventCode: evento.pantalla,
        occurredAt,
        metadata: { eventType: 'validation_error', code: evento.codigo, elapsedMs, ...(evento.campo ? { field: evento.campo } : {}) },
      };
    case 'envio':
      return {
        eventType: 'onboarding_step_event',
        eventCode: evento.pantalla,
        occurredAt,
        metadata: {
          eventType: evento.resultado === 'ok' ? 'submit_ok' : 'submit_error',
          latencyMs: evento.latenciaMs,
          elapsedMs,
          ...(evento.codigo ? { code: evento.codigo } : {}),
        },
      };
    case 'captura':
      return {
        eventType: 'onboarding_step_event',
        eventCode: `captura_${evento.que}`,
        occurredAt,
        metadata: { eventType: evento.accion, elapsedMs },
      };
    case 'permiso':
      return {
        eventType: 'onboarding_step_event',
        eventCode: `permiso_${evento.permiso}`,
        occurredAt,
        metadata: { eventType: `permission_${evento.decision}`, elapsedMs },
      };
    case 'toque':
      return {
        eventType: 'customer_action',
        eventCode: 'tap',
        occurredAt,
        metadata: {
          screenName: evento.pantalla,
          control: evento.control,
          rx: evento.rx,
          ry: evento.ry,
          sx: evento.sx,
          sy: evento.sy,
          viewport: evento.viewport,
          elapsedMs,
        },
      };
    case 'campo':
      return {
        eventType: 'form_field_interaction',
        eventCode: evento.campo,
        occurredAt,
        metadata: {
          interactionType: evento.accion,
          screenName: evento.pantalla,
          usedCopyPaste: evento.accion === 'pegado',
          elapsedMs,
          ...(evento.duracionMs !== undefined ? { durationMs: evento.duracionMs } : {}),
          ...(evento.correcciones !== undefined ? { corrections: evento.correcciones } : {}),
        },
      };
  }
}

/** El tramo de tiempo que cubre un lote, para `capturedFrom` / `capturedUntil`. */
export function ventanaDe(eventos: TelemetryEvent[]): { capturedFrom: string; capturedUntil: string } {
  const marcas = eventos.map((e) => e.occurredAt).sort();
  const ahora = new Date().toISOString();
  return { capturedFrom: marcas[0] ?? ahora, capturedUntil: marcas[marcas.length - 1] ?? ahora };
}
