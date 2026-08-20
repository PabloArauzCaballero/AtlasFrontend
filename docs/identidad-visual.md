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

## 4. Qué NO se hizo, a propósito

- **No se tocó la estructura de las pantallas.** El encargo era estético; mover la jerarquía
  habría invalidado las capturas de evidencia y las pruebas del recorrido.
- **No se añadió movimiento nuevo.** El playbook pide degradar con gracia y respetar «menos
  movimiento»; añadir animación sin ese respeto instalado es deuda, no pulido.
- **No se creó un tema claro.** Los tokens semánticos ya lo permiten (`color.surface.*`), pero la
  identidad publicada es oscura y un tema claro es una decisión de producto, no de implementación.

---

## 5. Si cambia la marca

Se toca `src/theme/tokens.ts` y nada más. Ese es el contrato. Si hay que buscar y reemplazar en
las pantallas, es que alguien escribió un literal y hay que devolverlo al sistema.
