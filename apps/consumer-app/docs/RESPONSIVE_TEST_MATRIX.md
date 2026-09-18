# Matriz de pruebas responsivas de la web

Qué se prueba, con qué y a qué anchos. La herramienta es `e2e-web/responsive.mjs` (Playwright, el
mismo que `humo.mjs`); los resultados de la última pasada están en
[`RESPONSIVE_IMPLEMENTATION_REPORT.md`](RESPONSIVE_IMPLEMENTATION_REPORT.md).

## Anchos

| Categoría | Ancho | Tramo | Alto de la ventana en la prueba |
|---|---|---|---|
| Móvil muy pequeño | 320 | teléfono | 780 |
| Móvil pequeño | 360 | teléfono | 780 |
| Móvil estándar | 390 | teléfono | 780 |
| Móvil grande | 430 | teléfono | 780 |
| Borde tableta | 600 | tableta | 1024 |
| Zoom 200 % en portátil de 1280 | 640 | tableta | 1024 |
| Tablet vertical | 768 | tableta | 1024 |
| Borde del panel lateral | 940 | tableta (+ panel) | 1024 |
| Tablet horizontal | 1024 | escritorio | 900 |
| Laptop | 1280 | escritorio | 900 |
| Escritorio | 1440 | escritorio | 900 |
| Escritorio grande | 1920 | escritorio | 900 |
| Ultraancha | 2560 | escritorio | 900 |
| Teléfono apaisado | 844 × 388 (`--apaisado`) | tableta | 388 |

El zoom del navegador al 200 % se evalúa por su viewport equivalente (1280 → 640 px CSS): el `zoom`
de CSS no cambia `innerWidth` ni las `@media`, así que no reproduce el zoom real.

## Rutas

Las 36 rutas que abre `humo.mjs` (4 públicas, 22 del área de cliente, 10 del registro), con un
cliente real; las rutas con id llevan ids ficticios (`/pagar/1`, `/soporte/canal-demo`), así que
además de la composición se prueba el estado de error y el vacío.

## Qué se mide en cada apertura

| Medida | Umbral | Por qué |
|---|---|---|
| `scrollWidth > clientWidth` | 0 | `body{overflow-x:hidden}` esconde la barra, no el desborde |
| Elementos que asoman por la derecha sin ancestro que los recorte | 0 | son los que producen el desborde |
| Controles interactivos visibles con lado < 24 px | 0 (salvo el interruptor nativo) | WCAG 2.2 AA 2.5.8; en la web no hay `hitSlop` |
| Texto de contenido < 11 px | 0 | legibilidad; los rótulos decorativos de la tarjeta 3D quedan fuera |
| Errores de página | 0 | lo que `tsc` y el export no ven |
| Captura | — | comparación visual antes/después; a 390 px debe ser idéntica al teléfono |

**Al comparar capturas a 390 px**: el inicio (`/`) NO es determinista mientras el recorrido guiado
está activo. Su tarjeta y su anillo se colocan donde cae la medida del objetivo y llegan con un
muelle, así que dos capturas de la misma versión difieren ~6 % en esa región. Antes de atribuir una
diferencia a un cambio, capturar dos veces la misma versión; o saltar el recorrido antes de
capturar (`getByRole('button', { name: 'Saltar' })`).

## Estados abiertos (`--estados`)

| Estado | Ruta | Qué se comprueba |
|---|---|---|
| Hoja de ayuda (ⓘ) | `/registro` | un diálogo, cabe entero, Escape la cierra, el foco vuelve al ⓘ |
| Selector de opciones | `/economia` | cabe entero (la lista cede antes que la hoja) |
| Pagos lista / cuadrícula / calendario | `/pagos` | sin desborde en las tres vistas |

## Lo que se comprueba a mano o con otras herramientas

| Caso | Cómo |
|---|---|
| Errores de validación en formularios | `flujos.mjs` (alta e ingreso con datos inválidos y válidos) |
| Teclado virtual | simulador de iOS (`docs/pruebas.md` §3); en web, el documento se desplaza |
| Menú abierto | no hay menú desplegable: la barra siempre muestra los cinco destinos desde 600 px; pestañas por debajo |
| Fuentes aumentadas | `AtlasText` limita `maxFontSizeMultiplier`; en web, el zoom equivalente |
| Datos numerosos / textos largos | ids ficticios → vacíos; con el cliente de `recorrido-completo.mjs` → créditos reales; `numberOfLines` en títulos y filas |
| Roles | la web sólo tiene el rol cliente |
| Movimiento reducido | `page.emulateMedia({ reducedMotion: 'reduce' })` en una pasada manual; las reglas están en `estilo.ts` |

## Cómo se corre

```bash
# la web como en el despliegue (SPA + proxy /api/v1), o `npm run web` con un proxy delante
EXPO_PUBLIC_ATLAS_API_URL=/api/v1 npx expo export --platform web && node tools/web-local-server.mjs 8790

# matriz completa con estados; deja capturas e informe en e2e-web/salida-responsive/
PLAYWRIGHT_DIR=<node_modules/playwright> node e2e-web/responsive.mjs --correo … --pin … --estados

# apaisado
PLAYWRIGHT_DIR=… node e2e-web/responsive.mjs --correo … --pin … --anchos 844 --apaisado --estados

# sólo unas rutas, rápido
PLAYWRIGHT_DIR=… node e2e-web/responsive.mjs --correo … --pin … --anchos 320,768,1280 --rutas /,/pagos --sin-capturas
```

El guion termina con código 1 si algo falla, y el informe dice qué; ningún verde vale sin leerlo.
