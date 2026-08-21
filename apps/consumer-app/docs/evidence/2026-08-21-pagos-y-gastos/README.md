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

## El calendario, los filtros que se contradecían y las pantallas sin salida

### Una vista calendario, con el color decidido por el servidor

La lista de pagos responde «qué debo». Un calendario responde «cuándo», que es otra pregunta: la de
quien cobra el día 15 y necesita saber si llega. Se añade como TERCERA vista del botón de la esquina
—lista, cuadrícula, calendario—, y cuando está activa reemplaza a los filtros y a la lista de
comercios en vez de apilarse debajo: es otra forma de mirar el mismo dinero, no un bloque más.

Rojo lo vencido, ámbar lo que está por vencer, verde lo pagado. El estado **no se calcula en el
teléfono**: cada cuota llega ya clasificada por `GET /customers/:id/payment-calendar`, comparada
contra el reloj del SERVIDOR. Un dispositivo con la fecha corrida pintaría de rojo una cuota que no
ha vencido, y en una app de crédito eso es acusar a alguien de una mora que no tiene. El día de HOY
también se marca con el `today` de la respuesta, no con el reloj local.

Cada día lleva su punto de color **y** su cifra, y la leyenda nombra los tres estados: una rejilla
que solo se distingue por color deja fuera a quien no distingue rojo de verde, que aquí son justo
«me pasé» y «voy bien».

| # | Archivo | Qué prueba |
|---|---|---|
| 34 | `34-calendario-agosto-mora.png` | Agosto: el 12 con punto rojo, el 21 (hoy) marcado, leyenda y la cuota vencida con sus 9 días |
| 35 | `35-calendario-septiembre-porvencer.png` | Septiembre: el 21 en ámbar, «2 cuotas», con las dos por vencer listadas |

### «Próximos» mostraba lo mismo que «En mora»

El filtro hacía `loan.status === 'active'`, es decir: **todos** los créditos vivos. Salía lo mismo
que en «En mora» más los que estaban al día, así que los dos filtros contestaban la misma pregunta y
ninguno contestaba la suya. «Próximo» no es «activo»: es «no me he pasado todavía, pero me toca».

Ahora se resuelve por CUOTA sobre el calendario: un crédito es «próximo» si tiene alguna cuota por
vencer y **ninguna** vencida.

De paso salió una segunda incoherencia: la insignia del comercio decía «Bs 900,00 en mora» encima de
un crédito que no debía nada, porque se calculaba sobre el comercio entero mientras la lista ya había
filtrado fuera el crédito moroso. La fila se contradecía a sí misma. La mora del grupo pasa a sumarse
de los créditos **que se están viendo**.

| # | Archivo | Qué prueba |
|---|---|---|
| 38 | `38-filtro-en-mora.png` | Solo CPA, con sus 2 créditos y su mora real |
| 39 | `39-filtro-proximos.png` | Tecno Andina y el OTRO crédito de CPA, sin insignia de mora |

### Las cuotas eran botones muertos

Las filas del cronograma se pintaban con `ListRow` —que dibuja una fila con su flecha de «abrir»—
pero **sin `onPress`**. Tenían el aspecto de llevar a algún sitio y no llevaban a ninguno. Existía
`pago/[itemId]`, pero opera sobre el simulador local y no sabe nada de las cuotas reales del backend.

Ahora hay una pantalla de cuota de verdad, con el desglose entre capital, interés y mora —que es
justo lo que se viene a discutir de una cuota vencida, y verlo sumado no deja discutir nada— y con
el «dónde la pago», que siempre es el QR bancario del comercio.

| # | Archivo | Qué prueba |
|---|---|---|
| 36 | `36-cuota-detalle-desde-calendario.png` | Se abre desde el calendario |
| 37 | `37-cuota-detalle-desde-credito.png` | Y desde el cronograma del crédito |

### Tres pantallas en las que se entraba y no se salía

`comercio/[partnerId]`, `credito/[loanId]` y `politica-mora` se habían escrito con su propia
cabecera —para conservar el icono del rubro— y el precio fue quedarse **sin botón de volver**: de
ahí solo salía quien conociera el gesto del sistema. `ScreenHeader` gana un hueco `leading` para el
icono, así que las tres usan la cabecera común y recuperan el botón sin perder nada. También lo
tienen sus estados de carga y de error: si la política no carga, quedarse encerrado en el error es
peor que el error.

| # | Archivo | Qué prueba |
|---|---|---|
| 40 | `40-comercio-con-atras.png` | Comercio: atrás + icono del rubro |
| 41 | `41-credito-con-atras.png` | Crédito: atrás, cuotas pulsables y «¿Cómo se decidió?» |
| 42 | `42-politica-con-atras-y-pregunta.png` | Política: atrás y «¿Qué ocurre si te atrasas?» |

### Las preguntas ahora se ven como preguntas

«Cómo funciona Atlas», «Dónde pago mis cuotas», «Cómo se calcula», «Cómo se decidió» eran
afirmaciones truncadas. Llevan sus signos —`¿…?`— y el icono de interrogación. Los encabezados de la
política también, en la migración y en la base.

### Empezar el registro y no terminarlo ya no deja a nadie fuera

Quien rellena el formulario y cierra la app antes de acabar el alta **ya tiene cuenta**: se creó al
enviar el primer paso. Al volver e intentar registrarse otra vez, el servidor responde
`CUSTOMER_ALREADY_EXISTS` —correctamente, porque dos cuentas con el mismo correo son dos expedientes
crediticios de la misma persona—. Lo que fallaba es que ese código **no estaba en la tabla de
mensajes de la app**, así que la pantalla decía «Revisa los datos ingresados» y no había nada que
revisar: los datos estaban bien. Una pared sin puerta.

No se bloquea unos minutos (a los cinco minutos se encuentra la misma pared) ni se permite duplicar
la cuenta. Se la reconoce y se la devuelve a su cuenta: «Ya tienes una cuenta» con **Ingresar** y
**Olvidé mi contraseña** al lado.

Y el bloqueo por intentos fallidos ahora dice **hasta cuándo**. Antes el backend lanzaba una frase
suelta sin código —así que la app ni siquiera podía distinguirla de «contraseña incorrecta»— y decía
«intenta más tarde», que garantiza una de dos conductas, las dos malas: no volver nunca, o reintentar
cada diez segundos. Comprobado sobre el stack real:

```json
{"error":{"code":"ACCOUNT_LOCKED",
          "message":"Cuenta bloqueada temporalmente por múltiples intentos fallidos.",
          "details":{"lockedUntil":"2026-08-21T22:19:14.993Z","retryAfterSeconds":900}}}
```

Para que ese código llegue, el filtro de errores del backend pasa a respetar el código de negocio que
declara la excepción en vez de derivarlo solo del estado HTTP. La forma antigua —el código dentro del
mensaje, `CODIGO: detalle`— se sigue admitiendo.

De paso, la pantalla de ingresar reescribía **todo** 401 como «contraseña incorrecta», incluido el de
la cuenta bloqueada: mandaba a probar contraseñas, que es justo lo que alarga el bloqueo. Y titulaba
«Sesión expirada» en una pantalla donde todavía no hay sesión que expirar.

### Un agujero que salió por el camino

`GET /loans/:loanId` comprobaba el rol pero **no la propiedad**: con el rol `customer` bastaba cambiar
el número de la URL para leer el crédito de cualquier otro cliente del tenant —su importe, su
comercio, su cronograma y su mora—. Es el mismo hallazgo que ya se había corregido en
`customers/:customerId/loans`; a esta ruta se le había pasado, y es la que la app abre al tocar un
crédito.
