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

# la matriz responsiva: 13 anchos (320 → 2560), desborde, áreas táctiles, texto pequeño, y con
# --estados la hoja de ayuda, el selector y las tres vistas de pagos; --apaisado para el teléfono girado
PLAYWRIGHT_DIR=… node e2e-web/responsive.mjs --correo … --pin … --estados
```

Qué mide cada pasada y a qué anchos: [`RESPONSIVE_TEST_MATRIX.md`](RESPONSIVE_TEST_MATRIX.md). Cómo
está construido lo responsivo (tramos, contenedores, áreas táctiles en web):
[`RESPONSIVE_DESIGN_SYSTEM.md`](RESPONSIVE_DESIGN_SYSTEM.md).

Un cliente de prueba aprobado se obtiene con `tools/dev-backend/recorrido-completo.mjs`.

CI exporta la web en cada push (`.github/workflows/ci.yml`, job `web`): `tsc` no ve lo que rompe
sólo en web, el export sí.

## Los tres anchos (`src/ui/responsive.ts`)

| Tramo | Desde | Qué cambia |
|---|---|---|
| teléfono | 0 | nada: es la app, con su barra de pestañas |
| tableta | 600 px | la cáscara de la landing con la barra superior en DOS filas (marca, cuenta y acción; debajo el menú de los cinco destinos); aire a los lados de la columna de 560 px; las hojas se estrechan y se redondean |
| (panel lateral) | 940 px | en acceso y registro aparece la segunda columna (tarjeta 3D, cita, pasos) |
| escritorio | 1024 px | la barra superior en una fila con el menú en el centro; el área de cliente se compone en la rejilla de 12 columnas; la bienvenida es el hero de la landing |

El carril lateral de 220 px de las pestañas queda para tabletas nativas; en la web la navegación
desde 600 px es siempre la barra superior.

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
| Hash y UUID | `expo-crypto` | Sólo hay `crypto.subtle` y `crypto.randomUUID` en **contexto seguro** (HTTPS o localhost). En TEST, que va por HTTP plano, `expo-crypto` lanzaba y el alta moría antes del POST: `src/lib/criptografia.ts` da SHA-256 y UUID v4 con respaldo en JS |
| Secuencia de marca | en cada arranque | una vez por pestaña (`sessionStorage`) |

## La identidad web (la de la landing)

Desde 600 px la web deja de ser «el teléfono estirado» y toma la composición de `AtlasLandingPage`;
por debajo es la app, sin cambios. Todo vive en `src/web/` y se engancha a las primitivas por
atributos `data-atlas` (`webData()`), así que las 42 pantallas no se tocan:

| Pieza | Archivo | Qué es |
|---|---|---|
| Hoja de estilo | `web/estilo.ts` | Variables generadas desde `tokens.ts` con los nombres de `style.css`; botones píldora con brillo y elevación, campos con anillo de foco, tarjetas con hover, entradas subir+escalar+desenfoque, escala tipográfica fluida, rejilla de 12 columnas, `.auth`, `.acard`, `.hero`, `.nav` |
| Atmósfera | `web/Atmosfera.tsx` | Aurora, grano y malla, fijas detrás de todo (playbook §5) |
| Cáscara | `web/Cascara.tsx` | Barra superior con marca, píldora que persigue, chip de cuenta y «Escanear QR»; envuelve toda el área `(app)` |
| Acceso y registro | `(auth)/_layout.web.tsx`, `(onboarding)/_layout.web.tsx`, `web/PanelLateral.tsx` | Dos columnas como `login.html`/`registro.html`: formulario + tarjeta 3D, cita y cifras; en el registro, pasos y «lo que ya está» |
| Tarjeta 3D | `web/Tarjeta3D.tsx` | La `.acard` de la landing atada al puntero |
| Bienvenida | `web/HeroBienvenida.tsx` | El hero de `index.html` con la propia web a 390 px dentro del teléfono |
| Rejilla | `estilo.ts` («rejilla») + `Screen` | Cabecera a lo ancho, bloques alternando en dos columnas; los `Gap` no cuentan |

Regla dura: ningún color literal en `estilo.ts` (salen de `tokens.ts`); nada de esto se carga en iOS
ni Android; con `prefers-reduced-motion` la aurora se para y las entradas no animan.

## Despliegue

`docker-compose.coolify.yml` en la raíz del monorepo (contexto de build: la raíz, donde vive el
lockfile). Coolify pone el dominio; `ATLAS_API_ORIGIN` apunta al backend de la misma red `coolify`
(`http://atlas-backend:3005` por defecto). «Desplegado» se comprueba por contenido: `GET /` con
`<title>Atlas</title>`, `GET /api/v1/health` por el proxy con `"service":"atlas-backend"`, y un
ingreso real hasta el inicio. La cámara y la ubicación sólo funcionan con HTTPS.

**El proxy sigue al backend, no lo memoriza.** `nginx.web.conf` resuelve el destino con el DNS de
Docker (`resolver 127.0.0.11`) y lo pasa por una variable. Con el nombre escrito directamente en
`proxy_pass`, nginx lo resuelve UNA vez al arrancar: cada redespliegue del backend le daba una IP
nueva y la web contestaba **502 en `/api/v1` hasta reiniciarla** (medido en DEV el 2026-09-18).
Importa para verificar: un 502 del proxy no dice que la web esté mal desplegada, y en una prueba
automatizada se ve como un fallo de ingreso, no como un fallo de red.
