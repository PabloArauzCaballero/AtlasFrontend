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

**Cliente ya aprovisionado en esta base:** `customerId 20`, `pabliarca@gmail.com` /
`+59176543210`, estado `active`, `eligible: true`.

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
  -f ../AtlasConsumerApp/tools/dev-backend/docker-compose.dev-channels.yml \
  --profile app up -d api minio minio-init

# 3. Sumidero de códigos de verificación
cd ../AtlasConsumerApp && node tools/dev-backend/otp-sink.mjs &

# 4. Cliente de demostración habilitado
ATLAS_ADMIN_PASSWORD='<la misma>' node tools/dev-backend/provision-demo-customer.mjs \
  --email <correo> --password '<contraseña>' --phone <telefono>
```

**La contraseña del admin interno no está versionada.** Se siembra con `DEV_ADMIN_PASSWORD` en el
servicio `migrate`, y hay que borrar antes su fila de `SequelizeDataSeedersDevelopments` porque el
seeder es idempotente y si no, se salta.

### Compilar la app en Windows

`AtlasConsumerApp` **no compila desde su ruta actual**: CMake espeja la ruta absoluta de cada fuente
y con `Downloads\Entrypoint-GitHUb\Atlas\AtlasConsumerApp\node_modules\react-native-...` se pasa del
límite de 260 caracteres de Windows. Hay que compilar desde una copia en una ruta corta. El
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

### TODO-2 · Llevar el artefacto del motor a un seeder `[alto]`

`ATLAS_BNPL_UNDERWRITING` solo existe en la base local. Una instalación nueva del motor se queda con
el artefacto demo, cuyo contrato no coincide, y **toda decisión sale rechazada por un 422 de
contrato**. Hay que sembrarlo en `AtlasDecisionEngineBackend/src/modules/seeding/data/` siguiendo el
patrón de `demo-artifact.ts`, con su suite de regresión bloqueante.

### TODO-3-bis · El APK de release no puede hablar HTTP en claro `[alto]`

**Esta es la causa de todos los «Sin conexión» que costaron horas.** Android bloquea el tráfico en
claro para `targetSdkVersion >= 28`, y el manifiesto de release no declara
`android:usesCleartextTraffic="true"` — el de debug sí lo hace solo. El resultado es que **ninguna**
petición sale del binario de release contra un backend `http://`, y la app muestra «Sin conexión»,
que es exactamente lo que hay que enseñarle a alguien sin red.

Lo engañoso es que el diagnóstico apunta a todas partes menos aquí: `ping` responde, `nc` desde el
mismo emulador alcanza el puerto, el backend contesta desde el anfitrión, y aun así la app no
conecta. Se puede confirmar en un minuto mirando si las peticiones llegan al puente
(`host-port-bridge.mjs --verbose true`): si el log queda vacío, la petición **nunca salió del
dispositivo**.

Para probar en local hay que añadir el atributo al `<application>` de
`android/app/src/main/AndroidManifest.xml`. **No conviene dejarlo puesto para producción**: ahí la
API va por HTTPS y el bloqueo de tráfico en claro es una protección, no un estorbo. La forma limpia
es declararlo solo para el sabor de desarrollo —vía `expo-build-properties` o un
`network_security_config` restringido a la IP del backend local— en lugar de abrirlo en el
manifiesto principal.

### TODO-3 · Que el `.env` llegue al bundle de release `[medio]`

Hoy `EXPO_PUBLIC_ATLAS_API_URL` se ignora al compilar release por Gradle. El binario queda apuntando
al valor por defecto del código, que es una IP de desarrollo. **Esto es un riesgo de publicación**:
un release construido «con el `.env` de producción» saldría apuntando a una IP privada. Revisar cómo
`expo export:embed` carga el entorno en esta versión de Expo y fijarlo en el `build.gradle`.

### TODO-4 · Dominio de compra V3 en el backend `[grande]`

`purchase_order`, `purchase_commitment` y `payment_schedule` no existen en AtlasBackend. Mientras
tanto el flujo de compra corre en el motor local de `src/sandbox` —que **se declara en pantalla**— y
`EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE` no puede ponerse en `live`.

### TODO-5 · Pruebas que faltan `[medio]`

1. **E2E móvil** sobre app instalada (Maestro o Detox) para los flujos P0.
2. **Mutación de cliente**: interceptar el tráfico y alterar `organizationId`, `posId`,
   `financedAmount`, `decisionId`. Hoy la app no los envía; falta demostrarlo contra el servidor.
3. **Concurrencia**: dos compras simultáneas que juntas exceden la línea; solo una debe confirmar.
4. **Regresión visual** por pantalla.
5. **Accesibilidad** con TalkBack y VoiceOver reales, y escala de fuente al máximo.

### TODO-6 · iOS `[bloqueado por plataforma]`

Nada ejecutado: exige macOS con Xcode. El código no usa ninguna API exclusiva de Android.

### TODO-7 · Higiene de credenciales de desarrollo `[bajo]`

- La contraseña del admin interno se sembró como `AtlasDev-2026!local`. Cambiarla si molesta.
- En el motor se crearon dos credenciales de integración (`dev-qa-analyst`, `dev-risk-approver`)
  **insertándolas directamente en la base**, porque el motor exige separación de funciones y no
  expone endpoint para darlas de alta. Conviene un camino soportado para crearlas.
- En `AtlasBackend` quedan **15 archivos locales sin commitear** anteriores a esta sesión (seeders,
  `tenant.model.ts`, `tools/`, `envelope-encryption.util.ts`). No se tocaron.

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
