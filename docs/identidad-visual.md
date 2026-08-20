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

Debe devolver **cero líneas**. Si devuelve una, o falta un token o alguien se lo saltó.

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

## 6. Qué NO se hizo, a propósito

- **No se movió la jerarquía de ninguna pantalla.** Los cambios de §4 son de superficie, tipografía
  y profundidad: viven en los tokens y en los primitivos, así que llegan a las veinte pantallas sin
  reordenar ninguna. Ninguna pantalla cambió de contenido ni de orden de lectura.
- **No se añadió movimiento nuevo.** El playbook pide degradar con gracia y respetar «menos
  movimiento»; añadir animación sin ese respeto instalado es deuda, no pulido.
- **No se creó un tema claro.** Los tokens semánticos ya lo permiten (`color.surface.*`), pero la
  identidad publicada es oscura y un tema claro es una decisión de producto, no de implementación.

---

## 7. Si cambia la marca

Se toca `src/theme/tokens.ts` y nada más. Ese es el contrato. Si hay que buscar y reemplazar en
las pantallas, es que alguien escribió un literal y hay que devolverlo al sistema.
