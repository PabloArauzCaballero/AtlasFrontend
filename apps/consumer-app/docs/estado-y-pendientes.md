# Estado del trabajo y pendientes

Documento de traspaso de la sesión del **2026-08-19**. Dice qué se construyó, qué se sembró, qué se
corrigió y qué queda por hacer, con el detalle suficiente para retomarlo sin volver a investigar.

---

## 1. Seeders creados

### `AtlasBackend` — `src/database/seeders/development/20260819100000-seed-producto-bnpl-desarrollo.ts`

**Qué siembra:** el producto de crédito `bnpl_atlas_estandar`, en estado `active`, moneda BOB,
importe financiado entre Bs 40 y Bs 4.000, plazo de 1 a 6 meses, interés 0 %.

**Por qué existe:** en toda instalación nueva `GET /customers/:id/credit-products` devolvía una
lista vacía y `POST /customers/:id/credit-applications` fallaba con `CREDIT_PRODUCT_NOT_FOUND`. El
dominio de crédito parecía roto cuando lo único que pasaba es que no había nada que ofrecer. Sin
este seeder **el flujo de compra no se puede recorrer en una máquina nueva**.

**Decisiones que conviene conocer:**

- Se siembra **activo**, no en `draft`. Un producto en borrador no se oferta, y dejarlo así
  reproduce exactamente el síntoma que el seeder viene a eliminar.
- La idempotencia es por `product_code` dentro del tenant, no por identificador: reejecutarlo sobre
  una base que ya lo tiene actualiza en lugar de duplicar, y no rompe las solicitudes existentes.
- El `ON CONFLICT` repite el predicado `WHERE _deleted = false` porque
  `ux_credit_products_tenant_code` es un índice **parcial**; sin el predicado Postgres no reconoce
  el conflicto y el `INSERT` revienta.
- El `down` **no borra** el producto si alguna solicitud lo referencia: lo pasa a `retired`. Borrarlo
  dejaría expedientes apuntando a una oferta inexistente, que es el estado que ninguna auditoría
  puede reconstruir.

**Rango, y por qué ése:** `min_amount`/`max_amount` acotan el importe **financiado** (el 40 %), que
es lo que la app envía como `requestedAmount`. Con el 60 % inicial encima, cubre compras de entre
Bs 100 y Bs 10.000 aproximadamente.

> Las condiciones comerciales son dato administrado por negocio. Este seeder **no** fija la oferta
> real: pone una coherente con el modelo BNPL para que exista algo que solicitar. En producción el
> catálogo lo da de alta operaciones por `POST /operations/credit/products`.

### Lo que deliberadamente NO se sembró: el cliente de demostración

**No se puede sembrar honestamente.** La elegibilidad no es una columna: es el resultado de un
expediente completo —contacto verificado, perfil, economía, domicilio, referencias, tres documentos
subidos al almacenamiento y **dos decisiones de operaciones**—. Un seeder que escribiera
`credit_eligibility_status = 'eligible'` produciría un cliente que la pantalla acepta y el dominio
rechaza, que es peor que no tener ninguno.

En su lugar hay un aprovisionador que recorre la API real:

```bash
node tools/dev-backend/otp-sink.mjs &        # el sumidero debe estar corriendo

ATLAS_ADMIN_PASSWORD='<la del admin interno>' \
node tools/dev-backend/provision-demo-customer.mjs \
  --email pabliarca@gmail.com --password '<contraseña>' --phone +59176543210 \
  --firstName Pablo --lastName Arauz
```

Cada paso va por su endpoint real, **incluido el código de verificación**, que se lee del sumidero
tal y como lo emitió el backend. El script aborta al primer paso que falla: seguir dejaría un
expediente a medias sin avisar.

**Clientes en esta base:**

| Cliente | Cómo se creó | Credenciales |
|---|---|---|
| `customerId 23` · Valeria Méndez | **Registro completo desde las pantallas** (2026-08-20) | `valeria.mendez@atlas.bo` |
| `customerId 22` · Pablo Arauz | Aprovisionador | `demo.presenta@atlas.bo` |
| `customerId 20` | Aprovisionador | `pabliarca@gmail.com` — **contraseña no registrada** |

El de Valeria es el que demuestra el producto: cada paso se tecleó en la app y se verificó contra
`GET /customer-onboarding/23/status`. Ver `verificacion.md` §5.

**Las contraseñas no están en el repositorio, a propósito.** Viven en el equipo que levanta el
entorno. Si no se saben, no se buscan: se aprovisiona otro cliente con
`tools/dev-backend/provision-demo-customer.mjs`, que tarda un minuto y recorre la API real.

---

## 2. El artefacto del motor de decisión

No es un seeder del repositorio, pero es estado que la base del motor necesita y conviene saber cómo
se creó, porque **sin él la decisión de crédito no funciona**.

El artefacto demo que trae el motor (`BNPL_CREDIT_DECISION`) exige **56 variables** de un contrato
que AtlasBackend no emite. Con el payload real responde `422`, y el cliente del backend lee el 422
como «la política dice que no»: un desajuste de contrato se le habría presentado al cliente como un
**rechazo de crédito**.

Se creó `ATLAS_BNPL_UNDERWRITING` (artefacto 7, versión 10, desplegado en PROD) con el contrato que
el backend sí emite: `requested_amount`, `requested_term_months`, `currency_code`, `product_code`,
`purpose_code`. Pasó por todo el gobierno del motor: compilación válida, suite de regresión
bloqueante **5/5**, dos aprobaciones de principales distintos y despliegue.

**Pendiente:** ese artefacto vive solo en la base local. Para que sea reproducible hay que llevarlo
al seeder del motor (`src/modules/seeding/data/`) o exportarlo como artefacto versionado. Ver §5.

---

## 3. Defectos corregidos

### `AtlasBackend` · `subject-reference.service.ts` — commit `7b66c5e`

`DecisionSubjectLinkModel` declara `_created_at` como `allowNull: false` y
`SubjectReferenceService.register()` nunca lo asignaba. **Sequelize valida antes de enviar la
sentencia**, así que el insert no llegaba a Postgres —donde la columna sí tiene `DEFAULT now()`—.

El síntoma no delataba la causa: emergía como `409 CONFLICT — La operación viola una restricción de
datos` sobre `POST /customers/:id/credit-applications`, que se lee como choque de índice único. En
la base no había ninguno, y `credit.decision_subject_links` estaba **vacía**: ningún cliente había
llegado nunca a tener una decisión.

### `AtlasConsumerApp` · `evidence-upload.ts` — el registro se clavaba en el paso del carnet

La app declaraba `image/jpeg` fijo al pedir la URL de subida y al firmar el paquete de identidad. El
formato, sin embargo, lo elige la cámara: `takePictureAsync({ skipProcessing: true })` devuelve JPEG
en la mayoría de dispositivos, pero el emulador de Android entrega **PNG**.

El backend compara la firma binaria del objeto contra lo declarado —`document-storage.service.ts`,
`matchesMagicBytes`— y devolvía `422 EVIDENCE_CONTENT_TYPE_MISMATCH`. Ningún cliente nuevo podía
pasar del carnet.

Lo que lo hacía difícil de ver desde la app: el hash **sí** cuadraba, porque lo que se sube es
exactamente lo que se lee del archivo. Solo fallaba la firma, y el 422 llegaba a la pantalla como
«Revisa los datos ingresados», que apunta a los campos de texto —lo único que el cliente sí había
escrito bien—.

Ahora el tipo se deduce leyendo los bytes: la extensión es un nombre, la firma es el archivo. Si no
es ni JPEG ni PNG se corta **antes** de subir, con «vuelve a tomarla», que es el único consejo
accionable en ese momento.

### `AtlasBackend` · `envelope-encryption.util.ts` — commit `b998158`

Las columnas de sobres cifrados son `BLOB` y el driver las devuelve como `Buffer`;
`decryptSecretEnvelope` asumía `string` y lanzaba `startsWith is not a function`. El llamador lo
interpretaba como «sobre ilegible», así que se veía como un código de verificación que nunca
llegaba, no como un fallo de cifrado.

### `AtlasConsumerApp` · grupos de ruta — commit `a524d06`

`(auth)` y `(public)` no existían como rutas por faltarles su `_layout.tsx`. Un grupo de Expo Router
sin layout se aplana al padre, así que los `Stack.Screen` de la raíz apuntaban a nombres inexistentes
y el aviso salía en cada arranque.

---

## 4. Cómo levantar todo desde cero

```bash
# 1. Motor de decisión (puerto 3200)
cd AtlasDecisionEngineBackend
docker compose -f docker-compose.yml -f docker-compose.no-gvisor.yml \
  -f docker-compose.host-expose.yml up -d migrate seed api worker

# 2. AtlasBackend (puerto 3105) — cableado al motor
cd ../AtlasBackend
ATLAS_DEV_HOST_IP=<tu-ip-lan> API_PUBLISH_PORT=3105 \
ATLAS_DEV_DECISION_ENGINE_URL=http://host.docker.internal:3200 \
ATLAS_DEV_DECISION_ENGINE_RUNTIME_KEY=<RUNTIME_API_KEY del motor> \
ATLAS_DEV_DECISION_ENGINE_MANAGEMENT_KEY=<MANAGEMENT_API_KEY del motor> \
ATLAS_DEV_DECISION_ENGINE_ARTIFACT=ATLAS_BNPL_UNDERWRITING \
ATLAS_DEV_ADMIN_PASSWORD='<la que quieras sembrar>' \
docker compose -f docker-compose.yml \
  -f ../AtlasFrontend/apps/consumer-app/tools/dev-backend/docker-compose.dev-channels.yml \
  --profile app up -d api minio minio-init

# 3. Sumidero de códigos de verificación
cd ../AtlasFrontend/apps/consumer-app && node tools/dev-backend/otp-sink.mjs &

# 4. Cliente de demostración habilitado
ATLAS_ADMIN_PASSWORD='<la misma>' node tools/dev-backend/provision-demo-customer.mjs \
  --email <correo> --password '<contraseña>' --phone <telefono>
```

**La contraseña del admin interno no está versionada.** Se siembra con `DEV_ADMIN_PASSWORD` en el
servicio `migrate`, y hay que borrar antes su fila de `SequelizeDataSeedersDevelopments` porque el
seeder es idempotente y si no, se salta.

### Compilar la app en Windows

La app **no compila desde su ruta dentro del monorepo**: CMake espeja la ruta absoluta de cada
fuente, y con `…\Atlas\AtlasFrontend\apps\consumer-app\node_modules\react-native-…` se pasa del
límite de 260 caracteres de Windows. Con el monorepo la ruta es **más larga que antes**, así que el
problema no desaparece: empeora. Hay que compilar desde una copia en una ruta corta; el
procedimiento completo está en [`verificacion.md`](verificacion.md) §3.

**Dos trampas que cuestan horas si no se saben:**

1. El `.env` **no llega al bundle de release**. `expo export:embed`, invocado por Gradle, no lo carga
   como sí hace `expo start`: el binario acaba con el valor por defecto de
   `src/api/config.ts`. Para un binario de release con otra dirección hay que cambiar ese valor por
   defecto o pasar la variable de otro modo. **Ver el TODO-3.**
2. Desde el emulador el backend responde por `10.0.2.2`, **no** por la IP LAN del anfitrión. En un
   teléfono real es al revés.

---

## 5. TODO — lo que queda pendiente

### TODO-1 · ~~Capturas del flujo de compra~~ `[HECHO]`

Recorrido completo capturado en `docs/evidence/`, del arranque al QR bancario, con el APK de
release instalado y el backend real detrás. Incluye las dos caras del mismo invariante: el motor
caído derivando a revisión (`06b`) y el motor vivo aprobando con su `executionId` (`08-calendario`).

El camino de **rechazo por QR revocado** también quedó capturado (`13-qr-revocado.png`): el escaneo
no abre sesión y la pantalla explica que el código fue dado de baja por seguridad. Es el invariante
R15 visto desde la pantalla.

**Cómo repetirlo** (5 minutos, con el stack arriba):

1. `node tools/dev-backend/host-port-bridge.mjs --listen 3106 --target 3105` — sin esto el
   emulador no alcanza la API publicada por Docker (ver TODO-3-bis y el propio script).
2. Compilar con `usesCleartextTraffic` y la URL apuntando a `http://10.0.2.2:3106/api/v1`.
3. Entrar con el cliente aprovisionado, pestaña **Escanear** → **Comercio válido** → monto → seguir.

**Aviso sobre el emulador**: el AVD `Pixel_2` con la imagen `android-37.0 google_apis_playstore_ps16k`
tiene la red rota (`ping` responde, ningún TCP prospera) y su SystemUI cae bajo carga. El AVD
`AtlasDemo` sobre `android-36`, con 2 GB y **el stack de ALO VIDA detenido**, sí funciona.

### TODO-8 · ~~Un boton bloqueado tiene que decir que falta~~ `[HECHO]`

El síntoma era el mismo en `registro` y en `identidad`: un placeholder con la **forma exacta del
valor** —`1996-04-12` en la fecha de nacimiento, `2031-03-10` en el vencimiento del carnet— hacía
ver la pantalla llena, y el botón se apagaba sin decir por qué.

Se arregló por los dos lados, porque hacían falta los dos:

1. `color.text.placeholder`: token propio, más apagado que el texto terciario. El ejemplo deja de
   competir con el dato.
2. `Button` acepta `blockedReason` y lo muestra **debajo** del botón, con su icono de aviso. Debajo
   y no dentro: dentro, la etiqueta cambiaría de longitud y el botón daría un salto cada vez que se
   completa un campo. El motivo viaja además como `accessibilityHint`, que antes no decía nada.

`src/ui/blocked.ts` centraliza la regla: **se nombra un solo motivo, el primero en el orden de la
pantalla**. Listar los cinco pendientes a la vez es un párrafo que nadie lee y que además se
contradice solo, porque cuatro dejan de ser ciertos en cuanto se escribe el primero. Va cubierto por
`__tests__/blocked.test.ts`.

Cubre las **12 pantallas** con botón bloqueable, no solo las dos citadas: registro, identidad,
domicilio, economía, referencias, revisión, verificar contacto, ingresar, recuperar (sus dos pasos),
escanear (código a mano), monto de compra y pago.

### TODO-2 · ~~Llevar el artefacto del motor a un seeder~~ `[HECHO]`

`ATLAS_BNPL_UNDERWRITING` ya no vive solo en la base local. Se sembró en
`AtlasDecisionEngineBackend`:

- `src/modules/seeding/data/atlas-underwriting.graph.ts` — el grafo y los casos como **datos puros**.
- `src/modules/seeding/data/atlas-underwriting.seed.ts` — artefacto, contrato de variables,
  compilado, filas relacionales del grafo, suite bloqueante en verde, aprobación con los dos roles
  de la separación de funciones y despliegue ACTIVO en los tres entornos.
- `test/atlas-underwriting-seed.spec.ts` — ejecuta los cinco casos **con el motor real**. Un seeder
  escribe los resultados que su autor cree que produce el grafo; si esa creencia es falsa, la base
  queda con una suite «en verde» que nadie ejecutó.

Va en el **bootstrap**, no en el mockup: sin él una instalación nueva se queda solo con el demo
`BNPL_CREDIT_DECISION` y su contrato de 56 variables, y toda decisión sale rechazada por un 422 que
el cliente del backend presenta como negativa de crédito.

### TODO-3-bis · ~~El APK de release no puede hablar HTTP en claro~~ `[HECHO]`

Era la causa de todos los «Sin conexión» que costaron horas. Android bloquea el tráfico en claro
desde `targetSdkVersion` 28 y solo el manifiesto de **depuración** declaraba
`usesCleartextTraffic`. Ninguna petición salía del binario de release, mientras `ping` respondía,
`nc` alcanzaba el puerto desde el mismo emulador y el backend contestaba desde el anfitrión.

`plugins/with-cleartext-when-http.js` concede el permiso **solo si la dirección configurada empieza
por `http://`**. No es un interruptor que alguien pueda dejar encendido: en cuanto la URL es
`https://`, el atributo desaparece del manifiesto. Verificado en los dos sentidos.

**Un intento fallido que conviene no repetir.** La primera versión restringía el permiso al host de
la API con un `network_security_config`. Parecía más estricto y **rompió la subida del carnet**: la
app no habla solo con la API, sino que sigue las **URLs firmadas hacia el almacenamiento de
objetos** que el backend le entrega, y ese host no se conoce al compilar. El fallo llegaba a la
pantalla como «Algo no salió bien», sin nada en los registros del servidor, porque la petición nunca
salía del dispositivo. Enumerar hosts no es viable cuando la app sigue direcciones que le dan; y en
un binario que ya apunta a un backend en claro, restringir por dominio no añade seguridad real.

### TODO-3 · ~~Que el `.env` llegue al bundle de release~~ `[HECHO]`

`expo start` carga los `.env`; el empaquetado de release lo lanza Gradle con `expo export:embed`,
donde esa carga no está documentada ni garantizada. El binario acababa con el valor por defecto del
código —una IP de desarrollo— aunque se hubiera compilado «con el `.env` de producción». No falla al
compilar: se descubre con la app instalada.

`app.config.js` lee ahora el `.env` de forma explícita y deja los valores en `extra.atlas`. El
plugin de Gradle de `expo-constants` serializa esa configuración en los assets **en cada
compilación**, así que viaja dentro del APK. `src/api/config.ts` consulta primero el entorno —para
que exportar una variable en la terminal siga mandando, también en CI— y después `extra`.

### TODO-4 · Dominio de compra V3 en el backend `[grande]`

`purchase_order`, `purchase_commitment` y `payment_schedule` no existen en AtlasBackend. Mientras
tanto el flujo de compra corre en el motor local de `src/sandbox` —que **se declara en pantalla**— y
`EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE` no puede ponerse en `live`.

### TODO-5 · Pruebas que faltan `[medio]`

1. ~~**E2E móvil** sobre app instalada~~ `[PARCIAL]` — hay tres flujos de Maestro en `e2e/`,
   corriendo sobre la app instalada y contra el backend real: bienvenida, alta completa e ingreso.
   El alta se detiene donde el servidor manda el código al correo, que no se puede automatizar sin
   un sumidero de correo; fingirlo probaría un recorrido que ningún cliente hace. Falta cubrir la
   compra y el pago.
2. **Mutación de cliente**: interceptar el tráfico y alterar `organizationId`, `posId`,
   `financedAmount`, `decisionId`. Hoy la app no los envía; falta demostrarlo contra el servidor.
3. **Concurrencia**: dos compras simultáneas que juntas exceden la línea; solo una debe confirmar.
4. **Regresión visual** por pantalla.
5. **Accesibilidad** con TalkBack y VoiceOver reales, y escala de fuente al máximo.

### TODO-6 · ~~iOS~~ `[HECHO]`

Ejecutado el 2026-08-22 en el simulador de iPhone 17 Pro (iOS 26.5), con binario nativo propio y
contra el stack real. La evidencia está en `docs/evidence/2026-08-22-movimiento-ios/`: 44 capturas y
dos vídeos, el alta completa de un cliente nuevo, el acceso, y el carnet decidido por el motor.

Y sirvió para lo que sirve probar en la otra plataforma: **dos defectos que solo se ven en iOS**. La
cabecera se metía debajo del reloj en las veinte pantallas que usan `Screen` —faltaba el área segura
superior, que en Android no se nota porque la ventana ya empieza bajo la barra de estado— y el hueco
del teclado quedaba 59 px más alto que el teclado. Los dos corregidos.

### TODO-7 · Higiene de credenciales de desarrollo `[bajo]`

- La contraseña del admin interno se siembra con `DEV_ADMIN_PASSWORD` y **no se escribe aquí**.
  Este repositorio es público: una contraseña en un documento acaba indexada, y da igual que sea «de
  desarrollo» el día que alguien la reutiliza en un entorno desplegado.
- En el motor se crearon dos credenciales de integración (`dev-qa-analyst`, `dev-risk-approver`)
  **insertándolas directamente en la base**, porque el motor exige separación de funciones y no
  expone endpoint para darlas de alta. Conviene un camino soportado para crearlas.
- ~~En `AtlasBackend` quedan **15 archivos locales sin commitear**~~ `[RESUELTO]` — el árbol de
  `AtlasBackend` está limpio y en `dev`.

---

## 6. Lo que sí quedó probado

La cadena completa, ejecutada dos veces y de forma reproducible tras un reinicio completo del
entorno:

```
status: "approved"    decisionMode: "decision_engine"    executionId: "3"
```

El motor guarda esa misma ejecución con el `requestId` del expediente del backend y el
`inputSnapshotJson` que el backend proyectó, así que la cadena se recorre en los dos sentidos. El
detalle está en [`evidence/traza-decision.md`](evidence/traza-decision.md) y el alcance exacto de lo
verificado —y de lo que no— en [`verificacion.md`](verificacion.md).
