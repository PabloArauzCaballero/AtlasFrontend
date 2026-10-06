# Plan — La espera se ve: barra de carga y animación de marca (app móvil)

- Fecha: 2026-10-06 · Repo: AtlasFrontend (`apps/consumer-app`) · Rama: `claude/plan-credito-calificacion-mobile-b95b6f` (reiniciada desde `origin/dev`) · Predecesor: `2026-10-06-correcciones-app-real`
- Pedido de Pablo: «que se pueda ver el cargando como una barra de carga o que mientras algo carga hagamos una animación asombrosa y bonita renderizada en ultra HD».
- Resultado observable: mientras algo carga, la persona ve la «A» de Atlas con un anillo de luz que gira a su alrededor y una barra de carga con el degradado de la marca que avanza; los esqueletos de las listas tienen un brillo que los recorre. Todo vectorial (SVG): nítido a la densidad de cualquier pantalla.
- Kill-test: abrir «Tu nivel Atlas» o «Buscando tu pago…» con la red lenta → si sólo se ve el circulito gris del sistema o un bloque que parpadea, no está hecho.

## Hallazgos
| # | Hecho | Dónde |
|---|---|---|
| D1 | `Cargando` (6 usos) es el `ActivityIndicator` del sistema: un círculo gris genérico. | `src/ui/primitives.tsx:1017` |
| D2 | `Skeleton` (82 usos) sólo pulsa opacidad; `SkeletonLista` (8 pantallas) no dice que algo está cargando. | `primitives.tsx:979,999` |
| D3 | La subida de fotos usa otro `ActivityIndicator` suelto. | `src/ui/estado-de-subida.tsx:44` |
| D4 | Ya existen la geometría y los degradados de la «A» (`LETRA_A`, `DegradadosLetraA`), Reanimated 4.5, react-native-svg 15 y expo-linear-gradient: no hace falta ninguna librería nueva. | `src/ui/brand.tsx`, `package.json` |

## Alcance
- IN: pieza nueva `src/ui/cargador-atlas.tsx` (marca + anillo + barra indeterminada); `Cargando` la usa conservando su API; brillo en `Skeleton`; `SkeletonLista` anuncia la carga con la barra de marca; `estado-de-subida` usa el anillo.
- OUT: el spinner DENTRO de los botones (es del tamaño del texto del botón; un logotipo ahí no cabe); el arranque/splash; cualquier dato o backend.
- Reglas que se respetan: movimiento reducido → nada gira ni se desliza (anillo y barra quietos, legibles); sólo `transform`/`opacity` (nada de animar ancho/alto); colores sólo de tokens; accesible como `progressbar` con su texto.
- Ambigüedad: «barra de carga» cuando no se sabe cuánto falta → supuesto: barra INDETERMINADA (un tramo de luz que recorre la barra), porque inventar un porcentaje sería mentir sobre el avance. Confirmar con Pablo.

## Microtareas
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| L1 | `CargadorAtlas`: «A» + anillo con degradado que gira + barra indeterminada; tamaños `compacto` / `fila` / `bloque`; movimiento reducido = estático | Se pinta en los tres tamaños; con movimiento reducido no arranca ninguna animación | `jest cargador-atlas` PASS | HECHO |
| L2 | `Cargando` usa `CargadorAtlas` (misma API, mismos 6 llamadores) | Texto y rol `progressbar` intactos | `jest` completo PASS | HECHO |
| L3 | `Skeleton` con brillo que lo recorre; `SkeletonLista` con la barra de marca arriba | Esqueleto sigue oculto para lector de pantalla; la lista anuncia «Cargando» | `jest` completo PASS | HECHO |
| L4 | `estado-de-subida` usa el anillo de marca | Subida sigue anunciándose | `jest estado-de-subida identidad` PASS | HECHO |
| L5 | Prueba visual: capturas a 3x (móvil), tablet y escritorio de la espera real (red ralentizada) y con movimiento reducido | Capturas revisadas | `evidencia/` | HECHO |
| L6 | Gates + PR a `dev` + CI verde + merge + promoción a `test` | | `tsc` · `eslint` · `jest` | EN CURSO |
