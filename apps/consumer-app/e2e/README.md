# Pruebas E2E de la app, con Maestro

Lo que se comprueba aquí es que la app **se puede recorrer**: que cada pantalla llega, que los
controles responden y que el alta y el acceso funcionan contra un backend real. No sustituye a las
pruebas de dominio —eso vive en `__tests__/`— ni comprueba el movimiento, que se mira en vídeo.

## Cómo se corren

Con la app instalada en un simulador o dispositivo y Metro corriendo:

```bash
maestro test e2e/01-bienvenida.yaml
maestro test -e CORREO="alguien+$(date +%s)@gmail.com" -e TELEFONO=76500123 e2e/02-alta.yaml
maestro test -e CORREO=… -e PIN=… e2e/03-ingreso.yaml
```

Las capturas quedan en `~/.maestro/tests/<fecha>/`.

## Por qué el alta se detiene en la verificación

El servidor manda un código al correo y ese código **no se puede automatizar** sin un sumidero de
correo. Leerlo de la base o saltarse el paso probaría un recorrido que ningún cliente hace, así que
el flujo termina donde termina la parte automatizable y el resto se teclea con el código real.

Cuando exista el sumidero (`tools/dev-backend/otp-sink.mjs` lo hace para SMS por webhook), el flujo
puede continuar hasta el expediente completo.

## Lo que se aprendió escribiéndolos

Está aquí porque cuesta un rato volver a descubrirlo:

- **Los campos se tocan por su placeholder o por su etiqueta de accesibilidad**, no por su texto: en
  cuanto llevan valor, el texto cambia y el flujo deja de encontrarlos.
- **Un control con `accessibilityLabel` esconde el texto de sus hijos.** El selector de fecha se
  toca como `Fecha de nacimiento. Tocar para elegir`, no como «Elige tu fecha».
- **`hideKeyboard` no funciona** en estos simuladores de iOS. El propio desplazamiento cierra el
  teclado, porque `Screen` usa `keyboardDismissMode: on-drag`.
- **El PIN no tiene texto que tocar**: son cuatro casillas sobre un campo oculto, así que se toca
  por coordenada.
- **Los selectores relativos (`below:`) reencuentran el MISMO campo** si el teclado movió el
  reparto; entre campo y campo conviene desplazar y volver a buscar.
