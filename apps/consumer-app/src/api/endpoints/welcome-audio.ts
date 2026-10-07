/**
 * La locucion de bienvenida. Espeja `AtlasBackend/src/modules/mobile-welcome-audio`.
 *
 * La genera el worker de audio del MOTOR DE DECISION con una plantilla de su catalogo
 * (`onboarding.welcome.named`), no la app y no el backend. Por eso hay tres llamadas y no una:
 * sintetizar una voz tarda segundos, asi que se encarga, se pregunta y se descarga.
 *
 * Aqui no se manda ningun dato —ni el nombre—. El backend lee el nombre del perfil del cliente
 * autenticado a proposito: si viajara desde el telefono, este endpoint seria un sintetizador de voz
 * de uso libre pagado por Atlas, y cualquiera podria poner cualquier frase en boca de la marca.
 */
import { request } from '../client';

/**
 * `UNAVAILABLE` NO es un error.
 *
 * Significa «hoy no hay saludo»: el worker esta apagado, la cuota se agoto, el motor no contesto.
 * La app entra en silencio y no ensena nada. Tratarlo como error pintaria una alerta encima de la
 * pantalla recien abierta por un detalle que nadie ha echado de menos.
 */
export type WelcomeAudioState = 'PENDING' | 'READY' | 'UNAVAILABLE';

export type WelcomeAudioView = {
  requestId: string;
  status: WelcomeAudioState;
};

export const startWelcomeAudio = () => request<WelcomeAudioView>('/mobile/welcome-audio', { method: 'POST' });

export const getWelcomeAudio = (requestId: string) => request<WelcomeAudioView>(`/mobile/welcome-audio/${requestId}`);

/** La ruta de los bytes. Se descarga con `expo-file-system`, no con `request`: no es JSON. */
export const welcomeAudioPath = (requestId: string) => `/mobile/welcome-audio/${requestId}/audio`;
