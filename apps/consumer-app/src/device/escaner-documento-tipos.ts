/**
 * Lo que devuelve el escaner de documentos, en cualquier plataforma.
 *
 * Vive aparte para que `escaner-documento.ts` (nativo) y `escaner-documento.web.ts` exporten
 * exactamente la misma forma sin que la web tenga que mirar el fichero nativo, que es el unico que
 * conoce la libreria.
 */

/**
 * Por que no hay escaner aqui. **No es un error para la persona**: la pantalla cae sola a la
 * camara de la app, como antes de que existiera el escaner.
 *
 * - `expo_go`: Expo Go no trae el modulo nativo de la libreria.
 * - `web`: el navegador no tiene escaner del sistema (la web sigue con la camara de siempre).
 * - `sin_soporte`: el dispositivo no puede (simulador de iOS, binario sin el modulo nativo).
 * - `sin_play_services`: Android sin Google Play Services o sin poder descargar el modulo de ML Kit
 *   (Huawei, emuladores sin Play Store).
 * - `error`: el escaner se abrio o lo intento y fallo por otra causa; `detalle` lleva el mensaje.
 */
export type MotivoSinEscaner = 'expo_go' | 'web' | 'sin_soporte' | 'sin_play_services' | 'error';

export type ResultadoEscaneo =
  | { tipo: 'imagen'; uri: string; ancho: number; alto: number; origen: 'escaner_sistema' }
  | { tipo: 'cancelado' }
  | { tipo: 'no_disponible'; motivo: MotivoSinEscaner; detalle?: string };
