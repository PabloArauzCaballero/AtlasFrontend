# BNPL real de punta a punta — CPA Centro

Recorrido completo contra el backend REAL, no el sandbox de compra.

1. **01** — Cliente (`pabliarca@gmail.com`) con su línea Atlas.
2. **02** — Ingresa el código del comercio a mano: `CPA-CENTRO-01` (el serial del POS de CPA).
3. **03** — El servidor lo resuelve: **CPA Centro Preparacion Academica · VERIFICADO**. El nombre
   lo pone el backend al resolver el serial, no la app.
4. **04** — Compra `ATL-C0BQ1` por Bs 1.000 en **EVALUANDO**: el motor de decisión real decide.
5. **05** — **Crédito aprobado · Decidido por AtlasBackend contra el motor de decisión.**

Lo que cierra el círculo (y antes no ocurría): la solicitud se crea enlazada al comercio
(`partnerProfileId`), así que aparece en el portal de CPA esperando su respuesta. Verificado por API:

- `merchant-credit/7/applications?onlyPending=true` pasó de **0 a 1**.
- Solicitud `CRA-f6db712d…`, Bs 400 financiados, `approved` por el motor, `businessAcceptance: pending`.
- El comercio la **aceptó** desde su sesión → `businessAcceptance: accepted`, y volvió a **0 pendientes**.

## El eslabón que faltaba

`requestLiveDecision` creaba la solicitud real y el motor la decidía, pero NO mandaba el
`partnerProfileId`. La solicitud quedaba huérfana de comercio y el portal del negocio nunca la veía.
El comercio ya viajaba en el contexto de la orden desde que se resolvió el QR; sólo faltaba hilarlo
hasta el `POST /customers/:id/credit-applications`.

## El gate de aprobación del comercio (corrección posterior)

Faltaba el orden correcto: **crédito aprobado → pendiente de aprobación del comercio → recién ahí
se habilita el pago**. El teléfono saltaba directo del crédito aprobado al pago porque un
temporizador local AUTO-ACEPTABA en nombre del comercio (atajo de demo del sandbox).

- **06** — Tras aprobar el crédito, la orden queda en **ESPERANDO COMERCIO** («El comercio debe
  confirmar la venta»), **sin botón de pagar**. No auto-avanza.
- **07** — El comercio acepta desde su ERP; el teléfono lo detecta (sondeo al backend) y **recién
  entonces** habilita **«Pagar Bs 600,00»**.

Para una compra real el auto-aceptar queda deshabilitado; en su lugar el teléfono espera la
aceptación REAL consultando `businessAcceptance` de la solicitud (que ahora el backend expone al
cliente). El disparo automático queda solo para las compras de demostración, sin solicitud real
detrás.
