/**
 * Configuracion de entorno de la app.
 *
 * Se lee de `EXPO_PUBLIC_*` (visibles en el bundle: aqui NO va ningun secreto) con valores por
 * defecto pensados para desarrollo local contra el stack de AtlasBackend.
 */
import Constants from 'expo-constants';

const fromEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
};

/**
 * `localhost` no sirve: dentro del emulador apunta al propio emulador. Se usa la IP LAN del equipo
 * anfitrion, que resuelven por igual el emulador Android, el simulador iOS y un telefono real en la
 * misma red.
 */
const DEFAULT_API_BASE_URL = 'http://192.168.0.197:3105/api/v1';

export const apiConfig = {
  baseUrl: fromEnv('EXPO_PUBLIC_ATLAS_API_URL') ?? DEFAULT_API_BASE_URL,
  tenantId: fromEnv('EXPO_PUBLIC_ATLAS_TENANT_ID') ?? '1',
  requestTimeoutMs: Number(fromEnv('EXPO_PUBLIC_ATLAS_TIMEOUT_MS') ?? 20_000),
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
} as const;

/**
 * Origen de los datos del dominio de COMPRA (QR interno, orden, aceptacion del comercio, calendario
 * de cuotas, instrucciones de pago).
 *
 * `sandbox` corre el motor local `src/sandbox`, que implementa las reglas V3 del documento maestro.
 * Existe porque ese dominio todavia NO esta implementado en AtlasBackend: no hay `purchase_order`,
 * `purchase_commitment` ni `payment_schedule`. La app lo declara de forma visible en pantalla en
 * lugar de fingir que habla con un servidor.
 *
 * `live` es el modo definitivo: en cuanto el backend exponga esos endpoints se cambia esta variable
 * y no hay que tocar las pantallas.
 */
export type PurchaseDataSource = 'sandbox' | 'live';

export const purchaseDataSource: PurchaseDataSource =
  (fromEnv('EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE') as PurchaseDataSource | undefined) ?? 'sandbox';

export const isSandboxPurchase = purchaseDataSource === 'sandbox';

/**
 * Quien decide el credito de una compra.
 *
 * Es una variable APARTE de `purchaseDataSource` porque son dos cosas distintas y mezclarlas
 * obligaria a mentir en una de las dos. El dominio de compra (QR interno, orden, calendario,
 * instrucciones) sigue en el motor local mientras AtlasBackend no lo exponga; la DECISION de
 * credito, en cambio, ya existe en el backend y viaja hasta el motor de decision.
 *
 * `backend`: la app manda monto y plazo a `POST /customers/:id/credit-applications`. El backend
 * proyecta las features del cliente, llama a AtlasDecisionEngineBackend con ese payload y devuelve
 * el expediente resuelto con su `executionId`. La app no puntua ni aprueba nada.
 *
 * `local`: el motor de demostracion de `src/sandbox`. Se declara en pantalla como tal.
 */
export type DecisionSource = 'backend' | 'local';

export const decisionSource: DecisionSource =
  (fromEnv('EXPO_PUBLIC_ATLAS_DECISION_SOURCE') as DecisionSource | undefined) ?? 'backend';

export const isBackendDecision = decisionSource === 'backend';
