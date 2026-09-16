/**
 * Trae la locucion de bienvenida y la deja lista para reproducir.
 *
 * ## Por que hay que descargarla y no basta con la URL
 *
 * El endpoint del audio exige sesion. Un reproductor nativo al que se le da una URL hace la peticion
 * por su cuenta, sin la cabecera de autorizacion y sin saber renovar el token cuando caduca: el
 * servidor responde 401 y el sintoma en el telefono es «no suena», sin nada en pantalla que lo
 * explique. Asi que los bytes se bajan aqui, con la sesion de la app, y al reproductor se le da un
 * archivo local.
 *
 * ## Por que en la cache
 *
 * Es un audio DERIVADO: se puede volver a pedir en un segundo y el motor lo sirve de su propia
 * cache sin sintetizar nada. Ocupar almacenamiento permanente en el telefono de alguien con un
 * saludo de tres segundos no se justifica.
 *
 * ## Por que todo termina en `null` y nunca en una excepcion
 *
 * Porque el saludo es un detalle y el login es lo importante. Cualquier fallo —worker apagado,
 * cuota agotada, red que se cae a la mitad, un disco lleno— tiene el mismo desenlace correcto:
 * entrar en silencio. Quien llama no tiene ningun `catch` que escribir.
 */
import { descargarConSesion } from '../device/archivos';
import { readAccessToken } from '../api/client';
import { apiConfig } from '../api/config';
import { getWelcomeAudio, startWelcomeAudio, welcomeAudioPath, type WelcomeAudioState } from '../api/endpoints/welcome-audio';

/**
 * Cuanto se espera a que la voz este lista.
 *
 * Ocho segundos repartidos en consultas cada 700 ms. El limite existe por lo que pasa DESPUES de
 * el: a los ocho segundos la persona ya esta mirando su saldo, y un saludo que llega entonces no es
 * una bienvenida, es una voz que arranca sola encima de la pantalla de inicio. Mas vale no decir
 * nada.
 *
 * Una locucion cacheada —el caso normal a partir de la segunda vez— llega en la primera consulta.
 */
const ESPERA_MS = 700;
const INTENTOS = 11;

export async function traerBienvenida(senal?: AbortSignal): Promise<string | null> {
  try {
    const encargo = await startWelcomeAudio();
    if (encargo.status === 'UNAVAILABLE') return null;

    let estado: WelcomeAudioState = encargo.status;
    for (let intento = 0; intento < INTENTOS && estado === 'PENDING'; intento += 1) {
      if (senal?.aborted) return null;
      await esperar(ESPERA_MS, senal);
      if (senal?.aborted) return null;
      estado = (await getWelcomeAudio(encargo.requestId)).status;
    }
    if (estado !== 'READY' || senal?.aborted) return null;

    const token = await readAccessToken();
    if (!token) return null;

    /*
      El nombre del archivo lleva el identificador de la ejecucion.

      Dos personas distintas en el mismo telefono —el movil de una tienda, un dispositivo de
      pruebas— tienen dos saludos distintos, y un nombre fijo haria que la segunda oyera el de la
      primera. Ademas, el archivo del intento anterior se queda ahi y no molesta: la cache la
      vacia el sistema cuando le hace falta espacio.
    */
    return await descargarConSesion({
      url: `${apiConfig.baseUrl}${welcomeAudioPath(encargo.requestId)}`,
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': apiConfig.tenantId },
      nombre: `atlas-bienvenida-${encargo.requestId}.mp3`,
      reutilizar: true,
    });
  } catch {
    // Ver la cabecera: entrar en silencio es el desenlace correcto de cualquier fallo aqui.
    return null;
  }
}

function esperar(ms: number, senal?: AbortSignal): Promise<void> {
  return new Promise((resolver) => {
    const temporizador = setTimeout(resolver, ms);
    senal?.addEventListener(
      'abort',
      () => {
        clearTimeout(temporizador);
        resolver();
      },
      { once: true },
    );
  });
}
