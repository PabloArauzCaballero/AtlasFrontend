# La app en el navegador

La misma app, exportada con Expo Web. Las 42 rutas son las del teléfono, con el mismo cableado a
`src/api` y el mismo sandbox de compra; lo que cambia es lo que rodea a la columna de contenido y
lo que el navegador no puede hacer.

## Correr y construir

```bash
# desarrollo, con recarga
npm run web                                   # expo start --web

# como en el despliegue: SPA + proxy de /api/v1 al backend local (sin CORS)
EXPO_PUBLIC_ATLAS_API_URL=/api/v1 npx expo export --platform web
node tools/web-local-server.mjs 8790          # http://localhost:8790 · /api/v1 → localhost:53005

# la imagen que despliega Coolify (desde la RAÍZ del monorepo)
docker build -f apps/consumer-app/Dockerfile.web -t atlas-consumer-web .
docker run -p 8791:8080 -e ATLAS_API_ORIGIN=http://host.docker.internal:53005 atlas-consumer-web
```

`app.json` → `web.output: "single"`: una sola página; expo-router resuelve la ruta en el navegador y
nginx devuelve `index.html` para cualquier camino (`nginx.web.conf`). Las `EXPO_PUBLIC_*` se hornean
en el bundle; la base de la API es **relativa** (`/api/v1`) y nginx la reenvía a `$ATLAS_API_ORIGIN`,
que se fija por entorno. Así no hay CORS y la misma imagen sirve en cualquier dominio.

## Verificar

```bash
# abre las 42 rutas con un cliente real, en uno o varios anchos, y deja informe + capturas
PLAYWRIGHT_DIR=<ruta a node_modules/playwright> node e2e-web/humo.mjs --correo … --pin … --anchos 390,768,1280

# los cuatro flujos de Maestro (bienvenida, alta, ingreso, soporte), dando por bueno cada paso por la
# respuesta del servidor
PLAYWRIGHT_DIR=… node e2e-web/flujos.mjs --correo … --pin …
```

Un cliente de prueba aprobado se obtiene con `tools/dev-backend/recorrido-completo.mjs`.

CI exporta la web en cada push (`.github/workflows/ci.yml`, job `web`): `tsc` no ve lo que rompe
sólo en web, el export sí.

## Los tres anchos (`src/ui/responsive.ts`)

| Tramo | Desde | Qué cambia |
|---|---|---|
| teléfono | 0 | nada: es la app |
| tableta | 600 px | aire a los lados de la columna de 560 px; las hojas se estrechan y se redondean |
| escritorio | 1024 px | las cinco pestañas pasan a un carril lateral de 220 px |

## Lo que el navegador no hace, y cómo se dice

| Pieza | En el teléfono | En el navegador |
|---|---|---|
| Sesión | Keychain / EncryptedSharedPreferences | `localStorage` del origen (`session/token-storage.web.ts`) |
| Permisos de arranque | pantalla propia antes de la bienvenida | se salta: no hay agenda ni ubicación continua |
| Cámara (QR, carnet, selfie) | nativa | `getUserMedia` vía `expo-camera` web; el QR con `BarcodeDetector`. **Exige HTTPS** |
| Archivos (carnet, extracto, foto de soporte) | `expo-file-system` | `fetch` de la URL `blob:`/`data:` (`device/archivos.ts`); expo-file-system es una cáscara en web |
| Informe de gastos | hoja de compartir | descarga |
| Voz de bienvenida | archivo en caché | `blob:` en memoria; sólo suena tras un gesto (el navegador lo exige) |
| Avisos push | FCM / APNs | no hay; la pantalla lo dice y no pinta un interruptor |
| Agenda | selector del sistema | sólo entrada manual (`HAY_SELECTOR_DE_CONTACTOS`) |
| Mapa del domicilio | `expo-maps` | dirección en texto |
| Rastreo en segundo plano | `expo-task-manager` | no existe |
| Fecha de nacimiento | selector nativo | `<input type="date">` |
| Secuencia de marca | en cada arranque | una vez por pestaña (`sessionStorage`) |

## Despliegue

`docker-compose.coolify.yml` en la raíz del monorepo (contexto de build: la raíz, donde vive el
lockfile). Coolify pone el dominio; `ATLAS_API_ORIGIN` apunta al backend de la misma red `coolify`
(`http://atlas-backend:3005` por defecto). «Desplegado» se comprueba por contenido: `GET /` con
`<title>Atlas</title>`, `GET /api/v1/health` por el proxy con `"service":"atlas-backend"`, y un
ingreso real hasta el inicio. La cámara y la ubicación sólo funcionan con HTTPS.
