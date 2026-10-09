# Marca y temas: cómo se cambia la marca de la app

La app está preparada para llevar **cualquier marca**: Atlas es la marca de trabajo. Cambiar de marca
no es rediseñar. Es rellenar un archivo, regenerar unos iconos y comprobar con capturas.

## Cómo está hecho

```
src/theme/marca.ts     ← LA MARCA: nombre, eslogan, símbolo (SVG), color principal, acento, brillo,
                         tipografía. Lo único que se edita.
src/theme/color.ts     ← motor de color (OKLCH): rampas de tono y corrección de contraste. No se toca.
src/theme/temas.ts     ← crearTema('claro' | 'oscuro', marca): todos los roles, calculados. No se toca.
src/theme/tokens.ts    ← espacio, radios, tipografía, movimiento, sombras; `color` = tema activo.
src/theme/tarjeta.ts   ← acabado mate de la tarjeta de membresía desde el color del catálogo.
src/theme/preferencia.ts ← la apariencia que eligió la persona (Perfil › Apariencia), recordada.
```

- **Neutros de sistema, no de marca.** Fondos, tarjetas, textos y líneas son los grises de iOS. Una
  interfaz seria tiene un solo color con intención; los grises tintados con la marca hacen que todo
  se vea «coloreado».
- **`principal`** pinta la acción que manda en cada pantalla (el botón principal). En claro se usa tal
  cual si el texto blanco encima se lee (4,5:1); si no, el motor lo oscurece lo justo. En oscuro se
  usa una versión clara y poco saturada del mismo matiz, con texto oscuro encima.
- **`acento`** es lo que significa algo: progreso, selección, enlaces, iconos de tarjeta, logros.
  El motor le busca el tono legible sobre todas las superficies de cada tema.
- **Estados** (éxito, aviso, peligro): matices de sistema (verde, ámbar, rojo), nunca el acento.
- **Escenario de marca** (arranque, celebración de logro, carta de insignia): sigue al tema, blanco
  en claro y casi negro en oscuro.
- **Metales, ilustraciones y objetos** (`palette.ts › metal`, `ilustracion.ts`, `objetos.ts`): no son
  de la marca ni del tema. Un trofeo de oro es dorado con cualquier marca.

Nadie fuera de `src/theme/` escribe un color: lo vigila `__tests__/sin-colores-sueltos.test.ts`.
Todos los contrastes de los dos temas, con la marca actual y con ocho marcas extremas, los vigila
`__tests__/temas-contraste.test.ts`.

## Qué se propaga solo desde `marca.ts`

| Campo | Dónde aparece |
|---|---|
| `nombre` | Rótulo del arranque (letra por letra), logotipo del acceso, bienvenida, tarjeta, barra web, y todos los textos de la interfaz que nombran la marca («Tu línea …», «Hablar con …»). |
| `eslogan` | Bajo el logotipo del acceso (`null` = sin eslogan). |
| `simbolo` | Logotipo, arranque (incluido el dibujo trazo a trazo con `contorno`), corte de marca, cargador, tarjeta, barra y panel web. |
| `principal` / `acento` | Los dos temas completos, con contraste corregido (`temas.ts`). |
| `estilo.brillo` | Halos, auras, reflejos de cristal y partículas. 0 = sobrio. |
| `tipografia` | Texto, titulares y logotipo. |

Las tarjetas de membresía no se pintan con el color del catálogo tal cual: `theme/tarjeta.ts` le baja la viveza y le
busca la tinta legible, así que una categoría del backend con un color chillón igual sale sobria.

## Procedimiento: «esta es la marca, estos son sus colores, este es su logo»

1. **`src/theme/marca.ts`**:
   - `nombre`, `eslogan`, `principal` y `acento`. Si la marca tiene un solo color, va en `principal` y en `acento`.
   - `estilo.brillo`: 0 para una marca sobria (banco), hasta 1 para una marca luminosa.
   - **Símbolo:** del SVG del logo, reescalado a un lienzo cuadrado (`lienzo`, p. ej. 48):
     - `silueta`: la forma entera, una sola ruta.
     - `luz` y `sombra`: si el logo tiene volumen o dos tonos. Si es plano, `luz` = silueta y `sombra` vacía.
     - `detalle`: una pieza de otro tono (puede ir vacía).
     - `filo` y `cantoDetalle`: trazos finos de luz (pueden ir vacíos).
   - `tipografia` (opcional): si la marca exige su fuente, se instala, se carga en `app/_layout.tsx` (`useFonts`, un
     archivo por grosor) y se nombra aquí. El peso se apaga solo cuando hay fuente propia.
2. **Contraste:** `npx jest __tests__/temas-contraste.test.ts --verbose`. Si algo falla, se ajusta la elección en
   `marca.ts`, nunca el umbral. La corrida imprime los seis colores del icono del arranque.
3. **Iconos del arranque y contorno:**
   `PLAYWRIGHT_DIR=<carpeta con playwright> node scripts/generar-icono-arranque.mjs <seis colores del paso 2>`.
   Escribe `assets/splash-icon.png` y `-oscuro.png`, e imprime `simbolo.contorno`: se copia a `marca.ts` si cambió.
4. **Lo que no es código:**
   - El icono de la app (`assets/icon.png`, `android-icon-*.png`, `favicon.png`) lo entrega el equipo de marca.
   - En `app.json`: `name`, `android.adaptiveIcon.backgroundColor` y los textos de permisos que nombran la marca.
5. **Web antes del bundle:** `public/index.html` repite los fondos del arranque, la tinta y el color del foco, porque se
   leen antes que el JavaScript.
6. **Publicar:**
   - Si solo cambió `src/` (colores, nombre, símbolo, textos): basta una **actualización OTA** (`eas update`), sin
     build nuevo.
   - Si cambiaron iconos, `app.json` o fuentes nuevas: **build nuevo** y TestFlight.
7. **Verificar con capturas**, claro y oscuro, a 390 y 1280 px: Inicio, Ingresar, Pagos, Perfil (la tarjeta), el
   arranque y una celebración. Una marca no está lista sin haberla visto en pantalla.

## Apariencia: claro y oscuro

- Por defecto, **claro**: la entrada es en blanco.
- Perfil › Apariencia guarda la elección (`SecureStore` en el teléfono, `localStorage` en la web) y
  recarga la app. Desde ahí arranca siempre en esa apariencia, incluido el arranque de marca.
- La lectura es síncrona a propósito (ver `preferencia.ts`): los estilos se construyen al cargar
  cada módulo, así que el tema tiene que estar decidido antes de la primera pantalla.
- Límite conocido: el instante del arranque **nativo** (el logotipo fijo, antes de que cargue
  JavaScript) lo dibuja iOS según la apariencia del **teléfono**, no la de la app. Con la app en
  oscuro y el iPhone en claro, ese primer instante sale blanco. Ninguna app puede leer su propia
  preferencia antes de arrancar.
