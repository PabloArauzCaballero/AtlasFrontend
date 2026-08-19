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

### Pantallas verificadas en el emulador

Capturas en `docs/evidence/`:

| Captura | Qué demuestra |
|---|---|
| `01-bienvenida.png` | Arranque y propuesta de valor |
| `02-registro.png` | Formulario de alta |
| `02-registro-datos.png` | **Validación en vivo**: fecha mal formada marcada en rojo con su mensaje |
| `03-ingresar.png` | Ingreso, con el aviso de bloqueo por intentos |
| `03-ingresar-datos.png` | Credenciales completas y botón habilitado |
| `04-inicio.png` | **Error de red presentado con claridad** cuando la API no responde |

### Matriz por plataforma

| Caso | Android emulador | Android tablet | iOS |
|---|---|---|---|
| Compilación nativa `x86_64` | verificado | no aplica | no ejecutado |
| Compilación nativa `arm64-v8a` | no aplica | verificado (compila) | no ejecutado |
| Instalación del APK | verificado | **bloqueado por el dispositivo** | no ejecutado |
| Arranque y navegación | verificado | no ejecutado | no ejecutado |
| Registro y validaciones | verificado | no ejecutado | no ejecutado |
| Compra completa hasta calendario | **no ejecutado** | no ejecutado | no ejecutado |

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

## 4. Qué falta antes de producción

1. **Recorrido de compra con capturas** — escaneo del QR, monto, evaluación, aceptación del comercio,
   calendario y evidencia de pago. Es lo único del flujo que no llegó a fotografiarse.
2. **E2E móvil** sobre app instalada (Maestro o Detox) para los flujos P0.
3. **Pruebas de mutación de cliente**: interceptar el tráfico y alterar `organizationId`, `posId`,
   `financedAmount`, `decisionId`. Hoy la app no los envía; falta demostrarlo contra el servidor.
4. **Concurrencia**: dos compras simultáneas que juntas exceden la línea; solo una debe confirmar.
5. **Regresión visual** por pantalla en ambas plataformas.
6. **Accesibilidad** con TalkBack y VoiceOver reales, y con escala de fuente al máximo.
