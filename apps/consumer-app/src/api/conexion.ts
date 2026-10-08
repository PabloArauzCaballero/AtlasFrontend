/**
 * ¿Hay conexión con Atlas? (Pablo, 2026-10-08: «si no hay internet debe salir el logo de Atlas dando vueltas»).
 *
 * La app no lleva un detector de red nativo y no se añade uno: tocaría el lockfile compartido y exigiría otro build
 * nativo. Se usa lo que ya existe. Cuando una petición falla por RED (no por un error del servidor), un sondeo a
 * `/health` confirma si de verdad no hay conexión antes de decirlo —un corte de un instante no debe tapar la pantalla—
 * y sigue preguntando hasta que vuelve. Cualquier respuesta del servidor, buena o mala, prueba que hay conexión.
 */
import { apiConfig } from './config';

/**
 * Interruptor del sondeo. Apagado en pruebas: las del cliente HTTP cuentan las llamadas a `fetch`, y un sondeo de fondo
 * las descuadraría. La prueba de este archivo lo enciende.
 */
export const sondeo = { activo: process.env.NODE_ENV !== 'test' };

/** Cada cuánto se vuelve a probar mientras no hay conexión. */
export const ESPERA_SONDEO_MS = 4_000;
const PLAZO_SONDEO_MS = 5_000;

type Escucha = (sinConexion: boolean) => void;

const estado = { sinConexion: false, sondeando: false };
const escuchas = new Set<Escucha>();
let temporizador: ReturnType<typeof setTimeout> | null = null;

function cambiar(sinConexion: boolean) {
  if (estado.sinConexion === sinConexion) return;
  estado.sinConexion = sinConexion;
  escuchas.forEach((escucha) => escucha(sinConexion));
}

export function haySinConexion(): boolean {
  return estado.sinConexion;
}

export function escucharConexion(escucha: Escucha): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

/** Una prueba barata: ¿contesta el servidor? Cualquier respuesta HTTP cuenta como conexión. */
export async function sondear(fetcher: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController();
  const plazo = setTimeout(() => controller.abort(), PLAZO_SONDEO_MS);
  try {
    await fetcher(`${apiConfig.baseUrl}/health`, { method: 'GET', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(plazo);
  }
}

/** Lo llama el cliente HTTP cuando una petición no llegó al servidor. */
export function avisarFalloDeRed(fetcher: typeof fetch = fetch): void {
  if (!sondeo.activo || estado.sondeando) return;
  estado.sondeando = true;
  const probar = async () => {
    const hay = await sondear(fetcher);
    if (hay) {
      estado.sondeando = false;
      temporizador = null;
      cambiar(false);
      return;
    }
    cambiar(true);
    temporizador = setTimeout(() => void probar(), ESPERA_SONDEO_MS);
  };
  void probar();
}

/** Lo llama el cliente HTTP con cualquier respuesta del servidor: hay conexión. */
export function avisarRespuesta(): void {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  estado.sondeando = false;
  cambiar(false);
}

/** Sólo para pruebas: vuelve al estado inicial. */
export function reiniciarConexion(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  estado.sinConexion = false;
  estado.sondeando = false;
  escuchas.clear();
}
