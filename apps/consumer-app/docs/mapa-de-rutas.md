# Mapa de rutas y contratos

Rutas de Expo Router del cliente final, con el endpoint real que consume cada una.

`(app)` está protegida por `app/(app)/_layout.tsx`; `(onboarding)` exige sesión válida sin cuenta
activa. La decisión la toma `areaFor()` con el estado que devolvió el servidor.

---

## Público

| Ruta | Pantalla | Backend |
|---|---|---|
| `/` | Puerta de entrada, decide el área | — |
| `/(public)/bienvenida` | Marca y valor del producto | — |
| `/(auth)/ingresar` | Ingreso | `POST /auth/login` · `GET /auth/me` |
| `/(auth)/recuperar` | Recuperar contraseña | `POST /auth/password-reset/request` · `.../confirm` |
| `/+not-found` | Enlace inválido o vencido | — |

## Registro

| Ruta | Pantalla | Backend |
|---|---|---|
| `/(onboarding)/registro` | Crear cuenta | `GET /consent-documents/active` · `POST /customer-onboarding/start` |
| `/(onboarding)/verificar-contacto` | Código de verificación | `POST .../contact-verification/request` · `.../submit` |
| `/(onboarding)/progreso` | Centro del registro | `GET /customer-onboarding/:id/status` · `GET /customers/:id/me` |
| `/(onboarding)/perfil` | Datos personales | `PATCH /customer-onboarding/:id/profile` |
| `/(onboarding)/economia` | Situación económica | `PUT /customer-onboarding/:id/financial-profile` |
| `/(onboarding)/domicilio` | Domicilio y GPS opcional | `POST /customer-onboarding/:id/address-package` |
| `/(onboarding)/identidad` | Documento y selfie | `POST .../documents/upload-url` · `PUT <url firmada>` · `POST .../identity-package` |
| `/(onboarding)/referencias` | Referencias personales | `POST /customer-onboarding/:id/reference-contacts` |
| `/(onboarding)/revision` | Enviar y esperar revisión | `POST /customer-onboarding/:id/submit` · `GET .../observations` |

## Área autenticada

| Ruta | Pantalla | Origen |
|---|---|---|
| `/(app)/(tabs)` | Inicio: disponible, próximo pago, compras | `GET /customers/:id/me` + sandbox |
| `/(app)/(tabs)/escanear` | Cámara y QR interno de Atlas | sandbox |
| `/(app)/(tabs)/pagos` | Calendario de cuotas | sandbox |
| `/(app)/(tabs)/perfil` | Cuenta, seguridad, entorno | `GET /customers/:id/me` |
| `/(app)/compra/monto` | Monto y previsualización del plan | sandbox |
| `/(app)/compra/[orderId]` | Evaluación, aceptación, commitment | `GET /customers/:id/credit-products` · `POST /customers/:id/credit-applications` + sandbox |
| `/(app)/pago/[itemId]` | QR bancario del comercio y evidencia | sandbox |

---

## La decisión de crédito

La única parte de la compra que **no** decide el dispositivo. Al escribir el monto:

```
app  ──POST /customers/:id/credit-applications──▶  AtlasBackend
                                                        │ proyecta features del cliente
                                                        ▼
                                                  AtlasDecisionEngineBackend
                                                  POST /v1/decisions/credit_underwriting
                                                        │
     ◀──{ status, decisionMode, executionId }───────────┘
```

| Estado que devuelve el backend | Qué muestra la app |
|---|---|
| `approved` | Crédito aprobado, con `executionId` visible |
| `rejected` | Crédito no aprobado |
| `under_review` con `decisionMode: decision_engine` | En revisión — la política lo pide |
| `under_review` con `decisionMode: engine_unavailable_manual` | En revisión — el motor no respondió |
| cualquier otro | En revisión. **Nunca** aprobación |

Sin `DECISION_ENGINE_BASE_URL` el backend responde `DECISION_ENGINE_NOT_CONFIGURED` y manda todo a
revisión: es el comportamiento correcto de «no llegué a preguntar», no un rechazo.

---

## Endpoints del backend disponibles y aún no consumidos

Existen y quedan listos para conectar cuando el producto los necesite:

| Endpoint | Uso previsto |
|---|---|
| `GET /customers/:id/notifications` · `.../unread-count` · `.../read-all` | Bandeja de notificaciones |
| `POST /customers/:id/device-tokens` | Registro de push tras conceder el permiso |
| `POST /customers/:id/sessions/start` · `.../heartbeat` · `.../end` | Telemetría de sesión y antifraude |
| `GET /customers/:id/credit-products` · `POST .../credit-applications` | Solicitud de línea con producto explícito |
| `POST /auth/mfa` | MFA opcional del cliente |

---

## Enlaces profundos

El esquema es `atlas://` y el enlace universal `https://app.atlas.bo/pos/...`, declarados en
`app.json`. Todo enlace profundo debe validar sesión, permisos y existencia del recurso antes de
mostrar nada; un enlace vencido termina en `/+not-found`, nunca en una pantalla en blanco.

---

## Contrato del dominio de compra (pendiente en el backend)

El sandbox implementa esta forma. Los endpoints que faltan, en el vocabulario del modelo V3:

```
POST /public/pos-qr/scan              → resuelve el token opaco y abre qr_scan_session con TTL
POST /purchase-sessions/:id/orders    → crea purchase_order con importes calculados en servidor
POST /orders/:id/evaluate             → credit_application + credit_decision + credit_reservation
GET  /orders/:id                      → estado, decisión, aceptación y commitment
POST /orders/:id/cancel               → libera reservas
GET  /orders/:id/schedule             → payment_schedule + payment_schedule_item
GET  /payments/:itemId/instruction    → payment_instruction con snapshot del destino verificado
POST /payments/:instructionId/claims  → payment_claim (evidencia, no resolución)
POST /payments/:itemId/disputes       → payment_dispute_case
```

---

## Web

Las mismas rutas se sirven en el navegador (`docs/web.md`). Las que dependen de hardware tienen
sustituto o lo dicen:

| Ruta | En el navegador |
|---|---|
| `/(public)/permisos` | Se salta: no hay agenda ni ubicación continua que pedir. |
| `/(onboarding)/identidad` | Cámara del navegador (`getUserMedia`); exige HTTPS. |
| `/(onboarding)/domicilio` | GPS del navegador si lo concede; sin mapa. |
| `/(onboarding)/referencias` | Sólo entrada manual. |
| `/(app)/(tabs)/escanear` | Lector de QR con `BarcodeDetector`; siempre queda «pegar el código». |
| `/(app)/extracto-bancario`, `/(app)/pago/[itemId]`, `/(app)/pagar/[installmentId]`, `/(app)/soporte/[channelId]` | Selector de archivos del navegador; se lee con `fetch`. |
| `/(app)/preferencias-avisos` | Dice que los avisos llegan a la app del teléfono; sin interruptor. |
