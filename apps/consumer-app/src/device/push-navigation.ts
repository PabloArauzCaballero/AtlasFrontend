/**
 * Tocar un aviso abre la pantalla que el aviso indica.
 *
 * ## El hueco que cierra
 *
 * Las campañas de notificación del ERP eligen a dónde lleva el aviso («Pagos y cuotas», «Pagar con
 * QR») y el servidor lo manda en `data.deepLink`. La app no escuchaba el toque: cualquier aviso abría
 * la app donde se hubiera quedado, y el enlace que operaciones eligió no llevaba a ningún sitio.
 *
 * ## Dos momentos distintos
 *
 * - **App abierta o en segundo plano:** llega un evento de respuesta y se navega en el acto.
 * - **App cerrada:** el toque ARRANCA la app y el evento ya pasó antes de que existiera el listener;
 *   por eso se consulta la última respuesta al montar. Sin esa consulta, el caso más común —la persona
 *   ve el aviso en el bloqueo y lo toca— sería justo el que no funciona.
 *
 * ## Qué se acepta
 *
 * Sólo rutas internas (`/pagos`), nunca una URL: el `data` de un push lo puede escribir cualquiera que
 * tenga el token del dispositivo, y abrir un enlace externo desde ahí sería un camino de phishing.
 */
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { cargarAvisos } from './avisos-modulo';
import { rutaDelAviso } from './ruta-del-aviso';

/**
 * Engancha la navegación por toque. Se monta una vez, dentro del árbol del router y sólo con sesión:
 * sin sesión, las rutas del área autenticada redirigen al ingreso y el enlace se perdería igual.
 */
export function useAbrirAvisoTocado(habilitado: boolean): void {
  const router = useRouter();
  const ultimoAtendido = useRef<string | null>(null);

  useEffect(() => {
    if (!habilitado) return;
    const Notifications = cargarAvisos();
    if (!Notifications) return;

    const atender = (respuesta: { notification: { request: { identifier: string; content: { data?: unknown } } } } | null) => {
      if (!respuesta) return;
      const id = respuesta.notification.request.identifier;
      if (ultimoAtendido.current === id) return;
      const ruta = rutaDelAviso(respuesta.notification.request.content.data);
      if (!ruta) return;
      ultimoAtendido.current = id;
      router.push(ruta as Href);
    };

    void Notifications.getLastNotificationResponseAsync()
      .then(atender)
      .catch(() => undefined);
    const suscripcion = Notifications.addNotificationResponseReceivedListener(atender);
    return () => suscripcion.remove();
  }, [habilitado, router]);
}
