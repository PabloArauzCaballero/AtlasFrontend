# Informe de implementación responsiva — web de la app del cliente

Fecha: 2026-09-17. Plan: [`RESPONSIVE_AUDIT_AND_IMPLEMENTATION_PLAN.md`](RESPONSIVE_AUDIT_AND_IMPLEMENTATION_PLAN.md).
Sistema: [`RESPONSIVE_DESIGN_SYSTEM.md`](RESPONSIVE_DESIGN_SYSTEM.md). Matriz: [`RESPONSIVE_TEST_MATRIX.md`](RESPONSIVE_TEST_MATRIX.md).
Evidencia (capturas, informes, logs): `atlas/_evidencia-web-responsive-2026-09-17/`.

## 1. Resumen de cambios

La web pasa a tener **un solo origen de breakpoints**, navegación completa en tableta, áreas
táctiles reales en el navegador, campos que enfocan en toda su caja, hojas que nunca superan la
ventana, foco por teclado que no deforma, movimiento reducido completo y una **auditoría
reproducible** (`e2e-web/responsive.mjs`) que mide desbordes, áreas táctiles, texto pequeño,
errores y estados abiertos en 13 anchos. Las 42 pantallas del teléfono no cambian: las capturas a
390 px son idénticas antes y después en todas las rutas (§14).

## 2. Problemas detectados (antes)

Medidos con la auditoría sobre 36 rutas × 10 anchos (362 aperturas) más 600/640/940, estados
abiertos, apaisado y zoom equivalente:

| # | Sev. | Problema | Medida antes |
|---|---|---|---|
| 1 | Crítico | Sin enlace a Pagos/Avisos entre 600 y 1023 px | 0 enlaces del menú visibles a 768 px |
| 2 | Alto | Desborde horizontal en `/bienvenida` por debajo de 1024 px | `scrollWidth` = ancho + 200 en 320/360/390/430/600/640/768/940 |
| 3 | Alto | Controles menores de 24 px en la web (sin `hitSlop`) | puntos 8×8 (×4), ojo del PIN 20×20, «Listo», ⓘ 26×26 |
| 4 | Alto | Sólo el `input` de 23 px enfocaba dentro de la caja de 56 | 21 campos en 7 pantallas |
| 5 | Medio | `:focus-visible` con `border-radius` fijo | píldoras con esquinas de 8/12 px al enfocar |
| 6 | Medio | Breakpoints literales en 5 sitios | 600/599/940/1023/1024 en `estilo.ts`, `motion.tsx`, `bienvenida.tsx` |
| 7 | Medio | Hueco en la rejilla con el último bloque impar | inicio, escanear a 1024/1280 |
| 8 | Medio | Chip de cuenta sin elipsis empuja la barra | +100 px a 640 px con «Recorrido» |
| 9 | Medio | Cifras del panel/hero sin `flex-wrap` | apretadas a 940–1000 px |
| 10 | Medio | Hoja más alta que la ventana sale por arriba | selector con lista de 380 px en 388 px de alto |
| 11 | Bajo | Consentimiento a 300 caracteres por línea en 1920/2560 | — |
| 12 | Bajo | Movimiento reducido parcial | transiciones de hover y `scroll-behavior` activas |
| 13 | Bajo | Interruptor nativo 40×20 | 9 interruptores en preferencias (queda, documentado) |
| 14 | Bajo | `eslint .` en rojo por `nginx.web.conf` | 1 error antes de empezar |
| 15 | Bajo | Sin prueba de desborde/toque/estados | — |
| 16 | Bajo | `<input type="date">` web sin `data-atlas="campo"` | 2 campos (registro, identidad) |

## 3. Problemas resueltos (después)

Todos menos el 13 (excepción documentada). Cifras de la pasada final en §14.

## 4. Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/ui/responsive.ts` | `TRAMO.panelLateral` (940), `ANCHO_REJILLA` (1220); documentación |
| `src/web/estilo.ts` | `@media` generadas desde `TRAMO`; barra de dos filas en tableta; elipsis del chip; `flex-wrap` en cifras; rejilla en orden del DOM (sin `dense`) y sin huecos (el bloque izquierdo último o previo a un título ocupa la fila); `data-toque` (áreas táctiles); campos que enfocan en toda la caja; foco sin `border-radius`; movimiento reducido para transiciones y scroll |
| `src/web/Cascara.tsx` | la píldora se recoloca al cambiar el tamaño de la ventana (un oyente) |
| `src/ui/motion.tsx` | `Appear` decide por `useTramo()`; `PressSurface` aplica `toqueWeb` cuando recibe `hitSlop` |
| `src/ui/help-sheet.tsx` | `maxHeight: 92 %` + `flexShrink` en la hoja; `toqueWeb` en «Listo» y en el ⓘ |
| `src/ui/form-controls.tsx` | `flexShrink` en la lista del selector; `data-atlas="campo"` en la fecha web |
| `src/ui/consent-row.tsx` | documento en columna de lectura (624 px); `toqueWeb` en «Leer» y «Cerrar» |
| `src/ui/pin-field.tsx`, `src/ui/trust-card.tsx`, `app/(auth)/ingresar.tsx` | `toqueWeb` junto a `hitSlop` |
| `app/(public)/bienvenida.tsx` | `overflow: hidden` en la raíz (halos); hero por `useTramo()`; `toqueWeb` en los puntos |
| `public/index.html` | `:focus-visible` sin `border-radius` |
| `eslint.config.js` | ignora `nginx.web.conf` |
| `docs/web.md`, `docs/pruebas.md` | referencias a la matriz y al sistema |

## 5. Componentes creados

- `src/ui/hit-slop.ts`: `toqueWeb`, `conToqueWeb`, `TOQUES`, `ladosDe`.
- `e2e-web/responsive.mjs`: la auditoría (matriz, estados, apaisado; exit 1 si algo falla).
- `__tests__/responsive.test.ts`: 7 pruebas de `tramoPara` y `toqueWeb`.

## 6. Componentes refactorizados

`PressSurface`, `Appear`/`AppearWeb`, `BottomSheet`, `HelpButton`, `ConsentRow`, `DateField` (web),
`BarraSuperior`, la hoja de estilo entera. Sin cambios de props ni de comportamiento en el teléfono.

## 7. Breakpoints utilizados

`TRAMO.tableta` 600 · `TRAMO.panelLateral` 940 · `TRAMO.escritorio` 1024 · `ANCHO_COLUMNA` 560 ·
`ANCHO_REJILLA` 1220. Ningún `@media` con literal en la hoja (comprobado con una expresión regular
en la propia generación).

## 8. Estrategias aplicadas a tablas

No hay tablas. La cuadrícula de pagos (`flexBasis: 46 %`) da dos columnas en teléfono y tres desde
tableta; el calendario mide sus celdas en porcentaje (7 × 14,28 %) y cabe a 320 px; ambas se
verifican en los estados abiertos. La información crítica (importe, vencimiento) vive en la fila
de lista, que es la vista por defecto.

## 9. Estrategias aplicadas a navegación

- < 600 px: barra de pestañas del teléfono, sin cambios.
- 600–1023 px: barra superior en dos filas (marca, cuenta con elipsis, «Escanear QR», «Salir»;
  debajo el menú de cinco destinos con la píldora). Antes: sin menú y sin pestañas.
- ≥ 1024 px: una fila, menú centrado; sin cambios.
- Enlaces y botones de la barra con `min-height: 44px`; `aria-current="page"`; la píldora se recoloca
  en `resize`.

## 10. Estrategias aplicadas a formularios

Una columna siempre (la columna de lectura de 560 px; en el acceso, 520). Todo el `input` enfoca en
la caja de 56 px y hasta su borde derecho; anillo de foco de 4 px; el ⓘ, el ojo del PIN y «Listo»
responden a 48 px. El error de envío lleva la vista arriba (`useScrollToError`, ya existía). Sin
cambios en nombres de campos, payloads ni validaciones.

## 11. Mejoras de accesibilidad

- Áreas táctiles ≥ 24 px en la web (WCAG 2.2, 2.5.8) para todo lo que en el teléfono usa `hitSlop`.
- Foco visible sin deformar (2.4.7/2.4.11).
- `prefers-reduced-motion` en transiciones, píldora y `scroll-behavior` (2.3.3).
- Las hojas cierran con Escape y devuelven el foco al ⓘ (comprobado en la auditoría).
- Navegación completa desde 600 px (2.4.5).

## 12. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npx eslint .` | 0 errores, 0 avisos (antes: 1 error) |
| `node scripts/check-field-help.mjs` | 53 campos y 60 opciones, todos con ayuda |
| `npx jest` | 19 suites, 149 pruebas (antes 140) |
| `npx expo export --platform web` | exportado; `index.html` con «Atlas» y `entry-*.js` presentes |
| `e2e-web/responsive.mjs` (13 anchos + estados) | ver §14 |
| `e2e-web/responsive.mjs --apaisado` (844 × 388) | ver §14 |
| Comprobación interactiva (Playwright) | clic 8 px fuera del ojo del PIN → «Ocultar PIN»; clic en el relleno de la caja → el `input` enfoca; `border-radius` del foco = 0; 5 enlaces de 60 px a 768; clic en «Pagos» navega y la píldora se coloca; con movimiento reducido `animation: none` y `scroll-behavior: auto` |

## 13. Resultados de build, lint y type checking

Verdes (§12). El export de producción se hizo fuera del árbol compartido (`--output-dir` en la
carpeta de trabajo de la sesión), como pide `atlas/CLAUDE.md`.

## 14. Evidencias visuales

Carpeta: `atlas/_evidencia-web-responsive-2026-09-17/` (`antes/`, `despues/`, `logs/`, README con el índice).

### Matriz final (`e2e-web/responsive.mjs --estados`, 13 anchos)

| Medida | Antes (10 anchos, 362 aperturas) | Después (13 anchos, 468 aperturas) |
|---|---|---|
| Rutas con desborde horizontal | 5 (`/bienvenida` a 320/360/390/430/768; también a 600/640/940 en la pasada extra) | **0** |
| Rutas con elementos fuera del viewport | 5 | **0** |
| Rutas con controles < 24 px (sin contar el interruptor) | 10 rutas distintas (puntos 8×8, ojo 20×20, `<input>` de 23 px, fecha 23 px) | **0** |
| Rutas con texto de contenido < 11 px | 12 rutas (rótulo de la tarjeta 3D a 10,6 px) | **0** (rótulo a 11,2 px) |
| Errores de página | 0 (1 espera de red agotada, transitoria) | **0** |
| Estados abiertos (ayuda, Escape + foco, selector, pagos ×3) × 13 anchos | selector fuera de la ventana en apaisado | **78/78 en verde** |
| Apaisado 844 × 388 (36 rutas + 6 estados) | `/registro` e `/identidad` con la fecha de 23 px | **0 fallos** |
| Enlaces del menú visibles a 768 px | 0 | 5 (60 px de alto) |

### El teléfono no cambia (390 px, antes vs después, píxeles distintos)

32 de 36 rutas: **0,00 %**. Las cuatro restantes: `/` 3,17 % (la tarjeta del recorrido guiado en
un fotograma distinto de su muelle; misma composición), `/domicilio` 0,43 % (una línea de estado
de la ubicación), `/registro` 0,07 %, y `/bienvenida`, cuya captura «antes» medía 590 × 1060
porque la página crecía 200 px con los halos: ahora mide 390 × 780, que es la corrección.

### Comprobación interactiva (Playwright, `logs/interaccion.txt`)

Clic 8 px a la derecha del ojo del PIN → «Ocultar PIN»; clic en el relleno de la caja → el `input`
recibe el foco; `border-radius` del elemento enfocado = 0; a 768 px los cinco enlaces miden 60 px,
«Pagos» navega y la píldora se coloca; con movimiento reducido, `animation: none` y
`scroll-behavior: auto`.

### Capturas

`despues/despues-<ruta>-<ancho>.png` (768, 1024, 1280, 2560 de inicio, pagos, escanear y perfil;
registro a 768; ingreso a 1024) frente a `antes/m-*.png` (montajes de la primera pasada).

## 15. Riesgos o limitaciones restantes

- El interruptor nativo mide 40 × 20 en la web (la fila, 48). Se deja por ser el control que mejor
  anuncia el lector de pantalla; una versión propia sería un cambio de componente compartido.
- La rejilla de escritorio usa `grid-auto-flow: row dense`: el orden visual puede diferir del orden
  del DOM en pantallas con títulos de sección intercalados; el orden de lectura del teclado es el
  del DOM. Ya existía; se documenta.
- El zoom del navegador se evaluó por viewport equivalente (640 px), no con el zoom real.
- En Contabo (HTTP plano) la cámara no abre: no es responsivo, es `getUserMedia`.
- El servidor de desarrollo de Metro no recogió cambios de archivos en esta máquina (watcher);
  cada verificación se hizo reiniciándolo con `--clear`. El export de producción no se ve afectado.

## 16. Recomendaciones de mantenimiento

1. Correr `e2e-web/responsive.mjs --estados` antes de empujar un cambio visual de la web; leer el
   informe, no sólo el exit code.
2. Un ancho nuevo se añade a `TRAMO`, nunca como literal en una pantalla o en la hoja.
3. Un `hitSlop` nuevo va en un `PressSurface` o con `toqueWeb`; una medida nueva, al catálogo `TOQUES`.
4. Un retoque visual de la web va en `estilo.ts`/`src/web/`, nunca en las pantallas; comprobar
   siempre 390 (idéntico al teléfono), 768 y 1280.
5. Si se añade una pantalla bajo la cáscara, registrarla en `rejillaPara` para que se componga.
