# Atlas — App del cliente final

Aplicación móvil nativa (iOS y Android) del **consumidor** de Atlas, la fintech BNPL boliviana.
Construida con Expo + React Native + TypeScript y conectada a `AtlasBackend`.

No cubre el portal del comercio ni las herramientas internas de operaciones.

- **Flujo completo y decisiones de diseño:** [`docs/flujo-cliente-final.md`](docs/flujo-cliente-final.md)
- **Mapa de rutas y contratos:** [`docs/mapa-de-rutas.md`](docs/mapa-de-rutas.md)
- **Verificación ejecutada:** [`docs/verificacion.md`](docs/verificacion.md)

---

## Qué hace

```
Crear cuenta → verificar contacto → perfil, economía, domicilio, documento, referencias
            → enviar a revisión → cuenta activa
            → escanear el QR del comercio → escribir el monto → Atlas evalúa
            → el comercio confirma → pagar el 60% al QR bancario del comercio
            → 3 cuotas cada 14 días, también al comercio
```

Atlas **no recibe** el dinero de la compra: registra la orden, la decisión, el calendario, la
instrucción y la evidencia. El pago va directo a la cuenta del negocio.

---

## Requisitos

| | |
|---|---|
| Node | 20 o superior |
| Android | Android Studio con un AVD, o un teléfono con depuración USB |
| iOS | macOS con Xcode (la app está preparada, no verificada en este entorno) |
| Backend | `AtlasBackend` corriendo y accesible desde el dispositivo |

---

## Puesta en marcha

```bash
npm install
cp .env.example .env      # ajusta la IP de tu equipo
npm run android           # compila e instala en el emulador o dispositivo
npm run ios               # solo macOS
```

`localhost` **no sirve** en el emulador: apunta al propio emulador. Usa la IP LAN de tu equipo
(`ipconfig` en Windows, `ifconfig` en macOS) en `EXPO_PUBLIC_ATLAS_API_URL`.

### Variables de entorno

Todas son `EXPO_PUBLIC_*` y quedan visibles en el bundle: **aquí no va ningún secreto**.

| Variable | Por defecto | Para qué |
|---|---|---|
| `EXPO_PUBLIC_ATLAS_API_URL` | `http://192.168.0.197:3105/api/v1` | Base de la API |
| `EXPO_PUBLIC_ATLAS_TENANT_ID` | `1` | Cabecera `x-tenant-id` |
| `EXPO_PUBLIC_ATLAS_TIMEOUT_MS` | `20000` | Tiempo máximo por petición |
| `EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE` | `sandbox` | Origen del dominio de compra: `sandbox` o `live` |
| `EXPO_PUBLIC_ATLAS_DECISION_SOURCE` | `backend` | Quien decide el credito: `backend` (AtlasBackend -> motor de decision) o `local` |

---

## Levantar el backend en local

Desde `AtlasBackend/`, con el override de desarrollo que vive en este repositorio:

```bash
ATLAS_DEV_HOST_IP=<tu-ip-lan> API_PUBLISH_PORT=3105 \
docker compose -f docker-compose.yml \
  -f ../AtlasFrontend/apps/consumer-app/tools/dev-backend/docker-compose.dev-channels.yml \
  --profile app up -d --build api minio minio-init
```

El override añade lo que al stack local le falta para recorrer el flujo completo, **sin modificar el
repositorio del backend**:

- proveedor `webhook` de SMS/WhatsApp apuntando al sumidero local, para poder leer el código de
  verificación **real** que el backend genera;
- MinIO como almacenamiento S3 compatible, sin el cual `documents/upload-url` responde
  `DOCUMENT_STORAGE_NOT_CONFIGURED`.

En otra terminal, el sumidero de códigos:

```bash
node tools/dev-backend/otp-sink.mjs      # GET http://localhost:4599/last
```

No inventa códigos: muestra el que el backend generó y envió. Solo para desarrollo.

---

## Comandos

```bash
npm run android     # compila e instala en Android
npm run ios         # compila e instala en iOS (macOS)
npm start           # solo el servidor de desarrollo
npm run typecheck   # TypeScript en modo estricto
npm test            # pruebas del dominio
```

---

## Estructura

```
app/                        rutas (Expo Router)
  (public)/bienvenida       marca y punto de entrada
  (auth)/                   ingreso y recuperación
  (onboarding)/             registro, verificación, perfil, economía,
                            domicilio, identidad, referencias, revisión
  (app)/(tabs)/             inicio · escanear · pagos · perfil
  (app)/compra/             monto y detalle de la compra
  (app)/pago/               QR bancario del comercio y evidencia
src/
  api/                      cliente HTTP, errores tipados, endpoints
  domain/                   dinero en centavos y política 60/40
  sandbox/                  motor del dominio de compra V3
  session/                  sesión y almacenamiento seguro de tokens
  device/                   huella de dispositivo y hashes
  features/                 traducción de contratos a lenguaje de producto
  theme/                    tokens de diseño
  ui/                       primitivas, campos y estructura de pantalla
tools/dev-backend/          utilidades de desarrollo del backend local
docs/                       especificación, rutas y verificación
```

---

## Origen de los datos

| Dominio | Origen | Estado |
|---|---|---|
| Identidad, onboarding, habilitación, notificaciones | **AtlasBackend real** | verificado extremo a extremo |
| Decisión de crédito de una compra | **AtlasBackend → AtlasDecisionEngineBackend** | cableado y probado en unitarias; ver `docs/verificacion.md` |
| QR interno, orden, commitment, calendario, instrucciones, evidencia | **Sandbox local** | el backend aún no implementa el dominio V3 |

### La decisión de crédito no la toma el teléfono

Con `EXPO_PUBLIC_ATLAS_DECISION_SOURCE=backend`, al escribir el monto la app llama a
`POST /customers/:id/credit-applications`. AtlasBackend proyecta las features del cliente, llama a
`AtlasDecisionEngineBackend` con ese payload y devuelve el expediente resuelto con su `executionId`,
que la pantalla de la compra muestra. La app **no puntúa ni aprueba**: solo manda monto y plazo.

Si el motor no responde, el backend deja la solicitud en revisión y la app **no cae al motor local**:
convertir una avería en una aprobación sería conceder crédito desde el teléfono.

El sandbox implementa las reglas del modelo adversarial V3 en TypeScript puro y **se declara de
forma visible en pantalla**. No hay datos simulados presentados como reales. Cuando el backend
exponga el dominio de compra, basta cambiar `EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE=live` y sustituir la
implementación del store: las pantallas no cambian.

---

## Problemas frecuentes

| Síntoma | Causa y salida |
|---|---|
| "Sin conexión" en el emulador | `EXPO_PUBLIC_ATLAS_API_URL` apunta a `localhost`. Usa la IP LAN. |
| `VERIFICATION_CHANNEL_UNAVAILABLE` | El stack no tiene proveedor de SMS/correo. Levanta el override y el sumidero. |
| `DOCUMENT_STORAGE_NOT_CONFIGURED` | Falta MinIO. Levanta `minio` y `minio-init` del override. |
| La subida del documento falla con 403 | La URL firmada venció (15 min). Vuelve a tomar la foto. |
| El emulador no aparece | `adb devices`; arranca el AVD antes de `npm run android`. |
