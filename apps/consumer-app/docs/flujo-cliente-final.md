# Flujo del cliente final — Atlas móvil

**Alcance:** exclusivamente la aplicación del **consumidor** (iOS y Android). No cubre el portal del
comercio ni las herramientas de operaciones.

**Fuentes de verdad:**

- `AtlasBackend` — contratos reales de identidad, onboarding, habilitación y crédito.
- `ATLAS_Contexto_Maestro_Empresa_Partner_POS_QR_Orden_Adversarial_v3.md` — dominio de compra,
  QR, orden, commitment, calendario, evidencia de pago y las 90 invariantes adversariales.
- `AtlasLandingPage/assets/css/style.css` — identidad visual (navy, degradado teal→menta,
  tipografía y radios).

---

## 1. El flujo en una línea

> Creo mi cuenta → verifico quién soy → me habilitan una línea → escaneo el QR del comercio →
> escribo el monto → Atlas evalúa → el comercio confirma → pago el 60% al comercio con su QR
> bancario → pago 3 cuotas cada 14 días, también al comercio.

Atlas **no recibe** el dinero de la compra en ningún momento del flujo ordinario. Registra la orden,
la decisión, el calendario, la instrucción y la evidencia.

---

## 2. Mapa de estados del cliente

El estado de la cuenta lo decide el servidor (`lifecycleStatus` + `eligible`), nunca la app.

```
registered ──► onboarding_in_progress ──► under_review ──┬──► active
                                                          ├──► observed ──► (corrige) ──► under_review
                                                          └──► rejected
```

| Estado | Qué ve la persona | Área de la app |
|---|---|---|
| `registered` | "Termina de completar tus datos" | `(onboarding)` |
| `onboarding_in_progress` | Progreso por secciones, siguiente paso | `(onboarding)` |
| `under_review` | "Solicitud en revisión" + qué sigue | `(onboarding)/revision` |
| `observed` | Observaciones accionables | `(onboarding)` |
| `active` | Línea disponible, compras, pagos | `(app)` |
| `rejected` / `suspended` | Mensaje claro, sin controles falsos | `(onboarding)` |

La decisión vive en `areaFor()` (`src/session/session.tsx`) y la aplican `app/index.tsx` y
`app/(app)/_layout.tsx`. Es defensa de interfaz: la autorización real la aplica el backend en cada
petición.

---

## 3. Recorrido pantalla por pantalla

### 3.1 Bienvenida — `(public)/bienvenida`

**Tarea:** entender el producto y decidir entre crear cuenta o entrar.
**No hace:** pedir permisos. Ninguno se solicita al arrancar.

### 3.2 Crear cuenta — `(onboarding)/registro`

| | |
|---|---|
| **Endpoint** | `POST /customer-onboarding/start` (anónimo, idempotente) |
| **Envía** | nombre, apellido, fecha de nacimiento, teléfono, email, contraseña, consentimientos, huella de dispositivo |
| **Recibe** | `customerId`, `lifecycleStatus`, `nextStep` |

- Los consentimientos se leen de `GET /consent-documents/active` y se envía **qué versión** aceptó.
- La huella de dispositivo (`deviceFingerprintHash`) se deriva de un id de instalación aleatorio y
  persistente + marca/modelo/SO. Nunca se envía un identificador de hardware en claro.
- La edad se valida en el cliente (≥ 18) para no gastar un viaje de red, y **también** en el
  servidor, que es donde cuenta.
- Al terminar se inicia sesión automáticamente: la persona no escribe su contraseña dos veces.

**Estados:** validación por campo · error de red con reintento · consentimientos cargando
(esqueleto) · consentimientos no disponibles.

### 3.3 Verificar contacto — `(onboarding)/verificar-contacto`

| | |
|---|---|
| **Endpoints** | `POST .../contact-verification/request` · `POST .../contact-verification/submit` |

- Canales: SMS, WhatsApp, correo. El servidor genera y entrega el código; la app nunca lo conoce.
- Si el canal no está configurado, el servidor responde `VERIFICATION_CHANNEL_UNAVAILABLE` y la
  pantalla lo dice **tal cual** y ofrece otro canal. Nunca "revisa tus mensajes" cuando no se envió
  nada.
- Si el proveedor falla, la respuesta trae `deliveryStatus: delivery_failed`: se muestra el fallo y
  se ofrece reintentar.
- Teclado numérico, `autoComplete="one-time-code"` para autorrelleno del sistema.

### 3.4 Centro de registro — `(onboarding)/progreso`

Hub del onboarding. **El porcentaje, el estado de cada sección y el `nextStep` los calcula el
servidor** (`GET /customer-onboarding/:id/status`). La app los pinta; no los deduce. Se relee al
volver de cada paso: es el servidor quien decide si una sección quedó completa.

### 3.5 Datos personales — `(onboarding)/perfil`

`PATCH .../profile`. Guardado parcial: el backend versiona el perfil en vez de sobrescribirlo.

### 3.6 Situación económica — `(onboarding)/economia`

`PUT .../financial-profile`. Entrada del motor de decisión. Se valida en la app la regla que el
backend ya impone (`employee` exige empleador) para no gastar un viaje de red en un error conocido.

### 3.7 Domicilio — `(onboarding)/domicilio`

`POST .../address-package`. La ubicación GPS es **opcional** y se pide **después** de explicar para
qué sirve. Denegar el permiso no rompe el paso: se registra la decisión y se continúa.

### 3.8 Documento de identidad — `(onboarding)/identidad`

Tres capturas con `expo-camera`: anverso, reverso y selfie. Por cada una:

```
POST documents/upload-url   → el servidor decide la ruta y firma la URL
PUT  <url firmada>          → sube el archivo al almacenamiento con las cabeceras exactas
POST identity-package       → declara storageKey + SHA-256 + tamaño
```

- El SHA-256 se calcula sobre los **bytes** del archivo, no sobre su base64.
- `documentNumberHash` usa la misma convención del backend: `sha256(trim(lowercase(valor)))`.
- El número en claro viaja solo para consultar el registro estatal y **no se persiste**.
- La vigencia del documento se valida: un carnet vencido no es evidencia válida.

### 3.9 Referencias — `(onboarding)/referencias`

`POST .../reference-contacts`. Dos contactos mínimo. **No se lee la agenda del teléfono**: el modelo
de datos decidió no almacenar contactos. La base legal (`consentBasis`) es explícita y depende de si
la persona avisó a su referencia.

### 3.10 Enviar a revisión — `(onboarding)/revision`

`POST .../submit`. Único punto donde el servidor valida completitud. Si falta algo devuelve
`ONBOARDING_INCOMPLETE` con las secciones pendientes, y la pantalla las lista con enlace directo.

Tras enviar, el estado es `under_review`. La pantalla dice exactamente eso: **ni "aprobado" ni
"listo"**. Los bloqueadores se dividen en accionables (los corrige la persona) e informativos (los
resuelve Atlas).

---

## 4. Área autenticada

### 4.1 Inicio — `(app)/(tabs)/index`

Responde en un vistazo las tres preguntas de quien abre la app:

1. **cuánto puedo gastar** → disponible, en tipografía de importe;
2. **cuánto debo** → total pendiente;
3. **qué me vence primero** → próximo pago con su estado.

Debajo, las compras activas. Acción primaria: escanear.

### 4.2 Escanear — `(app)/(tabs)/escanear`

**El QR interno de Atlas no es el QR bancario.** Lleva un token opaco; no lleva `merchant_id`,
`branch_id` ni `pos_id` editables, ni datos bancarios. El servidor resuelve el contexto a partir del
token: fotografiar un QR ajeno no permite cambiar a quién se le paga.

- Cerrojo anti-doble-lectura: un QR permanece en cuadro varios fotogramas.
- Estados reales: QR no reconocido · QR revocado · QR vencido, cada uno con su copy.
- Alternativa sin cámara: ingreso manual del código.
- Permiso de cámara pedido **en el momento**, con explicación y salida cuando está bloqueado.

### 4.3 Monto — `(app)/compra/monto`

Lo único que aporta la persona es el **monto bruto**. La app muestra el plan completo antes de
continuar: 60% inicial, 40% financiado, tres cuotas con sus fechas.

- El importe se captura en centavos exactos (`parseAmountInput`), aceptando "1.234,50" y "1234.50".
- Se valida contra la política vigente (mínimo/máximo) y contra el disponible.
- El desglose visible es **previsualización**; el importe que manda es el que confirma el servidor.
- La sesión de escaneo tiene TTL de 10 minutos y estado propio: expirada se explica y se ofrece
  volver a escanear.

### 4.4 Compra — `(app)/compra/[orderId]`

Acompaña el momento delicado y distingue con claridad cada estado:

```
UNDER_EVALUATION           evaluando crédito
PENDING_MERCHANT_ACCEPTANCE  el comercio debe confirmar el monto exacto
(commitment atómico)       revalidación completa en una sola transacción
WAITING_INITIAL_PAYMENT    falta el 60% inicial
ACTIVE                     cuotas en curso
COMPLETED                  compra pagada
```

`APPROVED` **no** es originado y "el comercio aceptó" **tampoco**. El commit revalida orden,
hash aceptado, decisión vigente y reserva activa; si algo cambió, aborta con un motivo entendible.

### 4.5 Pagar — `(app)/pago/[itemId]`

Muestra el **QR bancario del comercio** —el único instrumento que mueve dinero— con beneficiario,
cuenta enmascarada y monto exacto. Ese QR es un *snapshot*: si el comercio cambia su cuenta mañana,
esta instrucción sigue apuntando al beneficiario vigente cuando se emitió.

Reportar el pago **no** lo marca como pagado: abre una verificación. El estado definitivo lo resuelve
Atlas con la confirmación del comercio. También hay salida a disputa, que **no borra el vencimiento**.

### 4.6 Pagos — `(app)/(tabs)/pagos`

La tabla de doce columnas de escritorio se reinterpreta como lista agrupada por compra: monto,
vencimiento y estado visibles sin abrir nada; el resto en el detalle.

### 4.7 Perfil — `(app)/(tabs)/perfil`

Cuenta, seguridad, ayuda, entorno y cierre de sesión con confirmación nativa. Los identificadores se
muestran enmascarados (`Termina en 0001`, `@dominio`).

---

## 5. Traducción web → móvil

| Patrón de escritorio | Equivalente móvil | Por qué |
|---|---|---|
| Barra lateral | Tabs de 4 destinos | Destinos de primer nivel y recurrentes |
| Tabla de cuotas | Lista agrupada + detalle | Legible sin zoom, jerarquía preservada |
| Modal ancho | Pantalla modal completa | El pulgar no alcanza una esquina |
| Tooltip en hover | Texto de ayuda inline | No hay hover táctil |
| Menú contextual | Acciones explícitas en la tarjeta | El clic derecho no existe |
| Formulario multicolumna | Una columna por paso | Teclado + alcance del pulgar |
| Descarga directa | QR en pantalla + copiar código | No hay carpeta de descargas universal |
| Paginación numerada | Lista continua agrupada | El scroll es el gesto natural |

---

## 6. Reglas de negocio que la app respeta explícitamente

| Invariante | Dónde se aplica |
|---|---|
| R13 QR interno ≠ QR bancario | `escanear.tsx` (interno) vs `pago/[itemId].tsx` (bancario) |
| R14 token opaco sin ids editables | `sandbox/fixtures.ts`, la app envía el token tal cual |
| R15 QR revocado no abre sesión | `engine.openScanSession` + copy propio |
| R17 sesión consumida no origina otra orden | `engine.createOrder` |
| R33/R34 monto validado y `inicial + financiado = bruto` | `domain/policy.ts`, verificado en tests |
| R35 el frontend no envía importes autoritativos | solo se envía el bruto |
| R36/R37 `content_hash` y aceptación exacta | `engine.computeContentHash`, `commitPurchase` |
| R39 un solo commitment por orden | `commitPurchase` → `ALREADY_COMMITTED` |
| R41/R42 aprobado ≠ originado, aceptado ≠ originado | estados separados en `compra/[orderId]` |
| R43/R44 commit atómico que revalida todo | `commitPurchase` |
| R47/R48 decisión vigente y reserva activa | `commitPurchase` |
| R51 disponible = límite − consumido − reservado | `engine.availableCredit` |
| R58/R59 instrucción ≠ prueba, comprobante = evidencia | copy de `pago/[itemId]` |
| R63 el inicial debe resolverse antes de activar cuotas | `confirmMerchantReceipt` |
| R64 la disputa no borra el vencimiento | `openDispute` |
| R75 idempotencia en operaciones críticas | `api/client.ts` (`x-idempotency-key`) |
| R84/R87 dinero en enteros y reconciliación exacta | `domain/money.ts`, verificado en tests |
| Secretos fuera de almacenamiento inseguro | `session/token-storage.ts` (SecureStore) |

---

## 7. Estados obligatorios por pantalla

Toda pantalla con datos implementa: **cargando** (esqueleto con la geometría final, no un spinner
gigante) · **vacío** (qué pasa, por qué y qué hacer) · **error** (tipo distinguido, reintento y
referencia cuando existe) · **sin permiso** (explicación y salida a ajustes) · **expirado**.

---

## 8. Calidad móvil

- **Área táctil** mínima de 48 px con separación, definida una sola vez en las primitivas.
- **Safe areas** en todas las pantallas; ninguna acción crítica bajo el indicador de inicio.
- **Teclado**: tipo por dato, `keyboardShouldPersistTaps`, cierre al arrastrar, acción al pie fuera
  del área del teclado.
- **Háptica** con moderación: confirmación, éxito y advertencia. Nunca en cada toque.
- **Accesibilidad**: roles y etiquetas en todo control, `accessibilityState` en botones y casillas,
  `progressbar` con valor, contraste sobre fondo oscuro.
- **Doble envío**: los botones se bloquean mientras hay operación en curso, y toda operación crítica
  lleva clave de idempotencia.

---

## 9. Origen de los datos

| Dominio | Origen hoy | Estado |
|---|---|---|
| Identidad, onboarding, habilitación, crédito, notificaciones | **AtlasBackend real** | verificado extremo a extremo |
| QR interno, orden, decisión, commitment, calendario, instrucción, evidencia, disputa | **Sandbox local** (`src/sandbox`) | el backend aún no implementa el dominio V3 |

El sandbox implementa las reglas V3 en TypeScript puro y **se declara de forma visible en pantalla**
(`DataSourceBadge`). No hay datos simulados presentados como reales. Cuando el backend exponga el
dominio de compra, se cambia `EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE=live` y se sustituye la
implementación del store: **las pantallas no cambian**.

---

## 10. Pendiente para producción

1. Dominio de compra en el backend (`purchase_order`, `purchase_commitment`, `payment_schedule`,
   `payment_instruction`, `payment_claim`, `payment_status_resolution`).
2. Notificaciones push reales: registro de token (`POST /customers/:id/device-tokens` ya existe) y
   enrutamiento a la pantalla correcta.
3. Enlaces universales para el QR (`https://app.atlas.bo/pos/...`) verificados en ambas tiendas.
4. Verificación de identidad automática contra el proveedor externo, hoy diferida.
5. E2E móvil sobre app instalada (Maestro o Detox) para los flujos P0.
6. Fuentes Sora y Manrope empaquetadas; hoy se usa la pila del sistema con los mismos pesos.
