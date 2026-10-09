/** Un id por petición para atarla en `system_action_logs`. */
import { randomUUID } from 'expo-crypto';

export function newCorrelationId(): string {
  return randomUUID();
}
