# Auditoría responsiva de la web de la app del cliente, y plan de implementación

Fecha: 2026-09-17. Alcance: **la versión web** de `apps/consumer-app` (la app móvil exportada con
Expo Web). iOS y Android no cambian de aspecto; los componentes compartidos sólo reciben cambios
neutros para el teléfono (se dice cuáles en §13).

## 1. Resumen ejecutivo

La web ya tenía una base responsiva seria: columna de lectura de 560 px, tres tramos con nombre
(`ui/responsive.ts`), hoja de estilo web generada desde los tokens (`web/estilo.ts`), composición de
escritorio con rejilla de 12 columnas, hojas modales que se estrechan, y una verificación de humo
en 42 rutas × 3 anchos. La auditoría con 10 anchos (320 → 2560), estados abiertos, apaisado y zoom
encontró **un crítico, tres altos, seis medios y cinco bajos**. Ninguno es un problema de una
pantalla suelta: todos se resuelven en la capa compartida (`web/estilo.ts`, `ui/responsive.ts`,
`ui/motion.tsx`, `ui/help-sheet.tsx`, `ui/consent-row.tsx`) y las 42 pantallas no se tocan, salvo
una línea en la bienvenida.

Lo más grave: entre 600 y 1023 px **no hay forma de llegar a Pagos ni a Avisos** (la barra superior
esconde el menú y la barra de pestañas también se esconde). Lo más repetido: en el navegador
`hitSlop` no existe, así que los controles que en el teléfono se pagan con `hitSlop` miden lo
dibujado (8×8 los puntos del carrusel, 20×20 el ojo del PIN).

## 2. Stack detectado

| Pieza | Qué es |
|---|---|
| Framework | Expo SDK 57 (`expo ~57.0.14`), React Native 0.86.2, React 19.2.3 |
| Web | `react-native-web` 0.21.2 + `react-dom` 19.2.3, export `web.output: "single"` (SPA), Metro |
| Rutas | `expo-router` ~57 (grupos `(public)`, `(auth)`, `(onboarding)`, `(app)/(tabs)`); layouts `.web.tsx` para acceso y registro |
| Estilos | `StyleSheet` de RN con tokens (`src/theme/tokens.ts`); en web, una hoja CSS inyectada (`src/web/estilo.ts`) enganchada por atributos `data-atlas` |
| Componentes | propios: `src/ui/*` (primitivas, campos, hojas, calendario, cámara…); DOM puro sólo en `src/web/*` |
| Iconos | `src/ui/icons.tsx` (SVG propio via `react-native-svg`) |
| Estado | React (contextos: sesión, sandbox, tour, sonido); sin librería externa |
| Formularios | controlados a mano + `zod` |
| Tablas | no hay; listas, tarjetas, cuadrícula (`flexWrap`) y calendario |
| Gráficos | barras de progreso propias; sin librería |
| Animación | `react-native-reanimated` 4.5 (en web, `AppearWeb` y CSS) |
| Pruebas | Jest 29 + `jest-expo` + Testing Library (140 pruebas, 18 suites); Playwright para la web (`e2e-web/humo.mjs`, `e2e-web/flujos.mjs`, resuelto por `PLAYWRIGHT_DIR`) |
| Lint/formato | ESLint 9 flat (`eslint-config-expo`); sin prettier propio |
| Scripts | `typecheck`, `lint`, `test` (incluye `check:field-help`), `web`, export con `npx expo export --platform web` |
| Build/despliegue | `Dockerfile.web` + nginx (`nginx.web.conf`), Coolify en dev (H310) y test (Contabo) |
| Gestor | npm (workspaces + turbo); `apps/consumer-app/.npmrc` con `legacy-peer-deps` |

Hallazgo previo: `node_modules` del monorepo no tenía `react-native-web` ni `react-dom` instalados
aunque el lockfile los trae (`npm install` los añade sin cambiar el lock). Sin ellos Metro devuelve
500 al bundle web.

## 3. Inventario de rutas (42 + 2 layouts web)

| Área | Rutas | Guardia |
|---|---|---|
| Pública | `/bienvenida`, `/permisos`, `/ingresar`, `/recuperar`, `+not-found` | ninguna |
| Registro | `/registro` (público), `/verificar-contacto`, `/verificacion`, `/progreso`, `/perfil`, `/economia`, `/domicilio`, `/identidad`, `/referencias`, `/revision` | sesión salvo `/registro` |
| Pestañas | `/` (inicio), `/escanear`, `/pagos`, `/avisos`, `/perfil` | sesión + cuenta activa |
| Área de cliente | `/compra/monto`, `/compra/[orderId]`, `/pago/[itemId]`, `/pagar/[installmentId]`, `/credito/[loanId]`, `/cuota/[loanId]/[numero]`, `/comercio/[partnerId]`, `/politica-mora`, `/editar-perfil`, `/cambiar-pin`, `/extracto-bancario`, `/privacidad`, `/preferencias-avisos`, `/ayuda`, `/soporte`, `/soporte/[channelId]`, `/soporte/caso/[caseId]` | sesión + cuenta activa |

## 4. Inventario de componentes críticos

| Clase | Componentes | Dónde |
|---|---|---|
| Layout | `Screen`, `ScreenHeader`, `HeaderAction`, `Gap` | `ui/layout.tsx` |
| Navegación | barra de pestañas (`(tabs)/_layout.tsx`), cáscara web `BarraSuperior`/`Pie` (`web/Cascara.tsx`), cabecera de acceso (`web/PanelLateral.tsx`) |
| Tipografía | `AtlasText`, `Overline` con escala fluida en web (`estilo.ts`) |
| Formularios | `Field`, `AmountField`, `OptionGroup`, `CheckRow`, `Switch` (`ui/fields.tsx`); `IconField`, `DateField`, `SelectField`, `PhoneField` (`ui/form-controls.tsx`); `PinField`; `FieldLabel`/`FieldFoot`/`HelpButton` (`ui/help-sheet.tsx`); `ConsentRow` |
| Hojas y modales | `BottomSheet`, `HelpSheet` (`ui/help-sheet.tsx`); documento de consentimiento (`ui/consent-row.tsx`); `Tour` (`ui/tour.tsx`); `MapaPunto` (nativo) |
| Tarjetas y listas | `Card`, `CardHeader`, `ListRow`, `KeyValue`, `Stat`/`StatRow`, `Badge`, `Chip`/`ChipBar`, `Accordion`, `EmptyState`, `ErrorState`, `Skeleton` |
| Densos | cuadrícula de pagos (`flexBasis: 46%`), `PaymentCalendarView` (7 celdas al 14,28 %), `ScoringPanel`, `ImageSlides`, `CameraFrame` |
| Web | `Atmosfera`, `Cascara`, `PanelLateral`, `Tarjeta3D`, `HeroBienvenida`, `estilo.ts` |

## 5–7. Problemas encontrados, severidad y componentes afectados

Medido con `e2e-web/responsive.mjs` sobre 36 rutas
× 10 anchos = 362 aperturas, más estados abiertos (hoja de ayuda, selector, errores, cuadrícula,
calendario) a 320/390/768/1024/1280, apaisado 844×388 y anchos intermedios 600/640/940.

| # | Severidad | Problema | Causa | Afecta |
|---|---|---|---|---|
| 1 | **Crítico** | Entre 600 y 1023 px no hay enlace a Pagos, Avisos ni Inicio desde otra pestaña. | `.nav__menu{display:none}` por debajo de 1024 y la barra de pestañas se oculta desde 600 (`conCascara`). | `web/estilo.ts`, `web/Cascara.tsx` |
| 2 | Alto | Desplazamiento horizontal en `/bienvenida` de 320 a 1023 px (+200 px). | Dos `BrandHalo` absolutos (`right:-200`, `left:-220`) en una raíz sin `overflow: hidden`; el teléfono recorta por pantalla, el documento no. | `(public)/bienvenida.tsx` |
| 3 | Alto | Controles con área de toque por debajo de 24 px en web: puntos del carrusel 8×8, ojo del PIN 20×20, «Listo» de las hojas, ⓘ 26×26, chips 34 px. | react-native-web no implementa `hitSlop` (comprobado en `Pressable`/`PressResponder` de RNW 0.21.2). | `ui/motion.tsx` (`PressSurface`), `ui/help-sheet.tsx`, `ui/pin-field.tsx`, `ui/consent-row.tsx`, `ui/trust-card.tsx`, `(auth)/ingresar.tsx`, `(public)/bienvenida.tsx` |
| 4 | Alto | En los campos con icono sólo el `input` interno (23 px de alto) enfoca; el resto de la caja de 56 px no responde al clic. | El `TextInput` es `flex: 1` dentro de un `View` con `alignItems: center`; no hay `<label for>`. | `web/estilo.ts` (regla sobre `[data-atlas="campo"] input`) |
| 5 | Medio | El anillo de foco por teclado cambia la forma de los botones (píldoras con esquinas de 8/12 px). | `:focus-visible{border-radius:8px}` en `estilo.ts` y `border-radius:12px` en `public/index.html`. | `web/estilo.ts`, `public/index.html` |
| 6 | Medio | Breakpoints repetidos en cinco sitios con literales (600, 599, 940, 1023, 1024). | `estilo.ts`, `motion.tsx` (`>= 600`), `bienvenida.tsx` (`>= 1024`) no leen `TRAMO`. | `ui/responsive.ts` y los tres |
| 7 | Medio | En escritorio, la rejilla deja un hueco cuando el último bloque cae solo en la columna izquierda (inicio, escanear). | Regla de alternancia sin caso para el último impar. | `web/estilo.ts` |
| 8 | Medio | El nombre largo de la cuenta en la barra superior empuja el menú (medido con «Recorrido» a 640 px: el chip sale 100 px del viewport). | `.nav__cuenta span` sin `max-width`/elipsis. | `web/estilo.ts` |
| 9 | Medio | Las cifras del panel lateral y del hero no envuelven: a 940–1000 px se aprietan. | `.side__stats`/`.hero__stats` sin `flex-wrap`. | `web/estilo.ts` |
| 10 | Medio | Una hoja inferior más alta que la ventana (apaisado 388 px de alto, selector con 40 opciones) sale por arriba. | `sheet` sin `maxHeight`/`flexShrink`; lista `maxHeight: 380`. | `ui/help-sheet.tsx` |
| 11 | Bajo | El documento de consentimiento a pantalla completa en 1920/2560 px pone líneas de 300 caracteres. | Modal `flex: 1` sin columna de lectura. | `ui/consent-row.tsx` |
| 12 | Bajo | `prefers-reduced-motion` para la aurora y las entradas, pero no para transiciones de hover, la píldora ni `scroll-behavior: smooth`. | Reglas parciales. | `web/estilo.ts` |
| 13 | Bajo | El interruptor nativo mide 40×20 en web (la fila entera mide 48). | Control nativo de RNW. | `ui/fields.tsx` (documentado, sin cambio) |
| 14 | Bajo | `eslint .` estaba en rojo antes de empezar: intenta parsear `nginx.web.conf`. | Falta en `ignores`. | `eslint.config.js` |
| 15 | Bajo | No había una prueba que midiera desbordes, áreas táctiles ni estados abiertos; el humo sólo miraba errores de página. | — | `e2e-web/responsive.mjs` (nuevo), `__tests__/responsive.test.ts` (nuevo) |
| 16 | Bajo | El `<input type="date">` de la web no llevaba `data-atlas="campo"`: sin anillo de foco y con sólo 23 px que enfocan. | Rama web de `DateField` escrita aparte. | `ui/form-controls.tsx` |

Lo que **no** se encontró: texto por debajo de 11 px en contenido (sólo el rótulo decorativo de la
tarjeta 3D a 10,6 px), imágenes deformadas (`resizeMode="contain"` en las tres), modales que no
quepan en 320–1280 en vertical, errores de página en ninguna ruta (una sola espera de red agotada a
1440 px en `/ingresar`, transitoria del servidor de desarrollo).

## 8. Estrategia de solución

1. **Un solo origen de breakpoints.** `ui/responsive.ts` exporta `TRAMO` (600, 1024) y añade
   `panelLateral: 940` (donde cabe la segunda columna de acceso/registro). `estilo.ts` genera las
   `@media` desde esos números; `motion.tsx` y `bienvenida.tsx` usan `useTramo()`.
2. **Navegación de tableta.** Desde 600 px la barra superior pasa a dos filas: marca, cuenta y CTA
   arriba; el menú de cinco destinos con la píldora en una fila propia. Desde 1024 vuelve a una
   fila. No se resucita la barra de pestañas: la cáscara ya tiene los cinco destinos.
3. **`hitSlop` en web.** `ui/hit-slop.ts` (`toqueWeb`): en web marca el elemento con
   `data-toque="<medida>"` y la hoja le pone un `::before` absoluto con `inset` negativo, que recibe
   el clic sin tocar el flujo; en nativo devuelve `{}`. `PressSurface` lo aplica solo cuando recibe
   `hitSlop`; los `Pressable` sueltos lo esparcen. (La primera versión —relleno + margen negativo—
   movía 12 px el botón de volver, que mide 48 fijos: se detectó comparando capturas a 390 px.)
4. **Campos**: en web el `input` interno se estira a la caja (`align-self: stretch`), y así toda la
   caja enfoca. Sólo CSS.
5. **Hojas**: `maxHeight` del 92 % y `flexShrink` en el contenedor; las listas ceden en vez de
   empujar. Cambio compartido, neutro en el teléfono (donde nunca llegan al tope).
6. **Foco**: el anillo no toca `border-radius`; `outline-offset` y ya.
7. **Rejilla**: en orden del DOM (sin `dense`, que subía el banner del partner por encima de «Tus
   compras»); un bloque izquierdo que es el último o va antes de un título de sección ocupa la fila.
8. **Movimiento reducido** para todas las transiciones y el `scroll-behavior`.
9. **Pruebas**: `e2e-web/responsive.mjs` (matriz de anchos, estados abiertos, apaisado) reutilizando
   el mismo Playwright que el humo; prueba unitaria de `tramoPara`/`hitSlopStyle`.

## 9. Riesgos de regresión

| Riesgo | Cómo se acota |
|---|---|
| Un cambio en `help-sheet.tsx`/`consent-row.tsx`/`motion.tsx` altera el teléfono | Sólo `maxHeight`/`flexShrink` (no actúan si el contenido cabe) y `hitSlopStyle` que devuelve `undefined` fuera de web; `npm test` y `tsc` verdes; capturas a 390 px idénticas (se comparan) |
| La barra de dos filas desplaza el contenido | `.nav` es `sticky` con altura automática; `--nav-h` deja de ser fija |
| El pseudoelemento del `hitSlop` web se solapa con vecinos tocables | Sólo entre hermanos con `gap` mayor que el solape (chips: 8 px de gap, 4 px de slop lateral); el que pinta después gana el clic, como en el teléfono |
| El `overflow: hidden` en la raíz de la bienvenida recorta algo en el teléfono | Los halos ya salen de pantalla; la página horizontal ya recorta por página |

## 10. Orden de implementación

F1 diagnóstico (este documento) → F2 cimientos (`responsive.ts`, `estilo.ts` base, foco, reducido)
→ F3 navegación (barra de dos filas) → F4 componentes compartidos (`hit-slop`, hojas, campos,
consentimiento, rejilla) → F5 pantallas (bienvenida) → F6 accesibilidad/touch (verificación)
→ F7 pruebas (`tsc`, lint, jest, export, matriz después) → F8 documentación.

## 11. Criterios de aceptación

- 0 rutas con `scrollWidth > clientWidth` en 320/360/390/430/600/640/768/940/1024/1280/1440/1920/2560.
- Desde 600 px la barra superior enlaza a los cinco destinos; a 390 lo hacen las pestañas.
- Ningún control interactivo visible por debajo de 24×24 px en la matriz (salvo el interruptor nativo, documentado).
- Toda la caja de un campo enfoca al hacer clic.
- Hojas y selector caben en 844×388 (apaisado) y se cierran con Escape devolviendo el foco.
- `tsc`, `eslint .`, `npm test`, `npx expo export --platform web` en verde.
- Capturas a 390 px iguales antes y después en las rutas de la matriz.

## 12. Pruebas necesarias

`npm run typecheck`, `npm run lint`, `npm test`, export web, `e2e-web/responsive.mjs` (matriz +
estados + apaisado), `e2e-web/humo.mjs` a 390/768/1280, comparación de capturas 390 px.

## 13. Decisiones que se conservan

- El teléfono (< 600 px) es la app, sin cambios; a 390 px las capturas deben ser idénticas.
- La cáscara de la landing desde 600 px y la rejilla de 12 columnas desde 1024 px.
- El carril lateral de pestañas queda para tabletas nativas (no se usa en web).
- Ningún color literal en `estilo.ts`; los tokens mandan.
- Los cambios en componentes compartidos son: `motion.tsx` (aplica `toqueWeb`), `help-sheet.tsx`
  (`maxHeight`/`flexShrink`, `toqueWeb`), `consent-row.tsx` (columna de lectura, `toqueWeb`),
  `form-controls.tsx` (`flexShrink` de la lista; `data-atlas="campo"` en la fecha web),
  `pin-field.tsx`, `trust-card.tsx`, `bienvenida.tsx` (`overflow: hidden` y `useTramo`),
  `ingresar.tsx` (`toqueWeb`). Todos neutros en iOS/Android: `toqueWeb` devuelve `{}` fuera de web.

## 14. Suposiciones

- El zoom al 200 % se evalúa como su viewport equivalente (1280 → 640 px CSS): el `zoom` de CSS
  no cambia `innerWidth` ni las `@media`, así que no representa el zoom real del navegador.
- Las hojas del navegador (barras de Safari/Chrome móvil) se cubren con `100dvh` donde se mide
  altura de ventana; el teclado virtual se cubre por `KeyboardAvoidingView` + scroll del documento.
- El interruptor nativo de 40×20 se deja: el HTML nativo es lo que mejor anuncia el lector de pantalla.
- Las «tablas» del enunciado no existen en esta app; la estrategia móvil se aplica a la cuadrícula
  y al calendario, que ya son fluidos (porcentajes), y se verifica a 320 px.
