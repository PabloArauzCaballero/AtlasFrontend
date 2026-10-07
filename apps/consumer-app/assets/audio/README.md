# Sonido de marca

`atlas-marca.mp3` es el «ta-dum» de Atlas: los dos golpes que acompanan al logotipo del arranque
(`src/ui/splash.tsx`) y al corte de marca (`src/ui/brand-cut.tsx`). Suena **una vez por apertura de
la app**, respeta el interruptor de silencio del telefono y agacha —no interrumpe— lo que se este
escuchando. Las reglas y el porque de cada una estan en `src/ui/brand-sound.tsx`.

## Como se regenera

    ELEVENLABS_API_KEY=... node tools/generar-sonido-marca.mjs --tomas 4   # candidatos a oido
    cp assets/audio/tomas/toma-03.mp3 assets/audio/atlas-marca.mp3         # el elegido

El script pide el sonido a la API de efectos de ElevenLabs con una descripcion fija; ahi esta el
diseno, comentado linea por linea. `sound-generation` es generativo y no devuelve dos veces lo
mismo, por eso las tomas se escuchan y se elige una en vez de regenerar en cada instalacion: un
sonido de marca que suena distinto en cada compilacion no es un sonido de marca.

`assets/audio/tomas/` esta ignorado por git. El activo elegido SI se versiona.

## Estado

> **El archivo que hay ahora es PROVISIONAL.** Esta sintetizado localmente (dos golpes, transitorio
> brillante a 0 ms e impacto sub-grave a 700 ms) para que la app compile, suene y se pueda probar la
> coreografia completa. Tiene la forma y el ritmo correctos, pero no el timbre.

### Por que sigue siendo provisional teniendo clave (25-08-2026)

La clave de ElevenLabs de la cuenta **funciona** —la locucion de bienvenida se genera con ella y se
oye— pero esta **acotada por permisos**, y el que falta es justo el de este script:

    POST /v1/sound-generation
    401 · "The API key you used is missing the permission sound_generation"

No es un problema de codigo ni de cuota: es el conjunto de permisos de esa clave. Ademas la cuenta
es de plan gratuito, y el proveedor ya rechaza por ahi otras cosas (`402 paid_plan_required` al
pedir voces de biblioteca). Para cerrar esto hace falta **una de dos**:

1. Habilitar el permiso `sound_generation` en esa clave desde el panel de ElevenLabs, o emitir una
   clave nueva que lo tenga. Despues, `node tools/generar-sonido-marca.mjs --tomas 4` y elegir.
2. Encargar el ta-dum fuera de ElevenLabs —una biblioteca de efectos o un estudio— y dejarlo caer
   en `atlas-marca.mp3`. El script se queda igualmente como documentacion del diseno del sonido.

Lo que NO hace falta cambiar es nada del codigo de la app: `src/ui/brand-sound.tsx` reproduce lo que
haya en esa ruta.
