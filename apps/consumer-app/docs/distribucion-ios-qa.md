# Distribución interna de Atlas en iPhone (QA sin TestFlight)

El tester instala **una vez** una build real de Atlas (mismo runtime nativo que producción: escáner de
documentos, mapas, ubicación en segundo plano, contactos, push, Face ID) y recibe después los cambios
de JavaScript por **EAS Update**, sin reinstalar.

```
 dev ──► ¿qué cambió?
          ├─ JS / TS / assets ──► npx eas-cli update --channel preview --environment preview -m "…"
          │                                     │
          │                                     ▼
          └─ nativo (ver tabla) ─► npx eas-cli build -p ios --profile preview ─► nueva IPA (enlace/QR)
                                                │
                              iPhone A · B · C  ◄┘   (Atlas instalada, canal `preview`)
```

Perfiles (`eas.json`):

| Perfil | Para quién | Distribución | Canal | Entorno EAS |
|---|---|---|---|---|
| `preview` | testers | interna (ad-hoc, por UDID) | `preview` | `preview` |
| `production` | App Store / TestFlight | tienda | `production` | `production` |
| `development` | desarrolladores (Metro) | interna + cliente de desarrollo | `development` | `development` |
| `simulador-ios` | simulador | interna | `preview` | `preview` |

`preview` **no** es un cliente de desarrollo: no pide Metro ni Expo Go y no muestra menús de dev.

## Backend que ven los testers

`https://atlas.consumerweb.test.arauzsoftware.com/api/v1` (TEST en Contabo). Verificado el 2026-09-30:
certificado Let's Encrypt válido, `GET /api/v1/health` → 200 `"service":"atlas-backend"` desde una red
sin Tailscale. Es el mismo que usa `production` (TestFlight), y `preview` lleva **exactamente las mismas
variables** que `production` (lo comprueba `__tests__/eas-distribucion.test.ts`).

El Tailnet (`pablo-h310.taila8f993.ts.net`) que tenía `preview` **no** es alcanzable fuera del Tailnet.
Ya no se usa. Para cambiar de backend se cambia solo `EXPO_PUBLIC_ATLAS_API_URL` (eas.json **y** entorno
EAS, ver «Variables»), sin tocar código.

## Tester nuevo (una vez por iPhone)

1. Developer: `cd apps/consumer-app && npm run qa:device` (`eas device:create`). Da una URL/QR.
2. Tester: abre la URL **en Safari del iPhone**, instala el perfil de configuración que ofrece y lo
   acepta en Ajustes → General → VPN y gestión de dispositivos. Eso registra su UDID.
3. Developer: el UDID debe estar dentro de la build. Dos caminos:
   - **Nueva build:** `npm run qa:build:ios` (regenera el perfil de aprovisionamiento con todos los
     dispositivos registrados; EAS pregunta si lo actualiza).
   - **Sin recompilar:** `npx eas-cli build:resign -p ios --source-profile preview --target-profile preview`
     re-firma una build existente con el perfil ad-hoc actualizado. Límites: solo cambia la firma
     (no el código nativo ni las variables de la build), la build elegida debe ser una `preview` ya
     terminada, y el perfil debe haberse actualizado antes con los nuevos dispositivos
     (`npx eas-cli credentials -p ios`). Si dudas, recompila.
4. El tester abre el enlace de la build (página de EAS o QR) en el iPhone e instala Atlas.
5. Desde ahí recibe los updates. La app consulta EAS Update al abrirse (default de `expo-updates`:
   `checkAutomatically: ON_LOAD`); el update descargado se aplica al **siguiente arranque en frío**.

Límites de Apple: ad-hoc admite **100 dispositivos por año** de membresía. Instalar la build interna en
un iPhone que tenga la de TestFlight la reemplaza (mismo bundle id `bo.atlas.consumer`; los datos
locales se pierden).

Para CI futuro, `eas build --refresh-ad-hoc-provisioning-profile` (o `--non-interactive` con el perfil
ya al día) regenera el perfil sin preguntar. No está activado: hoy no hay CI de builds.

## Developer

```bash
cd apps/consumer-app
npm run verify                       # typecheck + lint + tests (antes de publicar)
npm run qa:doctor                    # eas.json ↔ entorno EAS «preview», luego expo-doctor

# Cambios de JS/TS/assets
npx eas-cli update --channel preview --environment preview --message "fix: corregir validación de documento"

# Cambios nativos (o cuando cambie la versión de app.json)
npm run qa:build:ios

# Quién está registrado / estado
npm run qa:devices                   # (pide equipo Apple 7A42TVN3Y6)
npx eas-cli build:list --platform ios --limit 5
npx eas-cli channel:view preview
npx eas-cli update:list --branch preview
```

`--environment preview` es obligatorio en SDK 57 y hace que el update lea **las variables del entorno EAS**
y no el `.env` local. Nunca publiques con `--channel production` desde este flujo.

### Cuándo update y cuándo build

| Cambio | EAS Update | Build nueva |
|---|:-:|:-:|
| Texto, estilos, pantallas, hooks, validaciones TS | ✅ | ❌ |
| Endpoint / URL de API (variable pública) | ✅ (actualizando el entorno EAS primero) | ❌ |
| Librería **solo JS** (sin Swift/Kotlin/pods) | ✅ | ❌ |
| Assets normales | ✅ | ❌ |
| Paquete con código nativo, `expo-*` nuevo | ❌ | ✅ |
| Plugin de Expo / `plugins` de app.json | ❌ | ✅ |
| Permisos o `infoPlist` (p. ej. ubicación) | ❌ | ✅ |
| Cualquier campo nativo de app.json / app.config.js | ❌ | ✅ |
| Subir SDK de Expo / React Native | ❌ | ✅ |

**`runtimeVersion` usa `policy: appVersion`**: protege por el campo `version` de `app.json` (hoy `1.0.0`),
no por el contenido nativo. Consecuencia: si cambias el runtime nativo y **no** subes `version`, un
`eas update` llegaría a builds viejas y podría romperlas. Regla: **todo cambio nativo lleva subida de
`version`** (y build nueva). Comprobación objetiva contra la build que tiene el tester:

```bash
npm run qa:native-check -- <BUILD_ID>     # eas fingerprint:compare: sin diferencias ⇒ el update es seguro
```

(No se cambió a `fingerprint` para no alterar el runtime de las builds ya instaladas y de TestFlight.)

Por eso este flujo **no** añade `expo-application`: es un módulo nativo nuevo y un update que lo importara
rompería las instalaciones actuales. La versión/build se lee con `expo-constants` + `expo-updates`.

Nota: `expo-doctor` ya falla en `dev` sin estos cambios en 3 comprobaciones (esquema de `app.json` por
`newArchEnabled`/`splash`, `react` duplicado entre workspace y app, y parches de SDK 57 desfasados). No las
introduce este flujo; conviene arreglarlas aparte antes de tratar el doctor como puerta.

## Diagnóstico para el tester

Perfil → Ayuda → **Versión de la app**: muestra `Atlas 1.0.0 (build) · canal · update xxxxxxxx`; al tocarla
se ve el bloque completo (runtime, canal, origen del código, id y fecha del update) con botón **Copiar**
para pegarlo en el reporte. No incluye datos de la cuenta. Código: `src/device/version-app.ts`.

## Variables

| Variable | Tipo | Dónde vive |
|---|---|---|
| `EXPO_PUBLIC_ATLAS_API_URL`, `_TENANT_ID`, `_TIMEOUT_MS`, `_PURCHASE_SOURCE`, `_DECISION_SOURCE`, `_ESCANER_DOCUMENTO` | PUBLIC (van dentro del bundle) | `eas.json` (builds) **y** entorno EAS `development/preview/production` (updates) |
| `EXPO_PUBLIC_WEB_BASE_URL` | PUBLIC, solo web | `.env` / Docker |
| `ANDROID_MAPS_API_KEY` | SENSITIVE, BUILD-ONLY (Android) | secreto de EAS, nunca `EXPO_PUBLIC_*` |
| Credenciales Apple / APNs | SECRET | credenciales de EAS |

Hay una duplicación deliberada: el `env` de `eas.json` (lo que ya usaban los builds y protege de builds
sin `.env`) y el entorno EAS (lo que lee `eas update --environment`). Se cambian **juntos**; `npm run
qa:doctor` (`scripts/check-eas-env.mjs`) falla si difieren. Cambiar una variable:

```bash
npx eas-cli env:set preview --name EXPO_PUBLIC_ATLAS_API_URL --value https://… --visibility plaintext --non-interactive
# y el mismo valor en eas.json → build.preview.env (y production/development si aplica)
```

## Escáner de documentos en preview

`EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO=true` en `preview` (antes `false`). El contrato
(`captureSource` por evidencia y `documentCaptureSource` del anverso; esquemas `.strict()`) está en
`AtlasBackend` `origin/dev` y `origin/test` (`mobile-identity`) y `production` (TestFlight) ya lo manda
contra este mismo backend TEST. El simulador queda en `false` (no tiene cámara de documentos).

## Paridad preview ↔ production

Cámara, escáner (VisionKit), mapas (Apple Maps), contactos, ubicación en uso y en segundo plano, push
(`expo-notifications`), SecureStore, Face ID, QR, API TEST y EAS Update: iguales. Solo difieren el canal
(`preview`/`production`), el tipo de distribución (ad-hoc/tienda) y el entorno EAS.

## Pendientes que dependen de infraestructura

- Ningún iPhone está registrado aún en el equipo Apple (`device:list` vacío): hace falta el primer
  `qa:device` antes de la primera build ad-hoc.
- Push en build ad-hoc: requiere la clave APNs cargada en las credenciales de EAS
  (`npx eas-cli credentials -p ios`); se verifica en el primer teléfono.
