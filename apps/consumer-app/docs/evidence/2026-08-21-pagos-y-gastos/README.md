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

## Editar mis datos, y las tildes

### El cliente activo ya puede corregirse

La edicion del perfil solo existia durante el alta. En cuanto la cuenta quedaba `active` el endpoint
respondia `PROFILE_NOT_EDITABLE_IN_STATUS` y no habia ningun otro camino: un idioma equivocado se
quedaba equivocado y la unica salida era soporte.

Ahora `active` edita. Lo que sigue bloqueado son **nombre, apellido y fecha de nacimiento** cuando la
identidad ya se verifico contra el carnet — son los tres campos que se contrastaron con el documento,
y dejar que el titular los reescriba despues convierte una verificacion en una declaracion. Se
muestran igual, con candado y con el motivo, porque esconderlos dejaria a la persona buscando donde
se cambia su nombre.

| # | Archivo | Que prueba |
|---|---|---|
| 30 | `30-editar-datos-bloqueados.png` | Los campos verificados, visibles y con candado, con el motivo escrito |
| 31 | `31-editar-preferencias.png` | Idioma, genero y avisos: lo que si se edita |
| 32 | `32-editar-guardado.png` | Guardado confirmado desde el telefono contra el backend real |

Comprobado en la base despues de guardar desde el emulador: la version 44 del perfil del cliente 23
queda con `gender_declared=female`, `marketing_opt_in=true`, `source_type=customer_self_service` y
`supersedes_version_id=43`; la 43 se cierra con su `valid_until`. El versionado funciona desde el
telefono, no solo desde curl.

Y la regla se comprobo por los dos lados: `{"firstName":"Otra"}` devuelve
`IDENTITY_FIELDS_LOCKED: firstName` sobre el mismo cliente.

### Las tildes no eran la fuente: era el codigo

El texto salia sin tildes —«Tu linea Atlas», «Tu calificacion», «Como se calcula»— porque estaba
escrito asi en el propio codigo fuente. La fuente siempre las tuvo. En castellano una palabra sin
tilde no es un detalle tipografico: es una falta de ortografia, y en un producto financiero se lee
como descuido.

Se repaso todo el texto visible de la app —28 ficheros entre pantallas y copys— distinguiendo lo que
es prosa de lo que es codigo: los identificadores, las claves de rubro (`educacion`, `electronica`) y
las rutas se quedan como estan, porque ahi la palabra no se lee, se compara.

| # | Archivo | Que prueba |
|---|---|---|
| 26 | `26-inicio-tildes.png` | «Tu línea Atlas», «empezarán», «políticas», «suspensión», «Ver qué debo pagar», «Límite aprobado» |
| 27 | `27-pagos-tildes.png` | «1 crédito con cuotas vencidas», «Próximos», «Educación · 2 créditos» |
| 28 | `28-perfil-calificacion.png` | «Tu calificación», «Categoría 3 de 6», «40 días», «Cómo se calcula» |
| 29 | `29-perfil-cuenta-iconos.png` | «Teléfono» con auricular —no con la chincheta de ubicacion— y «Termina en @atlas.bo» |
| 33 | `33-politica-mora-secciones.png` | La politica por secciones, con su marca a la izquierda, sin muro de texto |

Dos cosas mas que salieron de mirar la pantalla en vez del codigo:

- **El icono del telefono era una chincheta de mapa.** Los dos son datos de contacto y estan uno
  encima del otro en el perfil, asi que el icono equivocado no se leia como un descuido: se leia
  como si la fila fuera la direccion. Ahora hay un icono `telefono` propio.
- **«@atlas.bo» a secas parecia un valor cortado.** El backend guarda solo el dominio del correo a
  proposito —minimizacion de datos—; lo que estaba mal era enseñar esa decision sin decirla. Con
  «Termina en @atlas.bo» la fila queda en paralelo con la del telefono y se entiende.

Y el nombre del comercio en la base tambien llevaba el problema: `CPA Centro de Preparacion
Academica` pasa a `CPA Centro de Preparación Académica`, en la fila del partner y en el script que lo
aprovisiona, para que un entorno nuevo nazca bien escrito.
