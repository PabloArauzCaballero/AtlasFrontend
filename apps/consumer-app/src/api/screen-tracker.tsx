/**
 * Declara la pantalla abierta para que cada llamada al backend lleve su origen (`x-atlas-flow`).
 *
 * ## Por que en el render y no en un efecto
 *
 * El portal interno lo hace en un `useEffect`, y en la app eso llegaria tarde: React ejecuta los
 * efectos de los hijos ANTES que los del padre, asi que la primera carga de una pantalla nueva —que
 * sale del efecto de montaje de esa pantalla— viajaria con la ruta de la anterior. Atribuir una
 * llamada a la pantalla equivocada es peor que no atribuirla.
 *
 * Aqui se fija durante el render, y este componente va ANTES que la pila de navegacion: React
 * renderiza en orden de arbol, asi que cuando la pantalla nueva dispara su primera peticion la ruta
 * ya es la suya. Escribir en el render es aceptable porque es idempotente y en la app no hay render
 * de servidor que comparta el modulo entre peticiones.
 *
 * ## Lo que no resuelve
 *
 * Una pantalla que se queda montada debajo de la pila y sigue pidiendo datos en segundo plano se
 * atribuye a la que esta encima. Es raro en esta app y se acepta: la verificacion solo AFIRMA uso,
 * nunca lo niega, asi que el caso lleva a verificar de mas una pantalla que si esta abierta.
 */
import { usePathname } from 'expo-router';
import { setCurrentScreen } from './current-screen';

export function ScreenTracker(): null {
  setCurrentScreen(usePathname() || null);
  return null;
}
