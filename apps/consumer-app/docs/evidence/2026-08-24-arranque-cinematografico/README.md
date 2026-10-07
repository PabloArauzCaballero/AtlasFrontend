# El arranque y el corte de marca, corriendo

Fotogramas extraídos de una grabación del simulador (iPhone 17 Pro, iOS 26.5) del **24 de agosto de
2026**, con la app compilada e instalada — no son maquetas. La secuencia completa está en
`src/ui/splash.tsx`; lo que sigue es la comprobación de que cada beat del guion ocurre de verdad y
en el orden previsto.

| | Qué se ve |
|---|---|
| `01.png` | Barras cinematográficas dentro, fondo con viñeta y grano. Nada más: la marca todavía no existe. |
| `02.png` | El contorno de la «A» **dibujándose solo** (`strokeDashoffset`). |
| `03.png` | Contorno cerrado, justo antes de que entre el relleno. |
| `04.png` | Relleno de marca y travesaño: la letra ya es la marca. |
| `05.png` | **El destello.** Dos fotogramas de blanco: es el golpe, y cae en el mismo instante que el sonido. |
| `06.png` | La **onda expansiva** saliendo del logotipo, con el resplandor de fondo abierto. |
| `07.png` | La onda ya fuera del encuadre; el rótulo empieza a entrar. |
| `08.png` | `ATLAS` letra a letra, con el tracking todavía abierto. |
| `09.png` | La palabra formada. A partir de aquí el respiro y la cámara que atraviesa. |

## El corte de marca (`10-corte.png` … `17-corte.png`)

Grabado en la misma sesión, disparando el flujo `e2e/01-bienvenida.yaml` con **Maestro** —que es lo
que permite tocar «Crear mi cuenta» sin manos—. `maestro test e2e/01-bienvenida.yaml` con la
grabación del simulador corriendo por detrás.

| | Qué se ve |
|---|---|
| `10-corte.png` | El velo empezando a cubrir la bienvenida. |
| `11-corte.png` | Velo opaco; aquí **se navega**, y no se ve porque no hay nada que ver. |
| `12-corte.png` | La marca aparece pequeña: es el **retroceso**, la anticipación antes del empuje. |
| `13-corte.png` | Las **líneas de velocidad** abriéndose desde el centro. |
| `14-corte.png` | Aceleración; la **estela** se distingue como una segunda «A» más apagada detrás. |
| `15-corte.png` | La marca ya más alta que la pantalla. |
| `16-corte.png` | El destino descubriéndose **por dentro del hueco de la «A»**. |
| `17-corte.png` | `Crear cuenta`, montada desde hace medio segundo. |

Grabarlo también desmintió un comentario del código: decía que a escala 9 el trazo era más ancho que
la pantalla y que lo último que se veía era «color de marca plano». No es cierto — la letra tiene un
hueco, y el hueco es justo por donde entra la pantalla nueva (`16-corte.png`). El comentario está
corregido en `src/ui/brand-cut.tsx`; el comportamiento no, porque el que hay es mejor que el que el
comentario describía.

## Dos fallos que sólo se veían grabando

Los dos son de **primer fotograma**, y ninguno aparece en el código leído a ojo:

1. **Un anillo suelto durante todo el intro.** La opacidad de la onda expansiva salía de
   `0.75 * (1 - avance)`, y `avance` vale cero desde el milisegundo cero — así que el anillo estaba
   encendido, con radio 14, detrás de la marca, segundo y medio antes de su impacto. Se arregló con
   una compuerta que lo hace nacer en el instante del golpe.
2. **Las formas animadas se pintan una vez con sus props estáticas** antes de que Reanimated aplique
   las animadas. Sin `opacity={0}` / `strokeDashoffset={CONTORNO}` de partida, ese primer fotograma
   enseñaba la letra ya rellena y el anillo a su radio por defecto.

## Cómo repetirlo

    npx expo run:ios                       # instala en el simulador
    xcrun simctl io <UDID> recordVideo intro.mov &
    xcrun simctl launch <UDID> bo.atlas.consumer
    # en modo desarrollo el bundle tarda ~15 s en bajar de Metro: el intro empieza DESPUÉS
    ffmpeg -ss 15 -t 4 -i intro.mov -vf "fps=20,scale=330:-1,tile=7x4" -frames:v 1 tira.png

El contact sheet es lo que hace visibles los fallos de uno o dos fotogramas; a ojo, sobre el
simulador, ninguno de los dos se percibe como un error — se perciben como «algo raro».

## La bienvenida hablada, sonando de verdad (25-08-2026)

`18-saludo-descargado-en-el-telefono.mp3` — **48.527 bytes, 2,96 s** — es el archivo que la app se
descargó y le entregó a su reproductor después de ingresar. No es una maqueta ni el MP3 falso del
proveedor `fake`: lo sintetizó ElevenLabs a través del worker de locución del motor.

La cadena, verificada de punta a punta contra el stack local:

    app (simulador) → login
      → POST  /api/v1/mobile/welcome-audio            202 · PENDING
      → motor  /v1/workers/audio-tts/runs             RUNNING → SUCCEEDED (≈15 s la primera vez)
         └─ ElevenLabs · voz EXAVITQu4vr4xnSDxMaL · modelo eleven_v3 · plantilla onboarding.welcome.named
      → GET   …/{id}                                  READY
      → GET   …/{id}/audio                            200 · audio/mpeg · 48.527 bytes
      → Library/Caches/atlas-bienvenida-445c5e2f….mp3 ← el mismo archivo, en el teléfono

El toque de «Ingresar» lo dio **Maestro** (`e2e/03-ingreso.yaml`, con el correo y el PIN del cliente
de desarrollo). El fichero en la caché del contenedor de la app es la prueba: el nombre lleva el
identificador de la ejecución del motor, así que se puede casar con la fila del worker.

### Lo que se aprendió

- **«Sin conexión» en el login no era la app.** Los dos primeros intentos fallaron con ese mensaje
  mientras `atlasbackend-api-1` se estaba reiniciando. Antes de tocar nada de red, mirar
  `docker ps` y la columna de `Status`.
- **`e2e/03-ingreso.yaml` da por hecho que el cliente está a medio alta**: espera «Avance de tu
  registro». Con una cuenta ya aprobada —como la de la corrida— el login funciona y la aserción
  falla igualmente. No es una regresión; es que el flujo asume un cliente que todavía no terminó.
