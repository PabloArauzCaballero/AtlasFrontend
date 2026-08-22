# Identidad visual de la app

Cómo se ve ATLAS en el móvil y por qué. La fuente de verdad es la identidad ya publicada en
`AtlasLandingPage` (`assets/css/style.css` y `PLAYBOOK-DISENO.md`): **la app no inventa una
estética, realiza la que ya existe.**

---

## 1. La regla que lo gobierna todo

> Ningún componente escribe un color, un radio, una fuente o un espaciado literal.
> Si un valor no está en `src/theme/tokens.ts`, no existe.

Es la regla del playbook («un solo sistema») portada a React Native. Se puede verificar:

```bash
grep -rnE "#[0-9a-fA-F]{6}|rgba\(" src app --include=*.tsx | grep -v theme/tokens
```

Debe devolver **cero líneas**, con una única excepción documentada: `WHATSAPP_INK` en
`src/ui/content.tsx`. Es el verde de una marca ajena —quien busca ayuda no lee, busca el verde— y
está fuera de los tokens precisamente para que no pueda usarse para ninguna otra cosa.

Cualquier otra línea significa que falta un token o que alguien se lo saltó.

---

## 2. Tipografía: el defecto que hacía que la app no pareciera Atlas

Durante un tiempo `tokens.ts` declaró `Sora` y `Manrope`… y **no las cargaba nadie**. No estaban
`expo-font` ni las familias instaladas, ningún componente aplicaba `fontFamily`, y `font` era un
objeto que no importaba nadie. La app entera se dibujaba con la fuente del sistema.

El síntoma era difuso —«se ve genérica», «no parece nuestra»— y la causa era exacta: **la
tipografía es lo que más identidad carga en una interfaz**, y era justo lo único de la identidad
que no había llegado al producto.

### Cómo está resuelto

- Las familias se cargan en `app/_layout.tsx` con `useFonts`, y el splash **espera a las dos
  cosas**: sesión restaurada y tipografía lista. Descontar solo la sesión dejaba entrar la app
  dibujada con la fuente del sistema y cambiarla un instante después, con el salto de todos los
  textos a la vista.
- Si una fuente falla, la app arranca igual con la del sistema. Quedarse en el splash por un
  problema tipográfico dejaría al cliente sin poder pagar su cuota.

### El reparto

| Rol | Familia | Por qué |
|---|---|---|
| Titulares e importes | **Sora** | Lo que se lee de un vistazo. Tiene personalidad y aguanta el tamaño grande. |
| Cuerpo, etiquetas, ayudas | **Manrope** | Lo que se lee de verdad. Sora en un párrafo cansa. |

**Ningún estilo lleva `fontWeight`.** El grosor viaja en el nombre de la familia
(`Sora_700Bold`, `Manrope_500Medium`…). En Android `fontWeight` no interpola sobre una fuente
cargada: o existe el archivo de ese grosor, o el sistema finge la negrita engordando los trazos, y
ese engorde es exactamente lo que hace que una app se vea barata al lado de su propia web.

### Cifras tabulares

`amount` y `amountSmall` llevan `fontVariant: ['tabular-nums']`. Con cifras proporcionales el «1»
es más estrecho que el «8» y una columna de importes baila de fila en fila. En dinero eso no es un
detalle tipográfico: es la diferencia entre leer un saldo y tener que releerlo.

---

## 3. El degradado: se gasta una sola vez

El degradado azul → teal → menta es la firma de la identidad. En la app aparece en **una sola
superficie**: la tarjeta de la línea de crédito en Inicio, que responde la pregunta con la que se
abre la app —cuánto puedo gastar—. Todo lo demás se queda en navy plano para que esa sea la que el
ojo encuentra primero.

Repetirlo en cada tarjeta lo convertiría en papel pintado: cuando todo destaca, no destaca nada.

### Por qué un lavado y no un plano saturado

Sobre el degradado vivo no hay **un solo color de texto que aguante todo el recorrido**: el claro
se pierde en el extremo menta y el oscuro en el navy. Se usa el lavado tenue (`--g-soft` en la
web), que tiñe sin mover el contraste, y el degradado pleno se reserva para el filo de 1 px.

> **La trampa, documentada porque se cayó en ella.** El lavado se define con alfa. Sin una base
> **opaca** debajo, lo que se ve por transparencia es el degradado del filo, y la tarjeta se
> convierte en un plano menta saturado donde el texto secundario deja de leerse. Por eso
> `brandPanelSurface` lleva `backgroundColor` explícito: el orden es *filo → base opaca → tinte →
> contenido*, y saltarse la base rompe el contraste sin que ningún tipo lo detecte.

### El filo

React Native no tiene bordes con degradado. El truco: un degradado de 1 px de grosor con la
superficie encima; lo que asoma por el contorno **es** el borde. Vive en `BrandPanel` para que
ninguna pantalla tenga que conocerlo.

---

## 4. Profundidad: por qué la app se veía plana

Los tokens estaban bien portados desde el primer día. Lo que fallaba era **cómo se aplicaban**, y
por eso la app se leía como una web sin terminar en vez de como un producto financiero.

### Las tarjetas no existían

`surface.raised` era `rgba(255,255,255,0.04)`. Sobre un navy tan profundo, ese 4 % no llega a
separarse del papel: la pantalla entera se leía como **un solo plano con texto suelto encima**, y
ninguna sombra podía arreglarlo porque no había nada que proyectara sombra.

Ahora es una superficie **opaca** (`palette.bgCard`, tres pasos por encima del fondo) con tres
cosas que van juntas y solas no bastan:

1. **Sombra grande y muy difusa** —`0 16px 32px` al 55 %—, como el `--sh` de la web. Sobre fondo
   oscuro lo que separa una superficie del papel es el **tamaño del desenfoque**, no su opacidad:
   una sombra corta y dura es negro sobre negro.
2. **Filo superior iluminado**: el borde de arriba, 1 px más claro que el resto del contorno. Es
   como se lee un objeto físico —la luz cae desde arriba y el canto la recoge—.
3. **Menos aire dentro.** Las filas tenían tanto relleno vertical que cada una flotaba en su propio
   bloque y la tarjeta se leía como un menú de ajustes del sistema. Lo que agrupa una lista es la
   proximidad.

### Los campos eran pedestales, no huecos

Un campo de texto es un sitio donde se escribe. Estaba pintado del mismo color que la superficie
que lo contiene, así que dejaba de leerse como zona editable. Ahora usa `surface.sunken` —más
oscuro que la tarjeta—: el hueco se ve hueco. El foco, además, engorda el borde a 1,5 px: con un
solo píxel de color, en una pantalla oscura, no se distingue cuál de seis campos tiene el cursor.

### La acción principal no era una fuente de luz

Era un rectángulo relleno de menta plano. En la identidad publicada la llamada a la acción es un
**degradado con halo**, y esa es la diferencia entre una superficie iluminada y un rectángulo
pintado. El halo (`shadow.brandGlow`) se reserva a **una acción por pantalla**: si brillan dos, no
brilla ninguna.

Por la misma regla, la **opción elegida se tiñe en vez de rellenarse**. Rellenarla de menta ponía
en pantalla dos bloques del mismo color saturado —la opción y el botón—, y cuando dos elementos
gritan igual el que pierde es el que tenía que mandar.

### El importe llevaba negrita fingida

`AmountField` usaba `fontWeight: '700'`, justo lo que §2 de este documento prohíbe. Era la única
cifra de la app dibujada con el engorde del sistema en vez de con la familia real, y encima perdía
las cifras tabulares. Es el número más importante de la app.

---

## 5. La marca en el sistema operativo

El icono del lanzador y la pantalla de arranque eran **los marcadores de posición de Expo**: la «A»
azul sobre celeste con guías de construcción, y una rejilla gris con círculos. Es lo primero que ve
cualquiera —antes que ninguna pantalla— y decía que la app no estaba terminada.

Se generaron desde el **mismo trazado SVG que dibuja `src/ui/brand.tsx`**, para que el icono del
teléfono y el logotipo de dentro sean el mismo objeto y no dos dibujos parecidos:

| Archivo | Qué es |
| --- | --- |
| `icon.png` | Marca sobre navy con halo de marca detrás |
| `splash-icon.png` | La misma marca, más pequeña, sobre el fondo exacto de la app |
| `android-icon-foreground.png` | Capa delantera del icono adaptativo, en su zona segura |
| `android-icon-background.png` | Capa de fondo, navy sólido |
| `android-icon-monochrome.png` | Silueta blanca sobre transparente, para iconos con tema |

El fondo del arranque era `#0B1220` y el de la app `#061426`: al entrar se veía un **escalón de
color**. Ahora los dos son `#061426` y la transición no se nota, que es justo lo que tiene que
pasar.

---

## 6. Movimiento

Durante un tiempo este documento decía, en §6, que **no se había añadido movimiento nuevo** a
propósito: el playbook pide degradar con gracia y respetar «menos movimiento», y animar sin ese
respeto instalado es deuda. El respeto ya está instalado —`useReducedMotion` se consulta en cada
componente que anima— así que el movimiento entró, y entró como sistema, no como adornos sueltos.

### Dos temperamentos, y cuándo va cada uno

| | Se usa para | Token |
|---|---|---|
| **Curva** | Lo que ocurre solo: aparecer, cubrir, descubrir | `motion.*` + `easing.*` |
| **Muelle** | Lo que responde al dedo: hundirse, asentarse, viajar | `spring.*` |

La diferencia no es decorativa. Una duración fija reparte el mismo tiempo para un recorrido de 4 px
y para uno que cruza la pantalla, y por eso el corto parece lento y el largo, disparado. Un muelle
reparte la energía según la distancia. A cambio, un muelle no sirve para nada que tenga que estar
tapando la pantalla en un instante exacto —ahí manda la curva—.

**Los tres muelles están sobreamortiguados a propósito** (`press`, `settle`, `glide`): llegan y se
quedan, sin rebasar el destino. Lo que hace que una app parezca un juguete es el rebote, no el
muelle; ésta es una app donde la gente mira cuánto debe. Lo que se gana es que la desaceleración
deje de ser una rampa.

### La pulsación: un solo comportamiento en toda la app

`PressSurface` (`src/ui/motion.tsx`) anima **el propio pulsable**, no una vista interior, con un
valor compartido en el hilo de UI. Dos consecuencias que importan:

- El estado `pressed` de `Pressable` es estado de React: entra y sale de golpe, sin fotogramas
  intermedios, y **se pierde si algo re-renderiza en mitad del toque** —justo lo que pasa cuando el
  control dispara una petición—.
- Como el elemento animado es el que lleva los estilos, un ancho en porcentaje o un `flex` siguen
  funcionando: por eso una celda de la rejilla del calendario también puede hundirse.

Se comprueba con `grep -rn "pressed &&" src app`: debe devolver **cero líneas**. Cada una que
devuelva es un control con un temperamento distinto al de sus vecinos.

Las escalas: `press.scale` (0.97) para lo que se toca de uno en uno, `press.scaleSubtle` (0.985)
para filas anchas y tarjetas, donde el 3 % desplaza el borde lo suficiente como para parecer un
salto.

### Las transiciones de pantalla son las del sistema

`animation: 'default'` en las tres pilas. `slide_from_right` está documentado como **solo Android**
en Expo 57: forzarlo no daba «deslizar en iOS», renunciaba al empuje nativo de UIKit —paralaje de
la pantalla de abajo, sombra, y sobre todo el gesto de volver **interactivo**, enganchado al dedo y
cancelable a medio camino—. Nada de eso se puede reimplementar con una animación declarada, y es
justo lo que un usuario de iOS reconoce como «nativo» sin saber nombrarlo.

Las pantallas de tarea acotada (`compra/monto`, `pago/[itemId]`) se declaran con
`presentation: 'modal'` y nada más en iOS; el deslizamiento desde abajo se añade **solo en
Android**, donde `modal` equivale a `push` y sin él no se distinguiría de un paso más del flujo.

### El corte de marca

Salir de la bienvenida —hacia el registro o hacia el acceso— atraviesa la marca: la cámara se
acerca al logotipo hasta cruzarlo y la pantalla de destino queda detrás (`src/ui/brand-cut.tsx`).
Es el único movimiento de la app que pasa del cuarto de segundo (`motion.brandCut`, 560 ms), y se
lo puede permitir porque ocurre **una vez por sesión** y porque durante él la app no hace esperar a
nadie: el destino se monta detrás mientras la marca cubre.

No se usa para pasar de página del carrusel. El corte marca un **límite**; usarlo en cada toque lo
convertiría en un peaje de medio segundo repetido cuatro veces.

### Lo demás que se mueve, y por qué

- **El foco del recorrido guiado viaja** entre pasos en vez de reaparecer en otro sitio. Cuando el
  recorte salta, cada paso obliga a buscar dónde está ahora el hueco; cuando se desplaza, el ojo lo
  sigue y llega al elemento nuevo ya mirándolo.
- **Los puntos del carrusel están atados al dedo**, no al final del gesto: el que se deja se encoge
  y el que llega se alarga a la vez que la página. Además informa de algo que el salto no decía:
  que el gesto se puede cancelar volviendo atrás.
- **El icono de la pestaña activa se asienta** con un realce del 8 %. Deliberadamente pequeño: la
  barra está siempre en pantalla, y lo que se busca no es que se note la animación sino que la
  mirada tenga a dónde volver después de que el contenido haya cambiado entero.
- **Los halos del fondo son degradados radiales** (`BrandHalo`), no vistas redondeadas. Un círculo
  de color plano al 16 % sobre el navy no es un resplandor: es un círculo, con su borde definido, y
  el ojo lo detecta incluso a opacidades muy bajas. Aplanaba la pantalla contra dos formas
  geométricas en lugar de darle profundidad.

### «Menos movimiento» no es «lo mismo pero rápido»

Con el ajuste del sistema activo:

| | Con movimiento reducido |
|---|---|
| Corte de marca | **No hay corte.** La acción se ejecuta en el acto |
| Hundimiento al tocar | No hay escala; el control responde igual |
| Entrada de bloques (`Appear`) | Aparecen en su sitio, sin subir |
| Paralaje y puntos del carrusel | Sin interpolación; el punto activo se pinta ancho |
| Foco del recorrido guiado | Se coloca, no viaja |

Una capa que tapa la pantalla entera es exactamente el tipo de movimiento que provoca mareo, y
degradarla a una versión corta de sí misma no lo arregla: hay que quitarla.

### El hilo en el que corre

Todas las animaciones son de Reanimated y corren en el **hilo de UI**. Durante una decisión de
crédito el hilo de JS está ocupado —petición, parseo, re-render— y con animaciones dependientes de
JS eso se ve como tirones justo en el momento en que el usuario más atento está. Por lo mismo, el
progreso del carrusel se lee con `useAnimatedScrollHandler` y no con `onScroll`: a JS solo vuelve
el número de página, y solo cuando cambia.

---

## 7. Qué NO se hizo, a propósito

- **No se movió la jerarquía de ninguna pantalla.** Los cambios de §4 son de superficie, tipografía
  y profundidad: viven en los tokens y en los primitivos, así que llegan a las veinte pantallas sin
  reordenar ninguna. Ninguna pantalla cambió de contenido ni de orden de lectura.
- **No se animó nada que no responda a una acción o a un cambio de estado.** No hay entradas
  decorativas, ni contadores que se animen solos, ni la cifra de la línea de crédito subiendo cada
  vez que se abre el inicio: animar un número que ya estaba ahí lo vuelve ilegible durante el primer
  instante, que es justo cuando se lo quiere leer. Ver §6.
- **No se creó un tema claro.** Los tokens semánticos ya lo permiten (`color.surface.*`), pero la
  identidad publicada es oscura y un tema claro es una decisión de producto, no de implementación.

---

## 8. Si cambia la marca

Se toca `src/theme/tokens.ts` y nada más. Ese es el contrato. Si hay que buscar y reemplazar en
las pantallas, es que alguien escribió un literal y hay que devolverlo al sistema.
