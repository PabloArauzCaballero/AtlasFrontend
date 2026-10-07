/**
 * Los permisos del telefono, como PASO del alta (fase 3, seccion `device_permissions`).
 *
 * Es la misma pantalla que antes se abria al arrancar la app —el texto, las dos tarjetas, el «ahora
 * no» a la vista— con una diferencia: aqui hay sesion, asi que la decision se registra en el servidor
 * en el acto (`session.reactivarSeñales`) y el `nextStep` avanza. Decir que no tambien cierra la
 * seccion: lo que se exige es haber decidido, no haber concedido.
 *
 * Al terminar vuelve a la raiz, y la raiz manda al indice del registro: es la misma salida que tenia.
 */
export { default } from '../(public)/permisos';
