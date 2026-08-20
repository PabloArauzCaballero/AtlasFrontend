# Alta de un cliente nuevo, recorrida de punta a punta

Prueba real sobre el APK de release, contra `AtlasBackend` y su base. No hay mocks: cada paso dejó
fila en Postgres y objeto en MinIO.

---

## 1. El usuario de la prueba, y por qué ese

| Dato | Valor | Por qué |
|---|---|---|
| Correo | `pabliarca+onboarding@gmail.com` | Misma casilla real de `pabliarca@gmail.com`, y **hash distinto** |
| Teléfono | `+59176543211` | El `...3210` ya es del cliente 20 |
| Cliente resultante | **21** | El 20 sigue intacto y activo |

El backend normaliza los contactos con `normalizeSensitiveText` —`trim` + `toLowerCase`, nada más—
antes de hashear. No recorta la etiqueta `+tag` de Gmail, así que `pabliarca+onboarding@` y
`pabliarca@` son dos contactos distintos para el sistema y **uno solo** para la bandeja de entrada.
Eso es exactamente lo que hacía falta: un alta nueva de verdad, sin pisar al cliente que ya tiene
línea aprobada.

Verificado después de la prueba:

```
 _id | lifecycle_status |        _created_at
-----+------------------+----------------------------
  20 | active           | 2026-08-19 13:59:22.418+00
  21 | under_review     | 2026-08-20 01:31:33.938+00
```

---

## 2. El recorrido

| Captura | Paso | Qué se comprobó |
|---|---|---|
| `onb-01-registro.png` | Crear cuenta | Nombre, fecha, teléfono, correo, contraseña y **consentimiento de privacidad versionado** (`v1-dev`) |
| `onb-02-verificar-contacto.png` | Verificar contacto | Elección de canal, código con vencimiento y el aviso antifraude |
| `onb-03-progreso.png` | Progreso | 33% → 67% → 83% → 100%, con el paso siguiente siempre nombrado en el botón |
| `onb-04-economia.png` | Situación económica | Situación laboral, empleador, antigüedad, ingresos, gastos y actividad |
| `onb-05-domicilio.png` | Domicilio | Departamento, ciudad, zona y la ubicación **opcional** |
| `onb-06-identidad-camara.png` | Cámara | Permiso pedido con su motivo antes de abrirla |
| `onb-06-identidad.png` | Documento | Tres capturas con **tamaño y SHA-256 a la vista**, número, expedición y vencimiento |
| `onb-07-referencias.png` | Referencias | Dos contactos con relación declarada y aviso previo |
| `onb-08-progreso-100.png` | Progreso completo | Las seis secciones en COMPLETO |
| `onb-09-revision.png` | Revisión | **Solicitud en revisión**, con el detalle de qué sigue |

El código de verificación se leyó del sumidero de desarrollo (`tools/dev-backend/otp-sink.mjs`), que
es donde aterrizan SMS y WhatsApp mientras no hay proveedor real:

```json
{"channel":"sms","to":"+59176543211","body":"Tu código de verificación ATLAS es 875537...","code":"875537"}
```

---

## 3. Lo que la prueba encontró

Tres defectos reales. Los dos primeros bloqueaban el alta por completo.

### 3.1 · El tipo de la foto se declaraba a ciegas — **corregido**

`evidence-upload.ts` enviaba `image/jpeg` fijo. El formato lo elige la cámara: con
`skipProcessing: true` el emulador de Android entrega **PNG**. El backend compara la firma binaria
contra lo declarado (`document-storage.service.ts` · `matchesMagicBytes`) y devolvía
`422 EVIDENCE_CONTENT_TYPE_MISMATCH`.

**Ningún cliente nuevo podía pasar del carnet.**

Costaba verlo desde la app porque el hash **sí** cuadraba —se sube exactamente lo que se lee— y el
422 llegaba a pantalla como «Revisa los datos ingresados», que señala los campos de texto: lo único
que el cliente había escrito bien. Comprobado leyendo el objeto almacenado:

```
89 50 4e 47 0d 0a 1a 0a   →  PNG, declarado como JPEG
```

Ahora el tipo se deduce de los bytes: la extensión es un nombre, la firma es el archivo. Si no es ni
JPEG ni PNG se corta **antes** de subir, con «vuelve a tomarla».

### 3.2 · El envío se daba por no ocurrido si el refresco venía limitado — **corregido**

`revision.tsx` decidía si la solicitud estaba enviada mirando el estado remoto que traía
`session.refresh()`. Pero la pantalla ya venía consultando el estado, así que el refresco inmediato
al envío caía en el limitador:

```
[429] ThrottlerException — GET /customer-onboarding/21/status
[429] ThrottlerException — GET /customers/21/me
```

Resultado: la solicitud **sí** se registró, la pantalla se quedó igual, el cliente volvió a pulsar y
recibió `ONBOARDING_ALREADY_SUBMITTED` presentado como «Revisa los datos». Se le decía que corrigiera
información correcta por una operación que le había salido bien.

Ahora el `200` del envío es la confirmación —que es lo que siempre fue— y el refresco pasa a ser un
adorno que puede fallar. `ONBOARDING_ALREADY_SUBMITTED` se trata como lo que significa: ya está
enviada.

### 3.3 · Los botones bloqueados no dicen qué falta — **pendiente**

En `registro` y en `identidad` el botón principal se queda gris sin decir por qué. En los dos casos
la causa era un campo con **placeholder que parece valor**: `1996-04-12` en la fecha de nacimiento y
`2031-03-10` en el vencimiento del carnet se leen como si ya estuvieran rellenos.

Un cliente frente a esa pantalla ve todo lleno y un botón que no responde. Es el defecto de
usabilidad más caro del recorrido, porque no da ni un hilo del que tirar.

Está anotado en `estado-y-pendientes.md`. Va con el trabajo de motion y refuerzo visual.

---

## 4. Lo que quedó en la base

- `customer.customers` → cliente 21 en `under_review`
- `customer.customer_contact_methods` → teléfono `...3211` **verificado**, correo `gmail.com` sin verificar
- `customer.customer_identity_documents` + evidencia en MinIO bajo `atlas-documents/1/21/`
- `customer.customer_reference_contacts` → dos referencias
- `customer.customer_addresses` y los atributos económicos en `catalog.customer_attribute_values`
- `privacy.customer_consents` → política `v1-dev` con su sello de tiempo

La verificación de identidad quedó en `pending_review` con el motivo
`identity_unknown_provider_status_consent_required`: **no hay proveedor de identidad conectado en
desarrollo**, y el sistema prefiere dejarlo en revisión antes que darlo por verificado. Es la misma
postura que el motor de decisión toma cuando se cae: una avería no se convierte en una respuesta.
