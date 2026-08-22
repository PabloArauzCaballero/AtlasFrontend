# Evidencia — el motor decide la capacidad de pago, PIN, avisos y extracto

Todo sobre el **stack real** (AtlasBackend + AtlasDecisionEngine + MinIO), con el APK de release en
el emulador `AtlasDemo`.

## El hallazgo que originó casi todo esto

La capacidad de pago **no venía del motor**. Tres comprobaciones:

| Comprobación | Qué se encontró |
|---|---|
| Origen del «Límite aprobado Bs 5.000» | `src/sandbox/store.tsx:49` — `DEFAULT_LIMIT = minor(500_000)`, constante en la app, igual para todos |
| Tabla de línea de crédito | No existía en ningún esquema |
| Variables que recibía el motor | 5, **ninguna del cliente**: producto, propósito, moneda, importe y plazo |

Y el backend llamaba al artefacto equivocado (`ATLAS_BNPL_UNDERWRITING`, que solo devuelve
`{"outcome":"APPROVE"}`) mientras el real, `BNPL_CREDIT_DECISION`, ya declaraba **56 entradas y 27
salidas** — incluidas `approved_credit_limit`, `max_affordable_installment`, `affordability_score`
y `scoring`.

## Lo que se construyó

**`UnderwritingFeaturesService`** arma las 56 variables desde el expediente real. Con la clienta 23:
ingreso 6.500 + 800 − gastos 2.400 = **ingreso disponible Bs 4.900**, dato suyo. Cada variable viaja
marcada como `expediente`, `derivado` o **`ausente`**: «no tienes buró» y «tu buró es malo» no son lo
mismo, y la segunda no es culpa del cliente.

**`credit.credit_lines`**, versionada, con índice único parcial que garantiza una sola línea vigente.
**`GET /customers/:id/credit-line`** devuelve el número **con su porqué**.

## El segundo hallazgo: la política rechazaba a todo el país

Al alimentar al motor con datos reales:

> `bureau_score` pesa el **45%** del score de riesgo. En Bolivia no hay buró conectado, así que
> siempre vale 0 y nadie alcanza el umbral de 450. La política vigente **rechazaría al 100% de la
> cartera** — y le diría a la persona «tu puntaje crediticio es bajo» cuando lo que pasa es que no
> tiene ninguno.

Se preparó la corrección **donde corresponde: en el motor**. Con `no_hit_flag`, el peso del buró se
redistribuye sobre lo que Atlas sí sabe — historial de pago dentro de Atlas (×2.9) y estabilidad del
ingreso (×1.5). Máximo 440 de los 450, **a propósito**: un expediente sin buró sabe menos, y
compensarlo al 100% convertiría la ausencia de información en una ventaja.

Suite de regresión `BNPL_THIN_FILE_FULL`, **21/21 casos en verde**, 90.6% de cobertura de nodos:

| Caso | Antes | Después |
|---|---|---|
| Sin buró, buen pagador | riesgo ~100 → RECHAZADO | riesgo **667** → APROBADO |
| Con buró alto | riesgo 652 → APROBADO | riesgo 652 → APROBADO (sin cambios) |
| Sin buró, con moras | RECHAZADO | riesgo **179** → RECHAZADO |

**Falta el paso final**: el motor exige aprobación por **separación de funciones** — quien envía una
versión a revisión no puede aprobarla. Hay que aprobarla desde el portal del motor con un usuario
distinto y desplegarla.

## Las capturas

| # | Archivo | Qué prueba |
|---|---|---|
| 1 | `01-bienvenida-logo-eslogan.png` | Marca centrada con acercamiento, eslogan y paginador |
| 2 | `02-bienvenida-paso-escanear.png` | Recorrido paginado con paralaje |
| 3 | `03-bienvenida-paso-historial.png` | Tercer paso |
| 4 | `04-inicio-linea-del-motor.png` | El límite ya NO es la constante: sale del motor |
| 5 | `05-perfil-puntaje-con-procedencia.png` | Puntaje con barra, tramos y **de dónde salió cada dato** |
| 6 | `06-perfil-mora-cuesta-puntos.png` | «La mora te está costando puntos», con cifras suyas |
| 7 | `07-pestana-avisos.png` | Pestaña de avisos en la barra |
| 8 | `08-preferencias-de-avisos.png` | Preferencias por aviso y canal |
| 9 | `09-extracto-bancario.png` | Las cuatro promesas ANTES del botón |
| 10 | `10-perfil-enlaces-nuevos.png` | Los accesos nuevos en el perfil |

## Dos defectos reales corregidos por el camino

- **El contrato del motor rompía** si los motivos llegaban como texto en vez de objetos: una
  aprobación se perdía como «motor no disponible» por la forma de un campo secundario.
- **La app deducía «falló la prueba de vida» de un puntaje no registrado**, y eso rechazaba a una
  clienta que el proveedor sí había verificado.
- **El cliente HTTP devolvía el sobre entero** cuando el servidor respondía `data: null`: la pantalla
  del extracto pintaba una tarjeta de estado sobre un extracto que no existía.
- **La pestaña de avisos tiraba la app**: el backend envuelve la lista dos veces y `items.filter`
  quedaba `undefined`.

## iOS

No se probó en emulador (no hay macOS aquí), pero se corrigió un fallo que **habría roto la app en
iPhone**: el permiso de HTTP en claro era solo de Android. En iOS, App Transport Security bloquea
HTTP y todas las peticiones al backend local habrían fallado con el mismo síntoma inútil, «Sin
conexión». El plugin ahora escribe también `NSAppTransportSecurity` bajo la misma condición.
Verificado con `expo config --type introspect`.
