# Evidencia — el pase de movimiento, y el alta de un cliente nuevo en iOS

Primera corrida de la app en el **simulador de iPhone 17 Pro (iOS 26.5)**. Toda la evidencia
anterior de este repositorio se tomó en el emulador de Android, y eso resultó ser importante: dos
de los tres defectos de interfaz que aparecen aquí **solo se ven en iOS**.

Backend real: `AtlasBackend` en `localhost:53005` (Docker), motor de decisión en `:3020`. Ningún
dato de esta carpeta está simulado — el cliente `_id 6` existe en la base y se creó tecleando el
formulario en la app.

---

## 1. Lo que se venía a demostrar: el movimiento

| Archivo | Qué prueba |
|---|---|
| `00-antes-halos-y-desborde.png` | **Antes.** Los halos del fondo eran círculos con borde visible, y el paralaje sacaba el texto de las páginas vecinas encima de la que estabas leyendo |
| `02`–`05-bienvenida-*.png` | **Después.** Halos con degradado radial, cada página contenida en su marco, y el punto activo alargado siguiendo a la página |
| `32-carrusel-y-corte-de-marca.mp4` | El carrusel con los puntos atados al dedo y el corte de marca al pulsar «Crear mi cuenta» |

Las capturas fijas no demuestran movimiento: para eso está el vídeo. Se incluyen igualmente porque
lo de los halos y el desborde **sí** se ve parado.

## 2. Los tres defectos que encontró la corrida

### 2.1 La cabecera se metía debajo del reloj — `01-antes-cabecera-bajo-el-reloj.png`

`Screen` respetaba el área segura de abajo y **no la de arriba**. En Android no se nota porque la
ventana empieza bajo la barra de estado; en iOS el contenido va de borde a borde, así que en las
veinte pantallas que usan `Screen` el título se dibujaba sobre la hora y el botón de volver quedaba
cortado por la isla dinámica. Corregido en `src/ui/layout.tsx`; ver `06-registro-cabecera-corregida.png`.

Se comprobó que **no lo había introducido el pase de movimiento**: se guardaron los cambios con
`git stash`, se recargó el código anterior y el defecto seguía ahí.

### 2.2 Una franja negra entre el pie y el teclado — `07-teclado-sin-hueco.png`

`keyboardVerticalOffset` declaraba el área segura superior como desfase, pero esa vista **es** la
pantalla entera: el hueco reservado al teclado quedaba 59 px más alto que el teclado. Con el
formulario de registro abierto se veía una banda muerta y el formulario aplastado a un solo campo.

### 2.3 Un fallo del servidor que el usuario no puede ver

Al pulsar «Crear mi cuenta» con un error del backend, la app pinta el `ErrorState` **arriba del
todo del formulario**, a más de mil píxeles del dedo. Desde la pantalla se lee como que el botón no
hace nada. Está sin corregir: ver §5.

## 3. Alta de un cliente nuevo, de punta a punta

Tecleada en la app, contra la API real. Cliente `_id 6`, `pabliarca@gmail.com`, teléfono
`+591 76500122`, PIN de 4 dígitos.

| Archivo | Paso |
|---|---|
| `06`–`11` | Registro: datos, fecha con selector, teléfono con prefijo, PIN y las tres autorizaciones |
| `12-cuenta-creada.png` | Cuenta creada → verificación de contacto |
| `13`–`14` | SMS **no disponible** en local (no hay proveedor), y la app lo dice con claridad |
| `15`–`17` | Código por correo, recibido de verdad y tecleado |
| `18`–`19` | Contacto verificado: registro al 33 % |
| `20`–`22` | Situación económica → 50 % |
| `23`–`24` | Domicilio → 67 % |
| `28`–`31` | **Login**: sesión limpia, entrar con correo + PIN, y la sesión restaurada en el 67 % |

## 4. Dónde se detiene, y por qué

`26-camara-carnet.png` y `27-almacenamiento-no-configurado.png`.

La cámara del simulador **sí** dispara. Lo que falla es el destino: el backend responde
`503 DOCUMENT_STORAGE_NOT_CONFIGURED` porque `STORAGE_S3_*` está vacío en su `.env` y el perfil
`storage` de Compose (MinIO) no está levantado. Sin eso no hay carnet ni selfie, y sin identidad no
hay expediente que enviar, así que **las pantallas de la app autenticada no se pueden alcanzar por
este camino**.

Levantarlo tiene un matiz que conviene anotar antes de intentarlo: la URL firmada que el backend
devuelve la usa el **teléfono**, no el contenedor, así que el `endpoint` tiene que ser un nombre que
resuelvan los dos. `minio:9000` lo resuelve el contenedor y no el simulador; `localhost` al revés.

## 4-bis. El carnet y el motor de decisión: qué se comprobó

**El carnet de la app no pasaba por el motor de decisión.** Comprobado leyendo las dos rutas:

- Lo que llama la app: `documents/upload-url` + `identity-package`
  (`src/api/endpoints/onboarding.ts:183` y `:210`). Ese camino guarda la evidencia como
  `pending_review` y, si hay número de documento, encadena **SEGIP** — un proveedor externo, no el
  motor (`customer-identity-package.service.ts:247`).
- Lo que sí pregunta al motor: `POST /mobile/identity-verifications` (módulo `mobile-identity`), que
  manda las fotos en base64 al artefacto y **no guarda ninguna imagen**. La app **nunca lo llama**.

Al probar ese camino aparecieron tres cosas, ya resueltas:

1. **Nunca había podido funcionar.** `createPending` no asignaba `_created_at`, que es `NOT NULL`
   sin default: Sequelize valida antes de enviar, así que el trámite moría con un `409 CONFLICT`
   —que se lee como choque de índice único— antes de preguntarle nada al motor. Es el mismo defecto
   que ya se corrigió una vez en `subject-reference.service.ts`. Corregido en
   `mobile-identity.repository.ts`.
2. **El backend no tenía el motor conectado**: `DECISION_ENGINE_BASE_URL`/`API_KEY` no existían en su
   `.env` y el `docker-compose.yml` solo pasaba la URL de salud. Añadidas las variables y su paso por
   Compose, con la sal de sujeto que exige el arranque.
3. **El motor rechazaba la llave** (`401`): estaba en `AUTH_MODE=IDENTITY_PROVIDER`, que solo verifica
   tokens. Puesto en `IDENTITY_HYBRID`, el modo que su propio `.env` documenta para integraciones
   técnicas; el portal sigue entrando con su token.

Con eso, el carnet **sí** lo decide el motor. Prueba:

| | |
|---|---|
| Artefacto | `IDENTIDAD_CARNET_MOVIL` (id 322, `IDENTITY_POLICY`), versión 1 compilada, desplegada en DEV |
| Ejecución | `decision_execution` id **26**, `SUCCEEDED`, `business_outcome = REVISION_HUMANA`, 133 ms |
| Respuesta al móvil | `IN_REVIEW`, motivo `REQUIERE_REVISION`, parecido 0 |

El resultado es el correcto: se envió un PNG de 1×1 que no es ni un carnet ni una cara, y la política
lo mandó a revisión humana en vez de aceptarlo o rechazarlo a ciegas. Antes de esto el motor solo
había ejecutado decisiones de crédito.

**Lo que falta es la app**: conectar la pantalla del carnet a ese endpoint y consultar el estado en
bucle. Y hay que decidir una cosa de producto antes: `identity-package` exige al menos una evidencia
**almacenada** (`evidence: array().min(1)`), así que el expediente sigue necesitando el
almacenamiento de §4 aunque la decisión venga del motor.

## 4-ter. La tarjeta de confianza del alta

`33-tarjeta-confianza.png` y `34-tarjeta-confianza-abierta.png`.

Las cinco pantallas del alta explicaban lo que hacen con los datos en **una línea de letra pequeña
al final**, que se lee después de haberlos escrito, cuando ya no sirve de nada. Ahora hay una pieza
—`src/ui/trust-card.tsx`, con el contenido en `src/features/trust-copy.ts`— que lo dice dato por
dato en la misma pantalla donde se pide.

Tres decisiones que la sostienen:

- **Plegada.** Desplegada entera son quince renglones encima de un formulario. Plegada ocupa cuatro
  y deja ver de qué datos habla: la confianza no la da leer el texto, la da ver que está ahí.
- **La promesa es una etiqueta, no una frase.** `Cifrado`, `No se guarda`, `Nunca al comercio`. Un
  párrafo se salta; tres etiquetas con icono se reconocen. El «por qué» ocupa una línea, y si
  necesita dos es que explica el sistema en vez de contestar a la persona.
- **Nada que el backend no haga.** Cada etiqueta corresponde a un comportamiento comprobable —el
  número de carnet no se persiste, el teléfono se guarda cifrado y en claro solo quedan sus últimas
  cifras—, y el archivo de contenido lo documenta con el sitio donde ocurre.

Pendiente: es texto con implicaciones legales. Debería revisarlo quien firma la política de
privacidad, y a futuro salir de `GET /consent-documents/active` en vez de vivir en el bundle.

## 4-quater. La segunda tanda: lo que se cerró después

### El carnet YA pasa por el motor, desde la app

`40-tras-enviar.png`. La pantalla del carnet ahora hace dos cosas: guarda la evidencia en el
expediente (`identity-package`) y **le pregunta al motor** (`POST /mobile/identity-verifications`,
con las fotos en base64, que el motor no guarda). Prueba: `decision_execution` **27**,
`IDENTIDAD_CARNET_MOVIL` → `REVISION_HUMANA`, disparada desde el simulador y no con `curl`.

El veredicto se muestra en palabras de la persona —verificada, la revisa alguien, hay que repetir
las fotos— y un **rechazo no saca de la pantalla**: si se la devuelve al índice del registro, se
encuentra el paso en rojo sin las fotos delante para entender por qué.

### El almacenamiento de documentos, resuelto sin trucos

El carnet ya no se queda en `DOCUMENT_STORAGE_NOT_CONFIGURED`. Hacía falta separar **dos caminos a
la misma cosa**: el teléfono llega a MinIO por la IP de la máquina y el contenedor por el nombre de
servicio de su red —Docker Desktop no enruta la LAN del anfitrión, comprobado—. Se añadió
`STORAGE_S3_PUBLIC_ENDPOINT`: con él se **firman** las URLs que usa el teléfono, y el interno se
usa para **verificar** el objeto. Es el mismo patrón que en producción con un bucket detrás de CDN.

### El expediente: qué se llenaba y qué no

Se auditó sobre el alta real del cliente 6 contando filas por tabla. Lo que **sí** se llenaba:
perfil, contactos, dirección, consentimientos, eventos de estado, sesión y dispositivo. Lo que
**no**, y ahora sí:

| Señal | Antes | Ahora |
|---|---|---|
| `telemetry.permission_events` | **vacía** para todo cliente creado desde la app | cámara, ubicación y almacenamiento, consultados sin abrir ningún diálogo |
| `device_snapshots.is_rooted` | en blanco | se envía (`Device.isRootedExperimentalAsync`) |
| `customer_sessions.user_agent` | vacío en todas | `Atlas/0.1.0 (ios 26.5; …)` |
| Sesión al **entrar** | no existía: `startSession` estaba en la capa de API y no lo llamaba nadie | se abre al entrar y se cierra al salir |

Verificado con el alta del cliente 7 y el acceso del 6: sesión `9` con `auth_method: password` y su
agente, y tres filas de permisos para el 7.

### Domicilio: catálogo y enlace de Maps

`35-departamentos-catalogo.png`, `36-ciudades-por-departamento.png`. Departamento y ciudad salen de
un catálogo (`features/geografia.ts`) en vez de cuatro opciones fijas y un campo libre: lo que se
escribe a mano no se puede agrupar después. Y la ubicación admite **pegar un enlace de Google
Maps**, que es como la gente comparte una dirección aquí — funciona sin conceder GPS y sin estar en
el sitio, que es el caso de quien rellena el alta desde el trabajo.

### El código que vence

`41-cuenta-atras.png`. Antes decía «Vence a las 11:30» y ahí se quedaba: a las 11:31 seguía igual,
con el campo abierto invitando a teclear un código que el servidor ya no acepta. Ahora hay cuenta
atrás real, aviso de vencido, y los dos botones **intercambian su papel** —pedir otro pasa a ser la
acción principal—, porque gastar un intento en un código muerto acerca el bloqueo de la cuenta.

### El arranque

`38-arranque-animado.mp4`. El splash nativo es una imagen y no se puede animar: ahora se retira en
cuanto hay algo que dibujar y una capa con la misma marca sobre el mismo navy toma el relevo —el
cambio no se ve porque no cambia nada— y hace un solo gesto: entra, respira y atraviesa la cámara,
el mismo lenguaje que el corte de marca. Lleva una red de seguridad de seis segundos: un arranque
bloqueado no se distingue de una app rota.

El corte de marca pasó de 560 a **900 ms** repartidos al revés (380 cubrir / 520 atravesar): a la
velocidad anterior el zoom no daba tiempo a leerse y lo que quedaba era un destello verde.

## 4-quinquies. Integración con `dev`

Todo lo anterior está mezclado con `origin/dev` en los tres repositorios. Un solo choque, en
`bienvenida.tsx`: `dev` hizo que las páginas del carrusel vengan del servidor y aquí el punto
indicador pasó a ser animado. Se resolvieron las dos cosas —el punto animado, contando
`pasos.length` en vez de la constante del bundle—.

**Aviso para quien mezcle `dev`:** `test/e2e/loans/loan-book.spec.ts` falla con 17 casos por
`LoanSpendingService` sin registrar en el módulo de pruebas. Se comprobó en un árbol limpio de
`origin/dev`, sin nada local: **ya venía roto de allí**.

## 4-sexies. Los pendientes, cerrados

`43-selector-de-contactos.png`, `44-referencia-desde-la-agenda.png`.

| Pendiente | Cómo se cerró |
|---|---|
| La suite e2e de préstamos, rota en `dev` | El módulo de pruebas declaraba 4 servicios y el controlador ya pedía 8: Nest no llegaba a construirlo y fallaban las 17 antes de ejecutar ninguna. Además el doble de la ficha devolvía un préstamo **sin dueño**, y la comprobación de propiedad lo rechazaba con un 403 que parecía un permiso mal puesto. **361 suites, 3632 casos en verde** |
| La dirección exacta | El backend la esperaba ya cifrada por el cliente y esa pieza no existía. Ahora va en claro por TLS y **la cifra el servidor**, con el mismo sobre que el teléfono. Repartir una llave a cada teléfono es como una llave deja de serlo |
| Recuperar el PIN | El esquema exigía 10 caracteres para todos los actores, así que un cliente no podía recuperar su PIN de 4 dígitos más que convirtiéndolo en una contraseña que la app sigue llamando PIN. El servicio ya distinguía por actor; sobraba el mínimo del esquema |
| Contactos | Las referencias se tecleaban de memoria. Ahora se traen del **selector nativo**, que lee el contacto elegido y nada más. Permiso al pulsar el botón, nunca al arrancar: iOS pregunta una sola vez |
| Notificaciones | `device-tokens` existía y no lo llamaba nadie: la pantalla de avisos dejaba elegir canal y el push no tenía a dónde llegar. Ahora se pide permiso y se registra el dispositivo, y si el sistema lo tiene denegado la pantalla lo dice |
| El remitente | En producción ya no arranca con un buzón personal en `GMAIL_FROM_EMAIL` |

Queda **rotar el `GMAIL_REFRESH_TOKEN`**: se comprobó que no está en ningún fichero versionado de
ningún repositorio, pero apareció en una terminal y ese token permite enviar correo en nombre de la
cuenta. Eso se hace en Google, no aquí.

## 5. Lo que queda abierto

Los seis puntos que abría este informe **están cerrados**. Se dejan nombrados porque el cómo importa
más que el hecho:

1. ~~El error de envío es invisible~~ — `Screen` acepta ahora una referencia a su desplazamiento y
   `useScrollToError` lleva la vista arriba en el flanco, no en cada render: un error persistente que
   devolviera la vista al principio cada vez que alguien intenta leer otra cosa sería peor que el
   fallo original.
2. ~~El carnet no llama al motor~~ — lo llama, y el veredicto se enseña en palabras de la persona.
3. ~~La dirección exacta~~ — la cifra el **servidor**, con el mismo sobre que el teléfono. Cifrar en
   el móvil exigiría repartir una llave a cada teléfono, que es como una llave deja de serlo.
4. ~~`contacts` y `notifications`~~ — instalados, con binario nativo nuevo. El permiso de contactos
   se pide al pulsar el botón y se lee **un** contacto, el que la persona elige.
5. ~~El buzón del remitente~~ — sale como ATLAS, y producción ya no arranca con un buzón personal.
   Falta el alta del buzón con dominio propio, que es infraestructura.
6. ~~La recuperación en el modelo viejo~~ — pide un PIN de 4 dígitos, como el alta. El servicio ya
   aplicaba la regla por tipo de actor; lo que sobraba era el mínimo de 10 en el esquema.

Y dos que no estaban en la lista y aparecieron probando:

7. **El MRZ perdía el número por un glifo de más.** Una cédula a 445 px se leía entera y salía sin
   número de documento: el reconocedor devuelve `IDBOL1234567<<A4<<<…` —una `A` colada entre el
   relleno y el dígito de control—, el control queda corrido y el número se descarta. Corregido en el
   motor, con la corrección atada al control compuesto para que no pueda inventar un número por azar.
8. **El campo del PIN no tenía nombre.** Cuatro casillas sobre un `TextInput` oculto: un lector de
   pantalla anunciaba «Tu PIN» y después cuatro vistas mudas. Se descubrió porque era el único campo
   del alta que una prueba automatizada tenía que tocar por coordenada.

## 6. Cosas del entorno que hubo que arreglar para llegar hasta aquí

Ninguna era de la app:

- El contenedor de la API era del día anterior y seguía exigiendo contraseña de 10 caracteres,
  cuando el backend ya acepta el PIN de 4 dígitos desde `eda5b36`. Reconstruido.
- Faltaban **7 migraciones** por aplicar; la API nueva pedía columnas que la base no tenía.
- La app tenía en memoria un documento de consentimiento **retirado** servido por la API vieja; con
  la API al día aparecen los tres vigentes, con su texto.
