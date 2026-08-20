# Estrategia de pruebas

Lo que se verifica, cómo, y qué queda explícitamente sin verificar. La trazabilidad tiene prioridad
sobre quedar bien: si algo no se ejecutó, aquí dice que no se ejecutó.

---

## 1. Unitarias del dominio — `npm test`

Cubren la lógica que, si falla, produce un error de dinero o permite algo que el modelo prohíbe.
Corren sin dispositivo ni red.

| Archivo | Qué protege |
|---|---|
| `__tests__/money.test.ts` | Interpretación del importe escrito por una persona ("1.234,50" y "1234.50"), rechazo de decimales sobrantes, reparto sin perder centavos, prohibición de coma flotante |
| `__tests__/policy.test.ts` | Desglose 60/40, `inicial + financiado = bruto` para todo el rango, suma de cuotas igual al financiado, mínimos y máximos |
| `__tests__/purchase-engine.test.ts` | Invariantes adversariales del flujo de compra |

Casos del motor de compra, uno por invariante:

| Caso | Invariante |
|---|---|
| QR activo abre sesión con contexto resuelto en servidor | R14/R16 |
| QR revocado no abre sesión | R15 |
| Token desconocido se rechaza | R14 |
| Sesión consumida no origina una segunda orden | R17 |
| Sesión vencida no origina orden | R16 |
| Importes calculados en servidor y reconciliados | R34/R35 |
| El disponible descuenta reservas activas | R51 |
| Financiado por encima del disponible se rechaza con reason code | R47 |
| Commit origina, consume la reserva y genera calendario de 4 obligaciones | R43 |
| Sin aceptación del comercio no hay commit | R42 |
| Aceptación con hash distinto invalida el commit | R37 |
| Orden vencida no se origina | R38 |
| Decisión vencida aborta el commit aunque la orden siga viva | R47 |
| Reserva no activa aborta el commit | R48 |
| Segundo commit sobre la misma orden se rechaza | R39 |

---

## 2. Integración real contra AtlasBackend

Ejecutada contra el stack completo en Docker (PostgreSQL, Redis, migraciones, API, worker, MinIO),
con el override de desarrollo de `tools/dev-backend/`. Los resultados concretos están en
[`verificacion.md`](verificacion.md).

Cadena verificada: registro → login → verificación de contacto con código real → perfil → economía →
domicilio → referencias → URL firmada → subida al almacenamiento → paquete de identidad → envío a
revisión → habilitación.

---

## 3. Verificación en dispositivo

Emulador Android con la aplicación **instalada** (no Expo Go): compilación nativa con
`npx expo run:android`. La evidencia fotográfica de cada pantalla está en `docs/evidence/`.

---

## 4. Matriz por plataforma

| Caso | Android | iOS |
|---|---|---|
| Arranque y restauración de sesión | verificado | no ejecutado (requiere macOS) |
| Registro y consentimientos | verificado | no ejecutado |
| Verificación de contacto | verificado | no ejecutado |
| Recorrido del registro | verificado | no ejecutado |
| Cámara y captura de documento | verificado | no ejecutado |
| Escaneo de QR | verificado | no ejecutado |
| Compra completa hasta calendario | verificado | no ejecutado |
| QR bancario y evidencia de pago | verificado | no ejecutado |

Las celdas de iOS no están marcadas porque **no se ejecutaron**: este entorno es Windows y la
compilación de iOS exige macOS con Xcode. El código no usa ninguna API exclusiva de Android.

---

## 5. Qué falta antes de producción

1. **E2E móvil** sobre app instalada (Maestro o Detox) para los flujos P0: arranque, registro,
   restauración de sesión, compra y pago.
2. **Pruebas de mutación de cliente**: interceptar el tráfico y alterar `organizationId`, `posId`,
   `financedAmount`, `decisionId` y confirmar que el backend los ignora o rechaza. Hoy la app no los
   envía; falta demostrarlo contra el servidor.
3. **Concurrencia**: dos compras simultáneas que juntas exceden la línea; solo una debe confirmar.
   Requiere el dominio de compra en el backend.
4. **Regresión visual** por pantalla en ambas plataformas.
5. **Accesibilidad** con TalkBack y VoiceOver reales, y con escala de fuente al máximo.
