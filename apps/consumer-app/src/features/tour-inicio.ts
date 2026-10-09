/**
 * El recorrido de la pantalla de inicio.
 *
 * Los tres pasos responden las preguntas que nadie escribe en un formulario pero que deciden si la
 * persona termina la compra: «¿cuanto puedo gastar de verdad?», «¿donde se paga esto?» y «¿el
 * dinero pasa por Atlas?».
 *
 * Vive fuera de la pantalla porque lo lanzan dos sitios —el inicio la primera vez, y Perfil cuando
 * alguien lo pide de nuevo—. Tener dos copias del texto garantiza que un dia digan cosas distintas.
 */
import type { TourStep } from '../ui/tour';
import { marca } from '../theme/tokens';

/** Clave de persistencia. Cambiarla vuelve a mostrar el recorrido a todo el mundo. */
export const TOUR_INICIO_KEY = 'inicio.v1';

export const TOUR_INICIO_TARGETS = {
  linea: 'inicio.linea',
  escanear: 'inicio.escanear',
  pagos: 'inicio.pagos',
} as const;

export const TOUR_INICIO_STEPS: TourStep[] = [
  {
    target: TOUR_INICIO_TARGETS.linea,
    icon: 'billetera',
    title: 'Esto es lo que puedes gastar hoy',
    // Se nombra la diferencia entre limite y disponible porque es la unica cifra de la pantalla que
    // se puede malinterpretar, y hacerlo termina en una compra rechazada en la caja del comercio.
    body: 'Tu disponible es lo que te queda libre ahora mismo: el límite aprobado menos lo que aún debes. Es la cifra que manda cuando compras.',
  },
  {
    target: TOUR_INICIO_TARGETS.escanear,
    icon: 'escanear',
    title: 'Comprar es escanear el QR del comercio',
    body: 'En la caja, escaneas su código y escribes el monto. Antes de confirmar nada te mostramos cuánto pagas hoy y cómo quedan tus cuotas.',
  },
  {
    target: TOUR_INICIO_TARGETS.pagos,
    icon: 'escudo',
    title: 'Tus cuotas se pagan al comercio',
    // Es el invariante del producto y la pregunta de confianza que trae todo el mundo. Si la app no
    // lo dice, lo deduce cada quien por su cuenta y casi siempre lo deduce mal.
    body: `${marca.nombre} nunca recibe tu dinero: cada cuota se paga al QR bancario del comercio donde compraste. Aquí te decimos cuál y cuándo.`,
  },
];
