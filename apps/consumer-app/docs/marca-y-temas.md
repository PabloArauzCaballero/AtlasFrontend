# Marca y temas: cómo se cambia la marca de la app

La app está preparada para llevar **cualquier marca**: Atlas es la marca de trabajo. Cambiar de marca
no es rediseñar. Es rellenar un archivo, regenerar unos iconos y comprobar con capturas.

## Cómo está hecho

```
src/theme/marca.ts     ← LA MARCA: nombre, color principal, acento, tipografía. Lo único que se edita.
src/theme/color.ts     ← motor de color (OKLCH): rampas de tono y corrección de contraste. No se toca.
src/theme/temas.ts     ← crearTema('claro' | 'oscuro', marca): todos los roles, calculados. No se toca.
src/theme/tokens.ts    ← espacio, radios, tipografía, movimiento, sombras; `color` = tema activo.
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

## Procedimiento: «esta es la marca, estos son sus colores»

1. **`src/theme/marca.ts`**: `nombre`, `principal`, `acento`.
   - Si la marca tiene un solo color, va en los dos campos.
   - Si el color institucional es muy claro (amarillo, lima), igual va en `principal`: el motor lo
     oscurece para el botón en claro. Conviene enseñarle a la marca las capturas antes de cerrar.
2. **Tipografía** (opcional). Por defecto es la del sistema (SF Pro en iPhone), que es la
   recomendada. Si la marca exige una fuente propia:
   - Se instala (`npx expo install @expo-google-fonts/<fuente>` o los `.ttf` en `assets/fonts`).
   - Se carga en `app/_layout.tsx` (`useFonts`), un archivo por grosor.
   - Se declara en `marca.tipografia.texto` y `.titulares` con el nombre de cada grosor. El peso
     (`fontWeight`) se apaga solo cuando hay fuente propia.
   - `logotipo` es la fuente de la palabra de la marca en el arranque.
3. **Comprobar contraste**: `npx jest __tests__/temas-contraste.test.ts --verbose`. Si algo falla, el
   motor no encontró un tono legible: se corrige la elección en `marca.ts`, nunca el umbral de la prueba.
   La misma corrida imprime «icono del arranque — claro: … · oscuro: …» con los colores del paso 5.
4. **Símbolo de la marca** (la «A» de Atlas):
   - `src/ui/marca-letra.tsx › LETRA_A` tiene la geometría (viewBox 48×48, partida en cara de luz,
     cara de sombra y travesaño). La dibujan el logotipo (`brand.tsx`), el arranque (`splash.tsx`),
     el cargador (`cargador-atlas.tsx`) y la web (`src/web/Cascara.tsx`, `PanelLateral.tsx`,
     `Tarjeta3D.tsx`).
   - Con un símbolo nuevo se reemplazan esos trazados. Si el símbolo no se parte en caras, las tres
     piezas pueden llevar el mismo trazado.
5. **Iconos nativos** (los dibuja el sistema antes que la app):
   - Arranque: `PLAYWRIGHT_DIR=<carpeta con playwright> node scripts/generar-icono-arranque.mjs <svg|atlas> <luz> <sombra> <travesaño> assets/splash-icon.png`,
     y lo mismo con los colores de oscuro hacia `assets/splash-icon-oscuro.png`. Los fondos están en
     `app.json` (`expo-splash-screen`: `#FFFFFF` y `dark.backgroundColor`).
   - Icono de la app: `assets/icon.png`, `android-icon-*.png`, `favicon.png`, y
     `android.adaptiveIcon.backgroundColor` en `app.json`. Vienen del equipo de marca.
   - `app.json › name` y los textos de permisos que nombran la marca.
6. **Web antes del bundle**: `public/index.html` repite los fondos de arranque (`#FFFFFF`,
   `#0A0A0B`), la tinta y el color del foco, porque se leen antes que el JavaScript. Si cambió el
   acento, se cambia el `outline` de `:focus-visible` por `accent.base` de cada tema.
7. **Textos con el nombre**: `grep -rn "Atlas" app src --include='*.tsx'`. Los textos de contenido
   remoto (ayuda, recorrido) vienen del backend.
8. **Verificar con capturas**, claro y oscuro, a 390 y 1280 px (`visual-proof`): Inicio, Ingresar,
   Pagos, Perfil, el arranque y una celebración. Una marca no está lista sin haberla visto en
   pantalla.

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
