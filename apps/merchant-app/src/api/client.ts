/**
 * Cliente de la API del comercio: el backend del ERP (`/api/v1`), el mismo al que habla el portal web.
 *
 * Es un PORTE de `AtlasERPFrontend/lib/apiClient.ts` y conserva su comportamiento a propósito —la
 * app tiene que hacer exactamente lo que hace la web—:
 *  - sobre `{ success, data }` / `{ success: false, error }`, y un 2xx sólo es éxito si se lee;
 *  - `ApiError` con `status`, `code` y `resultadoDesconocido` para las mutaciones sin respuesta;
 *  - reintentos acotados cuando contesta la pasarela durante un despliegue (`reintentos.ts`);
 *  - el token de ACCESO vive sólo en memoria; la sesión se renueva contra `auth/merchant/refresh`.
 *
 * La sesión del comercio vive en COOKIES httpOnly que pone el gateway (`atlas_upstream_at` y
 * `atlas_upstream_rt`, ver `AtlasERPBackend/src/modules/auth-gateway/auth-gateway.controller.ts`).
 * En el teléfono las guarda el almacén nativo de cookies de iOS y Android —llevan `maxAge`, así que
 * sobreviven a cerrar la app— siempre que la petición vaya con `credentials: 'include'`. Por eso
 * TODA petición sale por aquí: una que no lo lleve llega al gateway sin sesión.
 *
 * Lo que cambia respecto a la web: no hay `window` ni `localStorage` (el canal es siempre el del
 * comercio), el producto es `merchant-app`, y los archivos se devuelven como bytes en vez de blob URL.
 */
import { randomUUID } from 'expo-crypto';
import { apiBaseUrl, timeoutMs as timeoutPorDefecto } from './config';
import { describirIncidencia } from './mensajesValidacion';
import { conReintentos, esMutacion, esRespuestaDePasarela, repeticionDe, type Repeticion } from './reintentos';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  /** Omite la renovación en 401 (login, refresh y logout mismos). */
  skipAuthRetry?: boolean;
  /** Cabeceras extra (`Accept`, llave de idempotencia). `Authorization` lo pone siempre la sesión. */
  headers?: Record<string, string>;
}

/** El error de este cliente, con el `status` intacto. `0` = sin respuesta. Ver la cabecera de la web. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly timedOut = false,
    readonly resultadoDesconocido = false,
    readonly code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const MENSAJE_RESULTADO_DESCONOCIDO =
  'No pudimos confirmar si la operación se guardó: el sistema no respondió como esperábamos. Antes de volver a hacerla, revise si ya aparece registrada; si no la encuentra o tiene dudas, avísele a soporte.';

function resultadoDesconocido(status: number, timedOut = false): ApiError {
  return new ApiError(MENSAJE_RESULTADO_DESCONOCIDO, status, timedOut, true);
}

/** El texto para una persona: un `ApiError` ya trae su frase; cualquier otro error es del programa. */
export function mensajeDeError(error: unknown, respaldo = 'No se pudo contactar el sistema. Inténtelo otra vez.'): string {
  return error instanceof ApiError && error.message ? error.message : respaldo;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string; code?: string; details?: unknown };
}

// ---- Sesión en memoria -------------------------------------------------------------------------

let memoryAccessToken: string | null = null;
let sessionVersion = 0;
const oyentesDeCierre = new Set<() => void>();

export function getAccessToken(): string | null {
  return memoryAccessToken;
}

export function setAccessToken(token: string): void {
  sessionVersion += 1;
  memoryAccessToken = token;
}

export function clearAccessToken(): void {
  sessionVersion += 1;
  memoryAccessToken = null;
}

/** La sesión se perdió (el refresh fue rechazado). La escucha `SessionProvider` para volver a «Ingresar». */
export function alCerrarseLaSesion(oyente: () => void): () => void {
  oyentesDeCierre.add(oyente);
  return () => oyentesDeCierre.delete(oyente);
}

function broadcastForcedLogout(): void {
  for (const oyente of oyentesDeCierre) oyente();
}

/** Al abrir la app: si la cookie de refresco sigue viva, la sesión vuelve sin pedir la contraseña. */
export async function bootstrapSession(): Promise<boolean> {
  if (memoryAccessToken) return true;
  await tryRefreshSession();
  return memoryAccessToken !== null;
}

/** El logout espera una rotación en curso para revocar la cookie vigente. */
export async function finishPendingRefresh(): Promise<void> {
  await refreshPromise;
}

// ---- Pantalla de origen ------------------------------------------------------------------------

/** El formato que aceptan el backend del ERP y AtlasBackend; lo que no encaje no se manda. */
const RUTA_DE_PANTALLA = /^\/[A-Za-z0-9/_:.-]{0,199}$/;
let pantallaActual: string | null = null;

/** La fija la raíz de la navegación con cada cambio de ruta (`usePathname`). */
export function fijarPantallaActual(ruta: string | null): void {
  pantallaActual = ruta && RUTA_DE_PANTALLA.test(ruta) ? ruta : null;
}

/** Las cabeceras de origen, también para las peticiones que no pasan por `buildHeaders` (el chat). */
export function cabecerasDeOrigen(): Record<string, string> {
  return { 'x-atlas-product': 'merchant-app', ...(pantallaActual ? { 'x-atlas-flow': pantallaActual } : {}) };
}

// ---- Petición ----------------------------------------------------------------------------------

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const url = new URL(`${apiBaseUrl.replace(/\/+$/, '')}/${trimSlashes(path)}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function isApiEnvelope<T>(payload: ApiEnvelope<T> | T | null): payload is ApiEnvelope<T> {
  return Boolean(payload && typeof payload === 'object' && 'success' in payload);
}

async function readPayload<T>(response: Response): Promise<ApiEnvelope<T> | T | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  return (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;
}

/** Los detalles campo a campo de un rechazo de validación, dichos con el rótulo de pantalla. */
function describeValidationDetails(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const lines = details
    .map((detail) => {
      if (!detail || typeof detail !== 'object') return null;
      const { path, message } = detail as { path?: unknown; message?: unknown };
      if (typeof message !== 'string' || message.length === 0) return null;
      return describirIncidencia(typeof path === 'string' && path.length > 0 ? path : undefined, message);
    })
    .filter((line): line is string => line !== null);
  const shown = lines.slice(0, 4).join(' · ');
  const rest = lines.length - 4;
  return rest > 0 ? `${shown} (y ${rest} más)` : shown;
}

function segundosDeRetryAfter(response: Response): number | undefined {
  const valor = response.headers.get('retry-after')?.trim();
  return valor && /^\d{1,3}$/.test(valor) ? Number(valor) : undefined;
}

function extractErrorCode<T>(payload: ApiEnvelope<T> | T | null): string | undefined {
  return isApiEnvelope(payload) && typeof payload.error?.code === 'string' ? payload.error.code : undefined;
}

function extractErrorMessage<T>(response: Response, payload: ApiEnvelope<T> | T | null): string {
  if (isApiEnvelope(payload) && payload.error?.message) {
    const details = describeValidationDetails(payload.error.details);
    return details ? `${payload.error.message} ${details}` : payload.error.message;
  }
  if (response.status === 404) return 'No encontramos ese registro. Puede que lo hayan borrado o que el enlace ya no sirva.';
  if (response.status === 401) return 'Su sesión caducó. Vuelva a iniciar sesión.';
  if (response.status === 403) return 'No tiene permisos para ejecutar esta acción.';
  return `No se pudo completar la operación (${response.status}). Inténtelo otra vez; si sigue, avísele a soporte.`;
}

async function parseResponse<T>(response: Response, mutacion = false): Promise<T> {
  if (!response.ok) {
    const payload = await readPayload<T>(response);
    throw new ApiError(
      extractErrorMessage(response, payload),
      response.status,
      false,
      false,
      extractErrorCode(payload),
      segundosDeRetryAfter(response),
    );
  }

  if (response.status === 204 || response.status === 205) return null as T;
  const texto = await response.text().catch(() => '');
  if (texto.trim() === '') return null as T;

  const ilegible = () =>
    mutacion
      ? resultadoDesconocido(response.status)
      : new ApiError('La respuesta del sistema no se pudo leer. Inténtelo otra vez; si sigue, avísele a soporte.', response.status);
  if (!(response.headers.get('content-type') ?? '').includes('json')) throw ilegible();

  let payload: ApiEnvelope<T> | T | null;
  try {
    payload = JSON.parse(texto) as ApiEnvelope<T> | T | null;
  } catch {
    throw ilegible();
  }

  if (isApiEnvelope<T>(payload)) {
    if (payload.success === true) return payload.data as T;
    const motivo = payload.error?.message
      ? extractErrorMessage(response, payload)
      : 'El sistema rechazó la operación sin explicar el motivo. Si sigue, avísele a soporte.';
    throw new ApiError(motivo, response.status, false, false, extractErrorCode(payload));
  }
  return payload as T;
}

function buildHeaders(options: ApiRequestOptions): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-correlation-id': randomUUID(),
    ...cabecerasDeOrigen(),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  for (const [nombre, valor] of Object.entries(options.headers ?? {})) {
    if (nombre.toLowerCase() === 'authorization') continue;
    headers[nombre] = valor;
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function performFetch(path: string, options: ApiRequestOptions): Promise<Response> {
  const abortController = new AbortController();
  let vencido = false;
  const timeout = setTimeout(() => {
    vencido = true;
    abortController.abort();
  }, options.timeoutMs ?? timeoutPorDefecto);

  const requestInit: RequestInit = {
    method: options.method ?? 'GET',
    headers: buildHeaders(options),
    // Sin esto el almacén nativo no manda las cookies de la sesión. Ver la cabecera.
    credentials: 'include',
    signal: abortController.signal,
  };
  if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);

  try {
    return await fetch(buildUrl(path, options.query), requestInit);
  } catch {
    // En React Native el aborto no siempre llega como `DOMException`: se distingue por la bandera.
    if (vencido) throw new ApiError('El sistema tardó demasiado en responder. Inténtelo otra vez.', 0, true);
    throw new ApiError('No hay conexión con el sistema. Revise su internet e inténtelo otra vez.', 0);
  } finally {
    clearTimeout(timeout);
  }
}

function enviar(
  path: string,
  options: ApiRequestOptions,
  repeticion: Repeticion = repeticionDe(options.method, options.headers),
): Promise<Response> {
  return conReintentos(() => performFetch(path, options), {
    repeticion,
    esSinRespuesta: (error) => error instanceof ApiError && error.status === 0,
  });
}

/** En una mutación, un desenlace sin respuesta del backend no es «falló», es «no se sabe». */
async function enviarConfirmando(path: string, options: ApiRequestOptions, repeticion?: Repeticion): Promise<Response> {
  if (!esMutacion(options.method)) return enviar(path, options, repeticion);
  let response: Response;
  try {
    response = await enviar(path, options, repeticion);
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) throw resultadoDesconocido(0, error.timedOut);
    throw error;
  }
  if (esRespuestaDePasarela(response)) throw resultadoDesconocido(response.status);
  return response;
}

// ---- Renovación --------------------------------------------------------------------------------

/** Tres desenlaces: «el backend no contestó» no puede acabar igual que «la sesión ya no vale». */
type Renovacion = 'renovada' | 'rechazada' | 'no-disponible';

let refreshPromise: Promise<Renovacion> | null = null;

async function tryRefreshSession(): Promise<Renovacion> {
  if (!refreshPromise) {
    const versionAtStart = sessionVersion;
    refreshPromise = (async () => {
      try {
        // Un refresco no se repite: si llegó, el backend ya rotó la cookie.
        const response = await enviar('auth/merchant/refresh', { method: 'POST', skipAuthRetry: true });
        if (esRespuestaDePasarela(response)) return 'no-disponible';
        const payload = await parseResponse<{ accessToken: string }>(response);
        if (versionAtStart !== sessionVersion) return 'rechazada';
        if (!payload || typeof payload.accessToken !== 'string' || !payload.accessToken) return 'rechazada';
        setAccessToken(payload.accessToken);
        return 'renovada';
      } catch (error) {
        return error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500)
          ? 'no-disponible'
          : 'rechazada';
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function recoverAfter401(tokenAtStart: string | null): Promise<Renovacion> {
  if (getAccessToken() && tokenAtStart !== getAccessToken()) return 'renovada';
  const outcome = await tryRefreshSession();
  return getAccessToken() && tokenAtStart !== getAccessToken() ? 'renovada' : outcome;
}

function handleRenewalFailure(outcome: Renovacion): void {
  if (outcome === 'no-disponible') {
    throw new ApiError('El servicio se está actualizando. Vuelve a intentarlo en unos segundos.', 503);
  }
  clearAccessToken();
  broadcastForcedLogout();
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const tokenAtStart = getAccessToken();
  const mutacion = esMutacion(options.method);
  const response = await enviarConfirmando(path, options);

  if (response.status === 401 && !options.skipAuthRetry) {
    const renovacion = await recoverAfter401(tokenAtStart);
    if (renovacion === 'renovada') {
      const retryResponse = await enviarConfirmando(path, options, mutacion ? 'unica' : undefined);
      return parseResponse<T>(retryResponse, mutacion);
    }
    handleRenewalFailure(renovacion);
  }

  return parseResponse<T>(response, mutacion);
}

// ---- Archivos ----------------------------------------------------------------------------------

export interface ArchivoDescargado {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
}

/**
 * Descarga un archivo autenticado (PDF, imagen de un comprobante) como bytes.
 *
 * Pasa por el mismo `fetch` que el resto —y no por una descarga nativa— porque es el único camino
 * que lleva las cookies de la sesión: el gateway lee de ahí la credencial de AtlasBackend.
 */
export async function apiArchivo(path: string, fallbackFileName: string, options: ApiRequestOptions = {}): Promise<ArchivoDescargado> {
  const tokenAtStart = getAccessToken();
  let response = await enviar(path, options);

  if (response.status === 401 && !options.skipAuthRetry) {
    const renovacion = await recoverAfter401(tokenAtStart);
    if (renovacion === 'renovada') response = await enviar(path, options);
    else handleRenewalFailure(renovacion);
  }

  if (!response.ok) {
    const payload = await readPayload<unknown>(response);
    throw new ApiError(extractErrorMessage(response, payload), response.status, false, false, extractErrorCode(payload));
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    fileName: fileNameFromDisposition(response) ?? fallbackFileName,
  };
}

/** Nombre propuesto por el servidor, saneado a algo que sólo puede ser un nombre de archivo. */
function fileNameFromDisposition(response: Response): string | null {
  const raw = response.headers.get('content-disposition');
  if (!raw) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(raw);
  if (!match?.[1]) return null;
  let candidato: string;
  try {
    candidato = decodeURIComponent(match[1]);
  } catch {
    candidato = match[1];
  }
  const seguro = [...candidato]
    .filter((char) => (char.codePointAt(0) ?? 0) > 0x1f && (char.codePointAt(0) ?? 0) !== 0x7f)
    .filter((char) => char !== '/' && char !== '\\')
    .join('')
    .replaceAll('..', '')
    .trim();
  return seguro ? seguro.slice(0, 255) : null;
}

/**
 * Una imagen autenticada (comprobante, QR subido) lista para `<Image source={{ uri }} />`.
 *
 * Es el `apiBlobUrl` de la web: allí devuelve una URL de blob porque `<img>` no puede mandar la
 * sesión. En el teléfono pasa lo mismo con `<Image>`, y no hay URL de blob: se devuelve un `data:`
 * con los bytes. No hace falta revocarlo; desaparece con el estado que lo guarda.
 */
export async function apiBlobUrl(path: string, options: ApiRequestOptions = {}): Promise<string> {
  const archivo = await apiArchivo(path, 'imagen', options);
  return `data:${archivo.contentType.split(';')[0]};base64,${bytesABase64(archivo.bytes)}`;
}

export function bytesABase64(bytes: Uint8Array): string {
  let binario = '';
  const TRAMO = 0x8000;
  for (let i = 0; i < bytes.length; i += TRAMO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TRAMO));
  }
  return btoa(binario);
}
