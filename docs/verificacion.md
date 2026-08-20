# Verificación ejecutada

Qué se ejecutó de verdad, contra qué, y qué **no**. La trazabilidad tiene prioridad sobre quedar
bien: lo que no se corrió aparece aquí diciendo que no se corrió.

Corrida del **2026-08-19**. Windows 11, Docker Desktop, emulador Android `Pixel_2`
(`sdk_gphone16k_x86_64`) y tablet físico `2505DRP06G` (`arm64-v8a`).

---

## 1. Unitarias del dominio — `npm test`

**40 pruebas en verde**, sin dispositivo ni red. `npx tsc --noEmit` limpio en modo estricto.

| Archivo | Qué protege | Casos |
|---|---|---|
| `__tests__/money.test.ts` | Importes escritos por una persona, reparto sin perder centavos, prohibición de coma flotante | 8 |
| `__tests__/policy.test.ts` | Desglose 60/40, `inicial + financiado = bruto`, suma de cuotas, mínimos y máximos | 8 |
| `__tests__/purchase-engine.test.ts` | Invariantes adversariales del flujo de compra (R14–R51) | 15 |
| `__tests__/credit-evaluation.test.ts` | Traducción de la decisión del backend al dominio de compra | 9 |

Lo que cubre el último, por ser el que sostiene el cableado nuevo:

- el importe aprobado sale del backend; no se infiere ni se redondea en el teléfono;
- `under_review` **nunca** se presenta como rechazo, ni cuando el motor no respondió;
- una avería del motor se distingue de una revisión por política (`decisionMode`);
- un estado que la app no conoce se lee como revisión, jamás como aprobación;
- el `executionId` del motor llega hasta la pantalla.

---

## 2. La decisión de crédito, extremo a extremo

Recorrido completo contra el stack real, con un cliente creado desde cero:

| Paso | Resultado |
|---|---|
| Alta de cuenta con consentimiento | `customerId` emitido |
| Código de verificación | **generado por el backend y leído del sumidero** — no inventado |
| Perfil, economía, domicilio, referencias | aceptados |
| 3 documentos de identidad | **URL firmada + subida real a MinIO** |
| Paquete de identidad y envío a revisión | `lifecycleStatus: under_review` |
| Habilitación y aprobación de identidad (operaciones) | `eligible: true`, `blockers: []` |
| `POST /customers/:id/credit-applications` | `status: approved`, `decisionMode: decision_engine`, `executionId: 2` |

`decisionMode: decision_engine` es lo que distingue una decisión del motor de una revisión humana o
de una avería. La traza, con el registro que el motor guarda de esa misma ejecución, está en
[`evidence/traza-decision.md`](evidence/traza-decision.md): el `requestId` del motor es el código del
expediente del backend y el `inputSnapshotJson` es el payload que el backend proyectó. La cadena se
recorre en los dos sentidos.

### El artefacto que hubo que construir

El demo sembrado en el motor (`BNPL_CREDIT_DECISION`) exige 56 variables de un contrato que
AtlasBackend no emite. Con el payload real habría respondido `422`, y el cliente del backend lee el
422 como «la política dice que no»: un desajuste de contrato se habría presentado al cliente como un
**rechazo de crédito**. Se creó `ATLAS_BNPL_UNDERWRITING` con el contrato correcto
(`requested_amount`, `requested_term_months`, `currency_code`, `product_code`, `purpose_code`) y pasó
por todo el gobierno del motor:

| Control | Resultado |
|---|---|
| Validación y compilación del grafo | `valid: true`, sin errores |
| Suite de regresión **bloqueante** | **PASSED 5/5**, con traza de nodos y aristas por caso |
| Aprobación por dos roles distintos | el motor rechaza que el autor se apruebe a sí mismo |
| Despliegue a PROD | rechazado al autor; aceptado a un principal distinto |

Los cinco casos cubren importe típico, importe justo en el techo, importe por encima, plazo por
encima del producto y **ausencia de importe** — que se rechaza en lugar de dejar pasar un nulo.

### Un defecto de AtlasBackend que solo aparece al ejecutar

La primera solicitud moría con un `409` genérico. La causa: `DecisionSubjectLinkModel` declara
`_created_at` como `allowNull: false` y `SubjectReferenceService.register()` nunca lo asignaba.
Sequelize valida **antes** de enviar la sentencia, así que el insert no llegaba a Postgres —donde la
columna sí tiene `DEFAULT now()`—, y `decision_subject_links` estaba vacía porque este camino no se
había ejecutado nunca. Corregido en `subject-reference.service.ts`; tras el arreglo la tabla registra
el sujeto y la decisión llega.

---

## 3. Compilación y despliegue en dispositivo

### El defecto que impedía compilar en Windows

`ninja: error: ... Filename longer than 260 characters`. CMake **espeja la ruta absoluta de cada
fuente** dentro de `CMakeFiles/<target>.dir/`, y con el proyecto en
`Downloads\Entrypoint-GitHUb\Atlas\AtlasConsumerApp\node_modules\react-native-...` la ruta del objeto
pasaba de 300 caracteres. No era el emulador ni el código: **el APK nunca llegaba a existir**.

| Medida | Qué aportó |
|---|---|
| `LongPathsEnabled=1` en el registro | insuficiente: `ninja` no declara soporte de rutas largas |
| Junction a una ruta corta | insuficiente: el autolinking de Expo resuelve la ruta **real** |
| Compilar desde una copia en `C:\Ap` | acorta 63 caracteres **dos veces**: la ruta aparece en el prefijo y en el espejo |
| `-DCMAKE_OBJECT_PATH_MAX=200` | React Native fija 250, que no alcanza; con 200 CMake acorta el nombre del objeto |
| Borrar `node_modules/*/android/build` y los `.cxx` | los `CMakeLists` generados guardaban rutas absolutas del árbol anterior |

Con esas medidas: **BUILD SUCCESSFUL**. APK release de 82 MB con el JS **embebido**, para `x86_64` y
`arm64-v8a`, que no depende de Metro ni de `adb reverse`.

### El recorrido completo, pantalla por pantalla

Capturas en `docs/evidence/`, tomadas del APK de release instalado y con el backend real detrás:

| Captura | Qué demuestra |
|---|---|
| `01-bienvenida.png` | Arranque y propuesta de valor |
| `02-registro.png` | Formulario de alta |
| `03-ingresar.png` | Ingreso, con el aviso de bloqueo por intentos |
| `03-inicio.png` | **Sesión iniciada**: línea de Bs 5.000,00 y el badge «Entorno sandbox» declarado |
| `04-escanear.png` · `04-escanear-codigos.png` | Permiso de cámara, entrada manual y códigos de prueba |
| `05-monto.png` | **Desglose 60/40 en vivo** y el tope de política (Bs 100.000 rechazado con su motivo) |
| `06-evaluacion.png` | Orden creada, en evaluación, con el contexto del comercio resuelto del token |
| `06b-motor-caido-va-a-revision.png` | **El motor caído manda a REVISIÓN, no a rechazo**, y la pantalla lo dice |
| `07-decision.png` | **Crédito aprobado** y la compra pidiendo el inicial |
| `08-calendario.png` · `09-calendario-completo.png` | Trazabilidad de la decisión y calendario de 4 obligaciones |
| `10-pago-qr.png` · `11-pago-detalle.png` | **QR bancario del comercio** con el monto exacto y su vigencia |
| `12-evidencia-pago.png` | Beneficiario, cuenta, y «tu comprobante es evidencia, no confirma el pago» |
| `08-pagos.png` | Calendario consolidado de pagos |
| `13-qr-revocado.png` | **QR revocado rechazado** — «Este código fue revocado por seguridad» (R15) |
| `14-perfil.png` | Perfil con **minimización de datos**: el teléfono solo por sus 4 últimos, el correo solo por su dominio |

Dos capturas merecen mirarse juntas, porque son el mismo invariante visto por sus dos caras:

- `06b` se tomó con el motor de decisión **apagado**. La pantalla muestra «EN REVISIÓN» y el pie
  dice `modo engine_unavailable_manual`. Una avería no se convirtió en un rechazo.
- `08-calendario.png` se tomó con el motor **vivo**. El mismo pie dice
  `solicitud CRA-52d3cfd1-… · ejecución 5 · modo decision_engine`, y ese `5` es el `executionId`
  que el motor guardó en su propia auditoría.

Las dos caras quedan también en la tabla del backend, que es donde se decide de verdad:

```
 _id |    status    |       decision_mode       | decision_execution_id
-----+--------------+---------------------------+-----------------------
   9 | under_review | engine_unavailable_manual |
   8 | approved     | decision_engine           | 6
   7 | approved     | decision_engine           | 5
```

`under_review` sin ejecución es el motor apagado; `approved` con ejecución es el motor
respondiendo. Ninguna de las dos filas es un rechazo, que es justo el punto.

> Todas las capturas de esta tabla se retomaron después del rediseño tipográfico, así que lo que
> se ve es Sora/Manrope cargadas, no la fuente del sistema. Ver `identidad-visual.md`.

### Matriz por plataforma

| Caso | Android emulador | Android tablet | iOS |
|---|---|---|---|
| Compilación nativa `x86_64` | verificado | no aplica | no ejecutado |
| Compilación nativa `arm64-v8a` | no aplica | verificado (compila) | no ejecutado |
| Instalación del APK | verificado | **bloqueado por el dispositivo** | no ejecutado |
| Arranque y navegación | verificado | no ejecutado | no ejecutado |
| Registro y validaciones | verificado | no ejecutado | no ejecutado |
| Compra completa hasta calendario | **verificado** | no ejecutado | no ejecutado |
| Rechazo por QR revocado | **verificado** | no ejecutado | no ejecutado |
| QR bancario y evidencia de pago | **verificado** | no ejecutado | no ejecutado |

El tablet Xiaomi rechaza `adb install` con `INSTALL_FAILED_USER_RESTRICTED` mientras no se active
**«Instalar vía USB»** en las opciones de desarrollador. Es una restricción del dispositivo, no del
APK: la instalación en el emulador con el mismo fichero funciona.

Las celdas de iOS no están marcadas porque **no se ejecutaron**: este entorno es Windows y la
compilación de iOS exige macOS con Xcode. El código no usa ninguna API exclusiva de Android.

### Una nota sobre la dirección de la API

`localhost` no sirve dentro del emulador, pero **la IP LAN del anfitrión tampoco**: el emulador la
enruta por su NAT y no llega. La dirección que sí resuelve desde el emulador es `10.0.2.2`. En un
teléfono real sobre la misma red ocurre lo contrario: `10.0.2.2` no existe y hay que usar la IP LAN.
Por eso `EXPO_PUBLIC_ATLAS_API_URL` es una variable y no una constante.

---

## 4. Cómo reproducirlo

El estado de la base y los pendientes con su detalle están en
[`estado-y-pendientes.md`](estado-y-pendientes.md). En resumen:

- el producto de crédito lo siembra
  `AtlasBackend/src/database/seeders/development/20260819100000-seed-producto-bnpl-desarrollo.ts`;
- el cliente habilitado se aprovisiona con `tools/dev-backend/provision-demo-customer.mjs`, que
  recorre la API real porque la elegibilidad **no es una columna que se pueda poner a mano**;
- el artefacto del motor todavía vive solo en la base local (TODO-2).

---

## 5. El registro completo, hecho DESDE LAS PANTALLAS

Corrida del **2026-08-20** sobre el APK de release instalado en el emulador `AtlasDemo`, contra
AtlasBackend y el motor de decisión reales. Es la diferencia con §2: allí el expediente lo creó el
aprovisionador contra la API; aquí se tecleó en la app, pantalla por pantalla.

La distinción importa. Un script que llama a los endpoints demuestra que **el servidor** funciona.
Solo recorrer las pantallas demuestra que el cliente puede llegar hasta el final: que los botones se
habilitan cuando deben, que la cámara entrega un archivo que el almacenamiento acepta, y que lo que
la pantalla dice coincide con lo que el backend cree.

**Cliente: Valeria Méndez (`customerId 23`), creada desde cero.**

| Paso en la app | Verificado contra el backend |
|---|---|
| Crear cuenta + consentimiento | `customerId 23` emitido |
| Código por SMS | **generado por el backend**, leído del sumidero: `469653` |
| Verificar contacto | `contact_verification = completed` · avance 33 % |
| Situación económica | `financial_profile = completed` · 50 % |
| Domicilio | `address = completed` · 67 % |
| Referencias (2) | `reference_contacts = completed` · 83 % |
| Carnet: anverso, reverso y selfie | 3 subidas reales con hashes distintos · `identity_documents = completed` · **100 %**, `canSubmit: true` |
| Enviar solicitud | `Solicitud en revisión` |
| Decisiones de operaciones | `status: active`, `eligible: true`, **sin bloqueos** |
| Compra de Bs 1.200 | `APROBADO` en pantalla |
| Ejecución en el motor | **`decision_execution` 8** — `ATLAS_BNPL_UNDERWRITING`, `SUCCEEDED`, `APPROVE`, `requestId` = `credit-app-CRA-6f5dd817…` |

El avance no se leyó de la pantalla: se consultó `GET /customer-onboarding/23/status` después de
cada paso. La pantalla y el servidor coincidieron en los seis.

Las dos decisiones de operaciones **no son del cliente**: las toma un operador desde el back-office y
son deliberadamente humanas. Se resolvieron con `tools/dev-backend/approve-customer.mjs`, que pega
contra los mismos endpoints que usa el portal. Lo único que ahorra es abrir el portal.

Capturas en `evidence/30-…` a `evidence/45-…`.

### Un defecto encontrado y corregido durante esta corrida

La subida del carnet falló con **«Algo no salió bien»** y, lo que la hacía difícil, **sin una sola
línea en los registros del servidor**. La causa estaba en el propio arreglo de tráfico en claro: el
`network_security_config` permitía HTTP solo hacia el host de la API, y la app **no habla solo con la
API** — sigue las URLs firmadas hacia el almacenamiento de objetos, que vive en otro host y no se
conoce al compilar. La petición nunca salía del dispositivo, y por eso el servidor no tenía nada que
contar.

Se comprobó por separado que el emulador **sí** alcanza el almacenamiento, así que el bloqueo era la
configuración y no la red. Detalle y criterio en `estado-y-pendientes.md`, TODO-3-bis.

---

## 6. Qué falta antes de producción

1. **E2E móvil** sobre app instalada (Maestro o Detox) para los flujos P0.
2. **Pruebas de mutación de cliente**: interceptar el tráfico y alterar `organizationId`, `posId`,
   `financedAmount`, `decisionId`. Hoy la app no los envía; falta demostrarlo contra el servidor.
3. **Concurrencia**: dos compras simultáneas que juntas exceden la línea; solo una debe confirmar.
4. **Regresión visual** por pantalla en ambas plataformas.
5. **Accesibilidad** con TalkBack y VoiceOver reales, y con escala de fuente al máximo.
