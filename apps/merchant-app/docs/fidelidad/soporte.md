# Fidelidad · Soporte y tutoriales

Web (fuente de verdad, `AtlasERPFrontend` en `origin/dev`, leída el 2026-10-09):
`app/portal-comercio/soporte/page.tsx`, `components/screens/MerchantSupportScreen.tsx`,
`services/supportService.ts`, `components/tutorial/{TutorialCenter.tsx,tutorial-registry.ts,guia-pdf.ts}`,
`components/tutorial/guias/guias-portal.ts`, `components/tutorial/tours/tour-operacion.ts`.

App: `app/(app)/(tabs)/soporte.tsx`, `app/(app)/conversacion/[channelId].tsx` (ruta nueva),
`src/ui/soporte/*`, `src/features/soporte/*`, `src/api/servicios/supportService.ts` (`suscribirseAlChat` adaptado).

✓ = igual que la web. ≠ = difiere, con el motivo.

## Pantalla

| Web | App | |
|---|---|---|
| Título «Soporte y tutoriales»; «Habla con Atlas, sigue tus casos abiertos y repasa cómo se hace cada cosa.» | `ScreenHeader` | ✓ |
| Pestañas Soporte · Tutoriales en `?tab=` | `usePestana` + `BarraDePestanas` | ✓ |
| Cabecera: «Abrir un caso» y «Hablar con soporte» sólo en Soporte, apagados sin expediente | Al principio de la pestaña Soporte, mismas condiciones | ≠ la cabecera de la app lleva el avatar de la cuenta |
| Con una conversación abierta, la cabecera cambia a «Cerrar conversación» | La conversación es otra pantalla, con «Cerrar conversación» en su cabecera | ≠ ver «Conversación» |
| Expediente: `profiles[0]` | `useMerchantPartner` (aprobado primero) | ≠ regla común de la app; sin expediente se dice `SIN_EXPEDIENTE` (la web sólo apaga los botones) |
| — | Tirar hacia abajo recarga casos y motivos | ≠ añadido del teléfono |

## Pestaña Soporte

| Web | App | |
|---|---|---|
| Aviso ámbar con el error de la pantalla | `Aviso tono="warning"` | ✓ |
| Fallo del catálogo: «No pudimos cargar los motivos de soporte; puedes hablar igual y lo clasificamos nosotros.» | Igual | ✓ |
| Fallo de casos: «No pudimos cargar tus casos de soporte.» | Igual | ✓ |
| «Hablar con soporte» → paso «¿Sobre qué es?» / «Así te atiende quien más sabe del tema.» (sin catálogo, abre directo) | `HojaMotivos` (hoja inferior), misma regla | ✓ · ≠ panel → hoja |
| Motivo con submotivos baja un nivel; sin ellos abre la conversación con `categoryCode` | Igual | ✓ |
| «Ninguno de estos / prefiero contarlo» / «Abrimos la conversación y la clasificamos nosotros.» | Igual | ✓ |
| Abrir: `POST /support/channels`; `agentsAvailable === 0` → «No hay agentes libres ahora. Deja tu mensaje y te respondemos.»; fallo «No pudimos abrir la conversación.» | Igual; el aviso de sin agentes se ve en la pantalla de la conversación | ✓ |
| Modal «Abrir un caso» / «Cuéntanos qué pasa por escrito; lo seguimos desde tus casos.» | `HojaNuevoCaso` (hoja alta con teclado) | ✓ · ≠ modal → hoja |
| Motivo (árbol aplanado «Padre › Hijo», hint si no cargó), Título («Qué pasa, en una línea»), Descripción («Cuándo empezó, qué esperabas y qué pasó.»), tooltips | `SelectField` + `IconField` ×2, mismos rótulos, ejemplos y ayudas | ✓ |
| «Enviar el caso» apagado sin motivo, título < 3 o descripción < 10 | Igual, y dice qué falta (`blockedReason`) | ✓ · ≠ la web lo apaga sin explicar; un botón mudo en el teléfono se lee como roto |
| «Cancelar» | «Cancelar» (botón y equis de la hoja) | ✓ |
| Fallo: «No pudimos abrir el caso. Revisa el motivo y el título e inténtalo de nuevo.» | Igual, dentro de la hoja y en la pestaña | ≠ también en la hoja: el modal tapa la pestaña |
| Éxito: cierra, vacía y relee los casos | Igual | ✓ |
| Detalle del caso: título, «número · estado», Tipo, Dominio, Abierto, Última actividad, Primera respuesta («Todavía no»), Resuelto («Todavía no»), Resumen; «Cerrar el detalle» | `HojaDetalleCaso` con `KeyValue`, mismos rótulos | ✓ · ≠ panel → hoja |
| Fallo del detalle: «No pudimos cargar el detalle del caso.» | Igual | ✓ |
| «Mis casos» / «Cargando…» o «N caso(s)»; vacío «Todavía no abriste ningún caso. El botón de arriba abre una conversación.» | Igual | ✓ |
| Fila: título, «número · abierto el {fecha}», pastilla de estado (cerrado gris, resuelto verde, si no info), «Ver detalle», «Ver conversación» (si hay canal no CLOSED/ABANDONED) | Igual | ✓ |

## Conversación (`/conversacion/[channelId]`)

| Web | App | |
|---|---|---|
| Panel «Conversación» dentro de la pestaña | Pantalla propia, como el chat de la app del cliente | ≠ con el teclado abierto un chat dentro de una lista desplazable tapa el último mensaje |
| Descripción «En vivo» / «Reconectando…» | Subtítulo, mismo texto | ✓ |
| Carga la transcripción y marca leído el último | Igual | ✓ |
| Hilo SSE: `message.created` (sin duplicar por `sequence`, marca leído), `agent.typing` («Atlas está escribiendo…» 3 s), `message.read` (mueve el doble tic) | Igual (`efectoDelEvento`, probado) | ✓ |
| `channel.closed` no se trata | Aviso «Soporte cerró esta conversación» / «Si necesitas algo más, abre otra desde Soporte.» y se apaga el campo | ≠ texto nuevo: la conversación ocupa la pantalla y escribir a un canal cerrado sólo daría errores |
| Burbujas: propio = `PARTNER_USER`, del sistema centrado en ámbar, «Ocultamos un dato sensible por seguridad.», hora, «Enviado» / «Leído» | `Burbuja` con el dibujo del chat del cliente y esos textos | ✓ |
| Campo «Tu mensaje» («Escribe aquí…») + «Enviar»; «escribiendo» al primer carácter | `Compositor` (campo + botón redondo), mismo placeholder y nombre accesible; mismo aviso | ✓ · ≠ sin clip: el chat del comercio no admite adjuntos |
| Fallo de envío: devuelve el texto, «No pudimos enviar tu mensaje.» | Igual | ✓ · ≠ reintentar el mismo texto repite su `clientMessageId` (la web genera uno nuevo): en la red de un teléfono «falló pero llegó» es común y así no se duplica |
| `clientMessageId` `erp-…` | `merchant-app-…` (≤ 64, lo que acepta el backend) | ≠ para distinguir el canal |
| «Cerrar conversación» sin confirmar; fallo «No pudimos cerrar la conversación.» | Equis en la cabecera con confirmación; mismo fallo; al cerrar vuelve a Soporte, que relee los casos | ≠ en un teléfono la equis también se lee como «salir de la pantalla» |
| Fallo de carga «No pudimos cargar la conversación.» | Igual | ✓ |

### El stream en el teléfono

`suscribirseAlChat` hace lo mismo que la web (fetch con `Authorization: Bearer`, `Accept: text/event-stream`,
`x-correlation-id`, cabeceras de origen, el mismo parser con sus topes, reconexión a los 3 s, cierre con
`AbortController`). Diferencias, todas por el teléfono:

- URL con `buildUrl` (la base de la API), no `window.location`; `credentials: 'include'`.
- Usa el `fetch` global, que en Expo 57 es `expo/fetch` y devuelve el cuerpo como `ReadableStream`.
- Un 401 renueva la sesión (una lectura por `apiRequest`) antes de reintentar; sin token, reintenta (la web se rendía).
- Al pasar a segundo plano se CIERRA; al volver se relee la transcripción y se reabre (`use-hilo-en-vivo.ts`).
  Al salir de la pantalla también se cierra.

Probado con un `fetch` simulado (`__tests__/soporte/hilo-en-vivo.test.ts`); en TEST el endpoint
`/api/v1/support/channels/:id/stream` existe (401 sin token, 404 una ruta inventada). **No probado en un
dispositivo con una sesión real**: ver el informe.

## Pestaña Tutoriales (`TutorialCenter audience="merchant" embedded`)

| Web | App | |
|---|---|---|
| Tarjeta «Guía del portal, paso a paso» + detalle + «Descargar la guía en PDF» (`/guias/ATLAS-Guia-del-portal-del-comercio.pdf`) | Igual; se baja del origen del portal (TEST: 200 sin sesión) y se entrega por la hoja de compartir | ✓ · ≠ entrega |
| Casillas «Tu avance», «En progreso», «Pendientes», «Pantallas explicadas» | No están | ≠ miden el avance de recorridos interactivos, que en la app no existen (abajo) |
| Buscador «Buscar un tutorial...», filtros Módulo / Estado / Nivel, «Ningún tutorial coincide con estos filtros.» | No están | ≠ el catálogo del comercio es UN recorrido: filtrar una lista de uno no ayuda |
| Tarjeta del recorrido «Tu portal, de un vistazo» (Pendiente/…, «Portal del comercio», «Esencial», intro, «3 min · 3 pasos · Básico», «Comenzar»/«Continuar»/«Repetir») | Tarjeta con las etiquetas, la ficha y los TRES pasos escritos («Paso N de 3», título, texto, apunte) | ≠ **los recorridos de la web resaltan elementos del DOM y esperan un clic; en React Native no hay DOM**, y envolver los destinos de otras secciones en `TourTarget` (`@cliente/ui/tour`) acoplaría pantallas ajenas. Se porta el contenido para leer; sin estado de avance |
| Paso «menu», apunte «En el móvil el menú se abre con el botón de las tres rayas…» | «En la app, las secciones son las pestañas de abajo; tu cuenta está en el círculo con tus iniciales, arriba a la derecha.» | ≠ el texto de la web sería falso en la app |
| Paso «ayuda»: «Este botón, junto al título, abre la explicación…» (espera un clic) | «En la app, la explicación de cada pantalla está aquí abajo, en «Guías de cada pantalla»…» | ≠ en la app no hay botón «¿Qué es esto?» |
| Guías de pantalla (`GUIAS_PORTAL`, se abren con el botón junto al título de cada pantalla) | «Guías de cada pantalla»: las seis guías, plegadas (`Accordion`), con intro, secciones y apuntes LITERALES | ✓ texto · ≠ se leen aquí y no desde cada pantalla. La guía de Soporte dice «Los tutoriales recorren la aplicación de verdad… el botón junto al título…»: es el texto de la web y se deja literal |
