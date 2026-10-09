/**
 * Configuracion de entorno de la app.
 *
 * Se lee de `EXPO_PUBLIC_*` (visibles en el bundle: aqui NO va ningun secreto). La base de la API es
 * obligatoria; el resto tiene valores por defecto pensados para desarrollo local.
 *
 * ## Dos fuentes, y por que hacen falta las dos
 *
 * `process.env` se inlinea al empaquetar y es lo que funciona con `expo start`. En un binario nativo
 * de release, en cambio, el empaquetado lo lanza Gradle y la carga de los `.env` no esta garantizada
 * ahi: el binario acababa con el valor por defecto que entonces tenia el codigo —una IP de desarrollo—
 * aunque se hubiera compilado con otro `.env`. Como no falla al compilar, se descubria con la app instalada.
 *
 * Por eso `app.config.js` lee el `.env` de forma explicita y deja los valores en `extra.atlas`, que
 * `expo-constants` serializa dentro del APK en cada compilacion. Se consulta primero el entorno
 * —para que exportar una variable en la terminal siga mandando— y despues `extra`.
 */
import Constants from 'expo-constants';

type AtlasExtra = {
  apiUrl?: string;
  tenantId?: string;
  timeoutMs?: string;
  purchaseSource?: string;
  decisionSource?: string;
  escanerDocumento?: string;
};

const extra = (Constants.expoConfig?.extra?.atlas ?? {}) as AtlasExtra;

const clean = (value: string | undefined): string | undefined =>
  value !== undefined && value.length > 0 ? value : undefined;

const fromEnv = (key: string, fallback?: string): string | undefined =>
  clean(process.env[key]) ?? clean(fallback);

/**
 * La base de la API NO tiene valor por defecto (auditoria de seguridad 2026-10-09, APP-26).
 *
 * Antes caia a `http://192.168.0.197:3105/api/v1`: una IP de la red de casa, en claro, que viajaba
 * dentro de CADA bundle —tambien el de la tienda— y que convertia «olvide configurar la URL» en una
 * app que arranca, no falla al compilar y habla por http con lo que conteste en esa IP de la red
 * donde este el telefono. Sin URL configurada no hay a quien hablar, y se dice:
 *
 * - en desarrollo, la app se para al cargar con un error que dice que variable falta y donde;
 * - en un build de release no puede llegar a pasar: `app.config.js` aborta el build de EAS sin URL,
 *   y `__tests__/eas-distribucion.test.ts` exige que cada perfil la declare por https.
 *
 * Para un emulador o un telefono en la misma red: `EXPO_PUBLIC_ATLAS_API_URL=http://<IP LAN>:3105/api/v1`
 * en `.env` (ver `.env.example`). `localhost` no sirve: dentro del emulador apunta al propio emulador.
 */
export const SIN_URL_DE_API =
  'Falta EXPO_PUBLIC_ATLAS_API_URL: la app no sabe a que servidor hablar. Ponla en apps/consumer-app/.env ' +
  '(copia .env.example) o exportala antes de `expo start`; en un build de EAS va en el perfil de eas.json.';

/** La base configurada, o un error claro. Exportada para probarla sin recargar el modulo. */
export function resolverUrlDeLaApi(configurada: string | undefined): string {
  const url = clean(configurada?.trim());
  if (!url) throw new Error(SIN_URL_DE_API);
  return url;
}

export const apiConfig = {
  baseUrl: resolverUrlDeLaApi(fromEnv('EXPO_PUBLIC_ATLAS_API_URL', extra.apiUrl)),
  tenantId: fromEnv('EXPO_PUBLIC_ATLAS_TENANT_ID', extra.tenantId) ?? '1',
  requestTimeoutMs: Number(fromEnv('EXPO_PUBLIC_ATLAS_TIMEOUT_MS', extra.timeoutMs) ?? 20_000),
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
  (fromEnv('EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE', extra.purchaseSource) as PurchaseDataSource | undefined) ?? 'sandbox';

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
  (fromEnv('EXPO_PUBLIC_ATLAS_DECISION_SOURCE', extra.decisionSource) as DecisionSource | undefined) ?? 'backend';

export const isBackendDecision = decisionSource === 'backend';

/**
 * Si el carnet se captura con el escaner de documentos DEL SISTEMA (VisionKit en iPhone, ML Kit en
 * Android) en lugar de la camara de la app. Ver `src/device/escaner-documento.ts`.
 *
 * ## Por que apagado por omision, y por que solo «true» lo enciende
 *
 * Con la bandera encendida la app manda al backend el origen de la captura (`captureSource`,
 * `documentCaptureSource`). Los esquemas de esas rutas son `.strict()`: un backend que todavia no
 * conozca el campo contesta 400 y el alta se corta en el carnet. Por eso el orden es backend
 * primero y bandera despues, y por eso lo que no sea exactamente `true` (o `1`) cuenta como apagado:
 * una bandera que se enciende con cualquier texto —incluido «false»— ya paso una vez en Atlas.
 *
 * Viene por el mismo camino que las demas: el entorno al empaquetar y, en el binario, `extra.atlas`
 * (EAS no sube el `.env`: el valor de cada perfil vive en `eas.json`).
 */
const ESCANER_ENCENDIDO = new Set(['true', '1']);

export const escanerDocumentoActivado: boolean = ESCANER_ENCENDIDO.has(
  (fromEnv('EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO', extra.escanerDocumento) ?? '').trim().toLowerCase(),
);
