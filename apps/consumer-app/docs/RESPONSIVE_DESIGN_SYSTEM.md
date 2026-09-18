# El sistema responsivo de la web de la app

Cómo se adapta la app del cliente al navegador, dónde vive cada decisión y cómo se añade una
pantalla sin volver a decidir nada de esto. Complementa a [`web.md`](web.md) (cómo se corre y
despliega) y a [`identidad-visual.md`](identidad-visual.md) (la marca).

## 1. Principio

**El teléfono es la app; la web es la app con una cáscara.** Por debajo de 600 px la web pinta
exactamente lo que pinta el teléfono: mismas 42 pantallas, misma columna, misma barra de pestañas.
Desde 600 px lo que cambia es lo que RODEA a la columna de contenido: la barra superior de la
landing, la atmósfera, la segunda columna del acceso y, desde 1024, la rejilla. Las pantallas no
saben en qué tramo están; lo saben tres piezas compartidas y una hoja de estilo.

## 2. Breakpoints: un solo origen

`src/ui/responsive.ts` es el único sitio donde hay números de ancho:

| Constante | Valor | Qué cambia a partir de ahí |
|---|---|---|
| `TRAMO.tableta` | 600 px | La web deja de ser el teléfono: cáscara con barra superior (dos filas), hojas centradas y estrechas, atmósfera, entradas con desenfoque, escala tipográfica de escritorio |
| `TRAMO.panelLateral` | 940 px | Cabe la segunda columna del acceso y del registro (tarjeta 3D, cita, pasos) |
| `TRAMO.escritorio` | 1024 px | Barra superior en una fila con el menú en el centro; rejilla de 12 columnas en el área de cliente; hero de la landing en la bienvenida |
| `ANCHO_COLUMNA` | 560 px | Columna de lectura de cualquier pantalla (`Screen`), hojas, tarjeta del recorrido, documento de consentimiento |
| `ANCHO_REJILLA` | 1220 px | Tope de la barra, del pie y del contenido en escritorio; más allá sólo crece el aire |
| `ANCHO_CARRIL` | 220 px | Carril lateral de pestañas (sólo tabletas nativas) |

Quién los consume:

- **La hoja de estilo** (`src/web/estilo.ts`) genera sus `@media` desde `TRAMO` (`DESDE_TABLETA`,
  `HASTA_TELEFONO`, `HASTA_SIN_PANEL`, `DESDE_ESCRITORIO`, `HASTA_TABLETA`). No hay `@media` con
  literales; si aparece uno en una revisión, es un error.
- **`useTramo()`** en los componentes que deciden en JS: `(app)/_layout` y `(tabs)/_layout` (cáscara
  o pestañas), `Appear` (entrada por CSS o por valor compartido), `BottomSheet` (estrecha o de borde
  a borde), la bienvenida (hero o carrusel).
- **`useAnchoDeColumna()`** para lo que se pagina por ancho (el carrusel de la bienvenida).

No se usa `Dimensions.get` (no se entera de que la ventana cambia) ni `window.innerWidth`.

## 3. Contenedores

| Contenedor | Dónde | Regla |
|---|---|---|
| Columna de pantalla | `Screen` (`ui/layout.tsx`) | `width: 100%`, `maxWidth: 560`, centrada, `paddingHorizontal: space.lg`; en escritorio bajo la cáscara se ensancha a 1220 y se compone en rejilla |
| Pie fijo de pantalla | `Screen footer` | misma columna; se levanta sobre el área segura |
| Rejilla de escritorio | `estilo.ts` («rejilla») | 12 columnas en orden del DOM (sin `dense`); cabecera a lo ancho; bloques alternando 6/6; un título de sección abre fila; un bloque izquierdo que es el último o va antes de un título ocupa la fila; los `Gap` no cuentan |
| Barra superior | `.nav__inner` | `min(100% - 2.6rem, 1220px)`; una fila desde 1024, dos filas (menú abajo) entre 600 y 1023 |
| Acceso y registro | `.auth` | `grid 1fr .92fr` desde 940; una columna por debajo; el formulario limita a 520 px |
| Hojas | `BottomSheet` | de borde a borde en teléfono; 560 px centrada y redondeada desde 600; nunca más alta que el 92 % de la ventana |
| Documento de consentimiento | `ConsentRow` | a pantalla completa, con el texto en una columna de 624 px |

Una pantalla nueva no define anchos: usa `Screen` y, si necesita composición de escritorio, añade
su ruta a `rejillaPara` en `ui/layout.tsx`.

## 4. Tokens

Todo sale de `src/theme/tokens.ts` (`space`, `radius`, `type`, `touch`, `shadow`, `motion`) y la hoja
web los reexpone como variables CSS con los nombres de la landing (`--b2`, `--t1`, `--fs-h1`,
`--spring`…). Regla dura: ningún color literal en `estilo.ts`. Los tokens de escala fluida de
escritorio son `clamp()` sobre las mismas variantes de `AtlasText` (`display`, `hero`, `h1`, `h2`,
`amountHero`, `lead`/`body`, `eyebrow`); en teléfono manda `type`.

## 5. Áreas táctiles

`touch.minSize = 48` en el teléfono, pagado con `hitSlop` donde el dibujo es más pequeño (ⓘ, ojo
del PIN, «Listo», puntos, chips). **react-native-web no implementa `hitSlop`**, así que en la web
esos controles medían lo dibujado. `src/ui/hit-slop.ts` (`toqueWeb`) marca el elemento con
`data-toque="<medida>"` y la hoja de estilo le cuelga un `::before` absoluto con `inset` negativo:
no toca el flujo (un botón de 48 fijos sigue midiendo 48 y en su sitio) y el clic que cae ahí
llega al mismo `Pressable`. Las medidas posibles son el catálogo `TOQUES` (4, 6, 8, 10, 11, 12 y
8-4-8-4 para los chips); una medida nueva se añade allí y la regla CSS se genera sola.

- `PressSurface` lo aplica solo cuando recibe `hitSlop`: chips, filas, cabeceras, casilla del consentimiento.
- Los `Pressable` sueltos lo esparcen a mano: `hitSlop={12} {...toqueWeb(12)}`.
- Mínimo aceptado en la web: 24 × 24 px (WCAG 2.2 AA, 2.5.8); lo mide `e2e-web/responsive.mjs`.
- Los enlaces y botones DOM de la cáscara llevan `min-height: 44px`.

Excepción documentada: el interruptor nativo (`Switch`) mide 40 × 20; la fila que lo contiene mide
48 y el control es el que mejor anuncia el lector de pantalla.

## 6. Campos

En la web, el `input` de un campo con icono se estira a la caja (`align-self: stretch`) y, cuando es
lo último de la fila, llega hasta el borde derecho (el relleno pasa a ser suyo): la caja de 56 px
enfoca en toda su altura y hasta su borde; sólo el icono de la izquierda y su margen quedan fuera. El anillo de foco (`[data-atlas="campo"]:focus-within`) es de 4 px y no toca
el borde. El teclado virtual se cubre con `KeyboardAvoidingView` (iOS) y con el desplazamiento del
documento (web); un fallo de envío lleva la vista arriba (`useScrollToError`).

## 7. Movimiento

- Entradas escalonadas: CSS (`rise`, resorte de la landing) desde 600 px; valor compartido en teléfono.
- `prefers-reduced-motion`: sin aurora en movimiento, sin entradas, sin brillo del botón, sin balanceo
  de la tarjeta, sin transiciones de hover ni de la píldora, `scroll-behavior: auto`. En JS,
  `useReducedMotion()` de Reanimated lee la misma preferencia.
- Rendimiento: la aurora no lleva `filter: blur` (medido: 14 → 61 fps a 2.560 px), el grano no lleva
  `mix-blend-mode`, la píldora se recoloca con un solo oyente de `resize`.

## 8. Foco y teclado

- `:focus-visible` con el anillo de marca, sin `border-radius` (una píldora enfocada no cambia de forma).
- Las hojas (`Modal` de RNW) atrapan el foco, cierran con Escape (`onRequestClose`) y devuelven el
  foco al botón que las abrió; `accessibilityViewIsModal` en el contenedor.
- La barra superior es `<header role="banner">` + `<nav aria-label>` con `aria-current="page"`.

## 9. Cómo añadir una pantalla

1. Escribe la pantalla como en el teléfono, con `Screen`, las primitivas y los campos compartidos.
2. Si va bajo la cáscara y quiere composición de escritorio, añade la ruta a `rejillaPara`.
3. Si un control necesita `hitSlop`, ponlo en un `PressSurface` o esparce `toqueWeb(hitSlop)` en el `Pressable`.
4. No escribas `@media`, `Dimensions.get`, anchos fijos de pantalla ni colores literales.
5. Corre `e2e-web/responsive.mjs` a 320/390/768/1024/1280 y mira el informe, no sólo el exit code.

## 10. Qué NO hace la web (y no debe fingir)

Cámara, GPS, agenda, push y mapa se degradan como dice [`web.md`](web.md). No se dibujan controles
para lo que no existe: la pantalla lo dice.
