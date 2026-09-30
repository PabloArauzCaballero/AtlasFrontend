# Publicar la app para testers

Dos caminos, y comparten el paso de la API. Lo que NO es obvio esta anotado.

## La API que ven los testers

    https://n2vmpw58-80.brs.devtunnels.ms/api/v1

No es un servidor nuevo: es el devtunnel del **portal interno**, que reescribe `/api/v1` hacia
`http://atlas-backend:3005` en la red de Coolify del H310. Llega al mismo AtlasBackend que usa el
portal, con HTTPS puesto por el tunel y sin pedir login.

    curl https://n2vmpw58-80.brs.devtunnels.ms/api/v1/health    # -> 200 {"status":"ok",...}

Si los testers dicen «sin conexion», ese curl es el primer diagnostico. Un devtunnel puede figurar
como `active (running)` estando caido; la senal buena es `Host connections: 0` en
`devtunnel show atlas-admin`, dentro del H310 (`ssh root@100.101.207.88`).

## Por que las variables estan AQUI y no en el `.env`

`.env` y `.env.local` estan en `.gitignore`, y EAS **no sube los ficheros ignorados**. Un build que
dependiera de ellos saldria con el valor por defecto del codigo —`http://192.168.0.197:3105`, una
IP privada— y la app instalada arrancaria sin poder hablar con nadie. Por eso los cinco
`EXPO_PUBLIC_*` van en el bloque `env` de cada perfil de `eas.json`.

## Camino A — Expo Go (Android, mientras tanto)

Expo Go de las tiendas va por **SDK 54** (`expoGoSdkVersion` en `https://api.expo.dev/v2/versions/latest`)
y esta app es **SDK 57**. Hay que instalar el Expo Go de SDK 57 a mano, y solo existe para Android:

    https://github.com/expo/expo-go-releases/releases/download/Expo-Go-57.0.9/Expo-Go-57.0.9.apk

Luego, en este directorio:

    npx expo start --tunnel

El enlace `exp://…` que imprime es el que se manda. Requiere el Mac encendido y cambia en cada
arranque. En iOS **no hay camino**: el cliente de SDK 57 para iOS solo existe como `.tar.gz` de
simulador.

## Camino B — APK propio (lo que se manda de verdad)

    npm i -g eas-cli        # o usar npx eas-cli en cada orden
    eas login               # interactivo: cuenta de expo.dev
    eas init                # crea el proyecto y da un projectId
    eas build -p android --profile preview

Devuelve una **URL permanente de instalacion** con QR. El tester instala una vez; el Mac puede estar
apagado. Aqui si funcionan mapa, camara, ubicacion en segundo plano, contactos y push, porque es un
binario propio y no el cliente de la tienda.

`eas init` **no puede escribir en `app.config.js`**. El `projectId` se pega a mano en `app.json`:

    "extra": { "eas": { "projectId": "<lo-que-imprima>" } }

`app.config.js` hace `...config.extra`, asi que sobrevive.

## iOS

> **QA sin TestFlight:** ver [docs/distribucion-ios-qa.md](docs/distribucion-ios-qa.md) (build interna `preview` + EAS Update). La API de los testers es hoy la de TEST por HTTPS; lo del devtunnel de arriba está superado.

Necesita Apple Developer ($99/ano). Con la cuenta ya activa:

    eas build -p ios --profile production
    eas submit -p ios --latest        # -> TestFlight

TestFlight es mas simple que la distribucion interna: esta no necesita revision de Apple, pero
obliga a registrar el UDID de cada iPhone y a rehacer el build al anadir uno.

## El mapa en Android necesita una clave

`expo-maps` usa Google Maps en Android y **exige** una clave de Google Cloud (Maps SDK for Android,
restringida a `bo.atlas.consumer` + la huella SHA-1 de la firma de EAS, que da
`eas credentials`). Sin ella el mapa se monta **en gris, sin error**. Se pasa al build como secreto:

    eas secret:create --scope project --name ANDROID_MAPS_API_KEY --value <clave>

Mientras no exista, en Expo Go se ve el respaldo por GPS de `src/ui/mapa-punto.tsx`; en un build de
EAS se vera el mapa gris, que es peor porque no se explica solo.

## Actualizar sin reconstruir

`eas update` empuja cambios de JavaScript a los builds ya instalados, pero necesita `expo-updates`
instalado y configurado (`npx expo install expo-updates && eas update:configure`). No sirve para
Expo Go: los updates con `runtimeVersion` no se cargan ahi.
