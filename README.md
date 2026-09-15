# AtlasFrontend

Todo lo que ve **el cliente final de Atlas**: la persona que solicita el crédito.

## Por qué este repositorio existe aparte

Atlas tiene cuatro audiencias y cada una tiene su repositorio. No es una separación caprichosa: son
productos con públicos, ritmos de despliegue y niveles de riesgo distintos, y meterlos en un solo
árbol gigante hace que un cambio de operaciones obligue a revisar la app del cliente.

| Repositorio | Para quién | Qué es |
| --- | --- | --- |
| **AtlasFrontend** (este) | El **solicitante del crédito** | App móvil; mañana, cualquier otra superficie del cliente |
| `AtlasAdminPortal` | Operaciones | Back-office: habilitar clientes, resolver identidad |
| `AtlasDecisionEngineFrontend` | Riesgo | Autoría y gobierno de políticas de decisión |
| `AtlasERPFrontend` | Administración | ERP |

Es un monorepo con Turborepo, no un repositorio de una sola app, porque el cliente final acabará
teniendo más de una superficie —una web para consultar cuotas, un portal de pago— y todas
compartirán la misma identidad, los mismos textos y el mismo cliente de API. Ese día, lo compartido
baja a `packages/` y deja de duplicarse. Hoy hay una sola app y eso está bien: la estructura está
para cuando haga falta, no para lucirla.

## Qué hay dentro

```
apps/
  consumer-app/   App movil (Expo / React Native). Compra BNPL 60/40 en comercios.
packages/         Vacio a proposito: aqui bajara lo comun cuando haya una segunda superficie.
```

## Cómo se trabaja

```bash
npm install          # instala todo el monorepo
npm run verify       # typecheck + pruebas de todas las apps
npm run start        # levanta la app movil (Expo)
```

Cada tarea se declara en `turbo.json`. `typecheck`, `lint` y `test` se cachean; `start` y `android`
no, porque arrancan procesos y una compilación nativa cacheada es una compilación que miente.

## La regla de los formularios

> **Ningún campo sin «qué poner»; ninguna opción sin «qué significa».**

Es la misma regla en los cinco frontends de Atlas, adaptada al móvil, donde no hay ratón y un
tooltip «al pasar por encima» no existe:

- **Todo campo lleva `ayuda`**: una frase que dice qué poner y por qué importa, con un ejemplo si
  el formato no es obvio. Se pinta como un botón ⓘ junto a la etiqueta (26 px dibujados, 48 pt de
  toque, `accessibilityLabel="Ayuda: <etiqueta>"`) que abre una hoja con la explicación; la hoja se
  cierra tocando fuera o con «Listo». Lo hace `FieldLabel`, en `apps/consumer-app/src/ui/help-sheet.tsx`,
  y lo usan `Field`, `IconField`, `DateField`, `PhoneField`, `SelectField`, `PinField`,
  `AmountField`, `CheckRow`, `OptionGroup` y `Switch`.
- **`hint` y `ayuda` son cosas distintas y conviven.** `hint` es el pie corto, siempre visible
  («Alquiler, servicios, deudas»); `ayuda` es la explicación completa que se abre a leer. Si el
  campo falla, el error se pinta encima del hint sin taparlo.
- **Toda opción lleva `detalle`**: qué significa y cuándo elegirla. Se ve siempre en la fila de la
  hoja, como segunda línea, entra en el nombre accesible de la fila y, al elegir la opción, se
  repite bajo el control. Es la misma clave en `OpcionSelect` (`SelectField`) y en `OptionGroup`.
- **Prohibido repetir la etiqueta** («Ciudad: la ciudad») y escribir menos de cuatro palabras.
- **No se inventa**: una lista de nombres propios (departamentos, ciudades, zonas) va sin detalle,
  con `// sin-ayuda: <motivo>`. Un texto que manda el servidor, como el de las preferencias de
  avisos, se usa tal cual, y si no llega no hay ⓘ.
- Todo en español y con tildes.

Lo comprueba `apps/consumer-app/scripts/check-field-help.mjs`: corre dentro de `npm run verify`
(es el primer paso del `test` de la app) y como paso propio en CI. Para lanzarlo solo:
`npm run check:field-help --workspace=atlas-consumer-app`.

## La app móvil

Todo lo suyo vive en `apps/consumer-app`, con su documentación propia:

- `docs/verificacion.md` — qué se ejecutó de verdad, contra qué, y **qué no**.
- `docs/estado-y-pendientes.md` — lo hecho y lo que falta, con el porqué de cada decisión.
- `docs/identidad-visual.md` — el sistema visual y por qué es como es.
- `docs/evidence/` — capturas del recorrido completo sobre un APK de release contra el backend real.

**Compilar para Android en Windows tiene una trampa conocida** y está documentada en
`docs/verificacion.md` §3: CMake espeja la ruta absoluta de cada fuente y desde una ruta larga se
pasa del límite de 260 caracteres. Hay que compilar desde una copia en una ruta corta.

## Ramas

- `main` — lo estable.
- `dev` — donde se integra.

Ambas parten del mismo punto y llevan el mismo trabajo.
