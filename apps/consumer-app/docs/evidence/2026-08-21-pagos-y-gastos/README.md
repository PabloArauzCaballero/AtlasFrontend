# Evidencia — pagos, gasto por rubro, mora, calificación y PDF

Recorrido completo sobre el **stack real** (AtlasBackend + AtlasDecisionEngine + MinIO), con el APK
de release instalado en el emulador `AtlasDemo`. Ningún dato de esta evidencia está mockeado.

## Los datos que se ven

| Pieza | Valor real |
|---|---|
| Cliente | Valeria Méndez · `customerId 23` |
| Comercio 1 | **CPA Centro de Preparación Académica** · `partnerId 6` · rubro `educacion` |
| Comercio 2 | **Tecno Andina** · `partnerId 7` · rubro `electronica` |
| Usuario del portal de ambos | `cpacentropreaparacionacademica@gmail.com` |
| Créditos | `LOAN-0c29b128` Bs 1.800 · `LOAN-f3398198` Bs 900 (en mora) · `LOAN-9e61b705` Bs 3.200 |
| Decisiones del motor | ejecuciones **14**, **15** y **16**, `decisionMode: decision_engine` |
| Mora | Bs 900 · 40 días de atraso · tramo `dpd_30_59` |
| Calificación | **C · Deficiente · categoría 3 de 6** |

La compra en mora se creó con `firstDueDate` en el pasado a través del endpoint real de desembolso,
no editando la base: las cuotas vencidas son cuotas de verdad.

## Las capturas

| # | Archivo | Qué prueba |
|---|---|---|
| 1 | `01-arranque.png` | La app instalada desde el APK de release |
| 2 | `02-inicio-mora.png` | **El aviso de mora es lo primero**, por encima de la línea disponible, con el enlace a términos |
| 3 | `03-tablero-categorias.png` | Gasto por rubro con icono, porcentaje y comercio; totales financiado / por pagar |
| 4 | `04-banner-partner.png` | Banner de partner al final del inicio, etiquetado «espacio de partner» |
| 5 | `05-pagos-mora-primero.png` | Pagos: vencido en rojo, por-vencer en ámbar, filtros y comercios |
| 6 | `06-pagos-cuadricula.png` | Vista en cuadrícula y resumen por rubro al final |
| 7 | `07-comercio-creditos.png` | Segundo nivel: los créditos de un comercio |
| 8 | `08-credito-cuotas.png` | Tercer nivel: cuotas vencidas en rojo y la traza al motor |
| 9 | `09-perfil-calificacion.png` | Calificación crediticia con su posición en la escala |
| 10 | `10-politica-mora.png` | Política de mora servida por el backend, con su versión y origen |
| 11 | `11-politica-tramos.png` | Los tramos por días de atraso y la fuente citada |
| 12 | `12-pdf-en-dispositivo.png` | El informe descargado **dentro de la app** y entregado al sistema |
| 13 | `13-informe-gastos.pdf` | El PDF tal cual lo emite el servidor |
| 14 | `14-pdf-en-navegador.png` | El mismo PDF abierto en el navegador del equipo — **cuadra con la app** |
| 15 | `15-portal-consentimientos.png` | El portal interno editando los documentos de consentimiento (verificado con Playwright) |
| 16 | `16-signup-nuevo.png` | Registro rehecho: secciones agrupadas, iconos dentro de los campos |
| 17 | `17-signup-datepicker.png` | Calendario nativo, abierto en el ultimo dia valido — no deja elegir a un menor |
| 18 | `18-signup-consentimientos.png` | Autorizaciones con titulo, resumen y enlace para leer |
| 19 | `19-signup-documento.png` | El documento completo, servido por el backend y aceptable desde ahi |

### Que el PDF y la app coinciden

| | App (captura 3) | PDF (captura 14) |
|---|---|---|
| Financiado | Bs 5.900,00 | Bs 5.900,00 |
| Por pagar | Bs 5.900,00 | Bs 5.900,00 |
| En mora | Bs 900,00 | Bs 900,00 |
| Electrónica | 54 % · Bs 3.200,00 · Tecno Andina | 54,2 % · Bs 3.200,00 · Tecno Andina |
| Educación | 46 % · Bs 2.700,00 · CPA | 45,8 % · Bs 2.700,00 · CPA |

El porcentaje se redondea distinto a propósito: la app lo enseña entero para que quepa junto al
importe, el informe con un decimal porque es un documento que se lee sin prisa. **El número que se
divide es el mismo** — lo calcula el servidor una sola vez.

## Lo que el recorrido destapó, y quedó arreglado

1. **El tutorial tapaba el aviso de mora** (visible en la primera captura del recorrido). La
   condición sólo miraba el motor local; ahora tampoco arranca con mora real.
2. **La lista de comercios no marcaba la mora** aunque el total sí: usaba `days_past_due`, que
   actualiza un barrido. Ahora usa el mismo calendario que el total.
3. **La ficha del crédito decía «al día»** con dos cuotas vencidas, por lo mismo.
4. **El barrido de mora fallaba justo en los préstamos que entran en mora**: el evento de cambio de
   tramo no podía escribirse y el error se lo tragaba el `catch` que protege el barrido. La cartera
   que entraba en mora era invisible.
5. **El botón del PDF abría el navegador**, que no comparte la sesión: el informe habría devuelto
   401. Ahora se descarga dentro de la app, con la cabecera de autorización.
6. **El informe decía «BOB»** donde la app dice «Bs», y llevaba una línea «Cliente» vacía.

## Cómo reproducirlo

```bash
# 1. Stack con canales de desarrollo (motor, almacenamiento y sumidero de códigos)
ATLAS_DEV_HOST_IP=192.168.0.197 API_PUBLISH_PORT=3105 \
ATLAS_DEV_DECISION_ENGINE_URL=http://host.docker.internal:3200 \
ATLAS_DEV_DECISION_ENGINE_RUNTIME_KEY=<RUNTIME_API_KEY del motor> \
ATLAS_DEV_DECISION_ENGINE_MANAGEMENT_KEY=<MANAGEMENT_API_KEY del motor> \
ATLAS_DEV_DECISION_ENGINE_ARTIFACT=ATLAS_BNPL_UNDERWRITING \
docker compose -f docker-compose.yml \
  -f ../AtlasFrontend/apps/consumer-app/tools/dev-backend/docker-compose.dev-channels.yml \
  --profile app up -d api worker minio minio-init

# 2. Comercio verificado, recorriendo la API real
ATLAS_ADMIN_TOKEN=<token> node tools/dev-backend/provision-demo-merchant.mjs \
  --email cpacentropreaparacionacademica@gmail.com --password '...'

# 3. El comercio acepta desde su portal
node tools/dev-backend/merchant-portal-check.mjs \
  --email cpacentropreaparacionacademica@gmail.com --password '...' --partnerId 6 --accept <id>
```

El APK se compila desde `C:\Ap` por el límite de rutas de Windows: ver `docs/` y la nota de build.

## El registro, rehecho

Lo que habia: siete campos sueltos, sin iconos, la fecha como texto con formato `AAAA-MM-DD`, el
prefijo `+591` dentro del campo de telefono —editable y borrable— y una casilla que decia
«privacy-policy-dev · Version v1-dev» sin forma de leer lo que se aceptaba.

Lo que hay: tres secciones agrupadas, iconos dentro de cada campo, **calendario nativo** con el
maximo puesto en el dia en que se cumplen 18 anos, **selector de pais con bandera** separado del
numero, y autorizaciones con titulo, resumen y el texto completo a un toque.

### El consentimiento se configura, no se despliega

El texto vive en `privacy.consent_documents` con titulo, resumen y cuerpo versionados, y se edita
desde **Portal interno → Configuracion → Consentimientos**. Verificado con Playwright de punta a
punta: se entro al portal con el PIN real leido del sumidero, se edito el resumen de la politica de
privacidad y el cambio aparecio en `/consent-documents/active`, que es el endpoint que consume la
app — sin tocar una linea de codigo del telefono.

Una nota de honestidad: el calendario de Android es el dialogo del SISTEMA, asi que sigue el tema
del dispositivo. En el emulador, con tema claro, sale blanco. En un telefono en modo oscuro sale
oscuro. Se deja el control nativo a proposito: es el que la gente ya sabe usar.
