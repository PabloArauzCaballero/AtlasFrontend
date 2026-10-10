# Fidelidad · Gestión POS

Web: `AtlasERPFrontend` en `origin/dev` (`34f59e5`): `app/portal-comercio/gestion-pos/page.tsx` →
`components/screens/MerchantPosScreen.tsx`, `MerchantRequestsScreen.tsx`, `MerchantPaymentProofsScreen.tsx`
(con `ComprobanteImagen`), `MerchantDownPaymentsPanel.tsx`, `MerchantPosHistoryScreen.tsx`,
`MerchantPartnerPicker.tsx`, `components/atlas/OrigenDeCaja.tsx`.

App: `app/(app)/(tabs)/gestion-pos.tsx`, `src/ui/gestion-pos/*`, `src/features/gestion-pos/*`.

✓ = igual que la web (texto literal, mismo dato, misma acción, misma validación).

## Pantalla (`MerchantPosScreen`)

| Web | App | |
|---|---|---|
| Migas «Portal comercio › Gestión POS» | — | La app no tiene migas: la pestaña inferior «Gestión POS» ya dice dónde se está. |
| Título «Gestión POS» | `ScreenHeader.title` | ✓ |
| Descripción «Lo que pasa en su caja: …» | — | **Quitado** (Pablo, 2026-10-10: «textos innecesarios»). |
| — | `AccionesDeCabecera`: ícono PDF de la pestaña abierta + avatar a «Mi cuenta» | El avatar equivale al de la cabecera del portal. El PDF reemplaza a los «Descargar PDF» de cada panel (ver abajo). |
| `MerchantPartnerPicker` (sólo con >1 expediente; «Su usuario tiene varios expedientes», «Todo lo de esta pantalla es del expediente elegido», opción `tradeName ?? legalName ?? Expediente N`, detalle «Expediente N · estado X») | `SelectorDeExpediente` (compartido) | ✓ (el «:» final de la etiqueta web se quita porque en la app es la etiqueta del campo). |
| Aviso danger con `partner.error` (incluye `SIN_EXPEDIENTE`) | `Aviso tono="danger"` | ✓ |
| `PageSkeleton` mientras carga la ruta | `SkeletonLista` mientras se resuelve el expediente | Diferencia: en la web las pestañas reciben `partnerId=''` durante ese instante y pintan «No hay nada esperando» falso; aquí se espera al expediente. |
| Pestañas «Solicitudes de compra» (inbox), «Comprobantes por verificar» (receipt_long), «Historial» (history) | Selector segmentado `BarraDePestanas`: «Solicitudes · Comprobantes · Historial» (`corta`), sin iconos | El nombre largo de la web queda como nombre accesible (`etiqueta`). |
| Contador por pestaña (solicitudes y comprobantes de cuota; ninguno en Historial; sin número hasta la primera carga) | `cuenta` en `Pestana` | **Diferencia deliberada (arreglo de un fallo de la web):** el contador de «Comprobantes» suma las cuotas Y los pagos iniciales pendientes (`pendientesDeComprobantes`). En la web los pagos iniciales —que están en esa misma pestaña— no contaban, y con sólo pagos iniciales esperando la pestaña no avisaba. Hay que corregirlo también en `MerchantPosScreen`. |
| `?tab=` en la URL, `keepMounted` | `usePestana` (`?tab=`), `Panel` siempre montado | ✓ |
| «Actualizar» en cada panel | — | **Quitados** (Pablo, 2026-10-10): tirar hacia abajo recarga todas las pestañas; volver a la pantalla las recarga; decidir en una recarga las demás. |
| «Descargar PDF» en cada panel | Ícono PDF en la cabecera, del panel abierto | Mismo `DocumentoPdf`. Sin filas el ícono no aparece (la web deja el botón apagado). Historial sin PDF, como en la web. |
| — | `paddingBottom: 160` | Aire para los botones flotantes (Mi empresa, Soporte, asistente). |

## Pestaña «Solicitudes de compra» (`MerchantRequestsScreen` embebida)

| Web | App | |
|---|---|---|
| Aviso danger con el error de carga («No fue posible leer las solicitudes.» de respaldo) | `Aviso` | ✓ |
| Aviso success/danger tras decidir | `Aviso` | ✓ (`avisoDecisionSolicitud`, textos literales). |
| Panel «Esperando su respuesta» · «Sólo puede aceptar o rechazar. No hay ningún campo que se pueda modificar.» | — | **Quitado** (tarjeta-cabecera de panel). Que no hay nada que editar se ve: la tarjeta no tiene campos. |
| Botón «Descargar PDF» (deshabilitado cargando o sin filas) | Ícono PDF de la cabecera | Ver «Pantalla». |
| PDF: «Solicitudes de compra», «Portal del comercio · {nombre}», resumen «Solicitudes», sección «Solicitudes recibidas» + descripción, columnas Código/Recibida/Importe/Cuotas/Sucursal/Estado, valores crudos | `documentoDeSolicitudes` | ✓ (probado). |
| «Actualizar» | — | **Quitado**: tirar hacia abajo. |
| «Cargando…» | `SkeletonLista texto="Cargando…"` | Diferencia: si ya había filas se siguen viendo mientras recarga (en la web desaparecen); así el tirar-para-recargar no hace saltar la lista. |
| Vacío: «No hay nada esperando» / «Cuando un cliente escanee el QR y el motor apruebe su compra, aparecerá aquí.» | `EmptyState` «No hay nada esperando» / «Aquí llegan las compras que pidan con su QR.» | Detalle acortado (regla de vacíos compactos). |
| Tarjeta: código como título, pastilla `businessAcceptance ?? 'PENDIENTE'` en crudo | `CabeceraDeImporte`: el IMPORTE grande como título y la pastilla traducida (`estadoDeSolicitud`: «Por aceptar», «Aceptada», «Rechazada», «Pendiente») | El código ya no es título: va como referencia corta en gris (últimos 6 caracteres, `refCorta`). |
| «Pedida el {fecha es-BO} · aprobada por el motor», `OrigenDeCaja`, «IMPORTE · monto · {n} meses · {moneda}» | UNA línea: «6 cuotas · 9 oct, 14:03 · Equipetrol · Caja 1 · #cd56ef» (`lineaDeSolicitud`) | Mismos datos salvo la moneda (siempre BOB, ya va en «Bs») y «aprobada por el motor» (la cola sólo trae aprobadas). Fecha corta (`fechaCorta`). «meses» → «cuotas», como la columna del PDF. |
| «Aceptar» / «Rechazar» (apilados) | `DecisionConMotivo`: una fila, «Rechazar» a la izquierda, «Aceptar» a la derecha | ✓ acción y cuerpo. |
| Rechazo: select «Motivo del rechazo» (obligatorio), tooltip «Motivo codificado del rechazo; queda explicado para auditoría.», hint «Rechazar algo que el motor aprobó tiene que quedar explicado.», opciones y códigos de `MOTIVOS` | `SelectField` (`ayuda` = tooltip, `placeholder` = «— Elija el motivo —») | ✓ (probado). |
| «Confirmar rechazo» deshabilitado sin motivo / «Cancelar» | Una fila: «Cancelar» / «Rechazar» (rojo, apagado sin motivo) | Rótulo acortado: a medio ancho caben ~100 px. Las tres colas igual. |
| Cuerpo `{ accepted, reasonCode? }` a `/acceptance` | `cuerpoDecisionSolicitud` | ✓ (probado). |
| Aviso info «Por qué no puede editar nada» + texto | — | **Quitado** (tarjetas «Por qué…»). El texto sigue en las guías de Soporte. |

## Pestaña «Comprobantes por verificar» (`MerchantPaymentProofsScreen` embebida)

| Web | App | |
|---|---|---|
| Error de carga / aviso de decisión | `Aviso` | ✓ |
| `MerchantDownPaymentsPanel` arriba (sólo con expediente) | Pagos iniciales arriba, cuotas debajo, en UNA lista | Los títulos «Pagos iniciales» y «Cuotas» sólo aparecen cuando hay de las dos; un solo vacío para las dos colas. |
| Panel «Esperando su confirmación» · «Compruebe en su extracto que el dinero entró antes de confirmar.» | — | **Quitado** (tarjeta-cabecera de panel). |
| «Descargar PDF» + PDF «Comprobantes por verificar» (resumen «Comprobantes», «Comprobantes recibidos», columnas Código/Avisado/Importe/Referencia/Estado/Resuelto) | Ícono PDF de la cabecera, `documentoDeComprobantes` | ✓ (probado). Sólo cuotas, como en la web. |
| «Actualizar» | — | **Quitado**: tirar hacia abajo. |
| Vacío: «No hay comprobantes esperando» / «Cuando un cliente avise que transfirió, aparecerá aquí con su comprobante.» | Un solo vacío para cuotas y pagos iniciales: «No hay comprobantes esperando» / «Aquí llegan los pagos que sus clientes avisen.» | Detalle acortado. |
| Tarjeta: código, «POR VERIFICAR», «Avisado el …», caja, «Referencia del banco: **X** / sin referencia», «IMPORTE DECLARADO», moneda | `TarjetaDeComprobante`: importe grande, pastilla «Por verificar», UNA línea «Cuota · Ref. X · 9 oct, 15:00 · Centro · Caja SN-6 · #ref» (`lineaDeComprobante`) | Mismos datos; el código pasa a referencia corta en gris. |
| Imagen del comprobante (fetch autenticado → blob; esqueleto «Cargando comprobante»; error «No se pudo mostrar el comprobante» + «… Puede rechazarlo indicando que el comprobante no se lee.») | `useImagenDeComprobante` (`apiBlobUrl` → `data:`) + `MiniaturaDeComprobante` (72 px a la derecha del importe, con «Ver») | Diferencia de forma: miniatura en vez de imagen a lo ancho. El error es un hueco con ⚠ en la miniatura y el texto de la web bajo la línea. |
| Pulsar la imagen la amplía en la tarjeta; «Pulse la imagen para ampliarla/reducirla. Compruebe el monto, la fecha y la cuenta de destino antes de confirmar.» | Pulsar la miniatura abre el comprobante a pantalla completa, con «Compruebe el monto, la fecha y la cuenta de destino antes de confirmar.» debajo y «Cerrar» | «Pulse la imagen para ampliarla» se quita: la miniatura dice «Ver». |
| Sin imagen: «Sin comprobante adjunto» + «… Búsquelo en su extracto por la referencia antes de confirmar.» | Una línea en ámbar bajo la tarjeta, mismo texto | ✓ |
| «Verificar y dar por pagado» / «Rechazar» | Una fila «Rechazar» / «Confirmar» | El rótulo largo no cabe en medio ancho; la acción y el cuerpo son los mismos. |
| Motivo (tooltip «Por qué se rechaza el comprobante; el cliente lo lee.», hint «El cliente verá que su aviso fue rechazado; el motivo es lo que le permite corregirlo.», códigos `MOTIVOS`) | `DecisionConMotivo` | ✓ |
| Cuerpo `{ verified, reason? }` | `cuerpoVerificacion` | ✓ (probado). |
| Aviso info «Por qué lo confirma usted» + texto | ⓘ del título «Cuotas» | Movido al ⓘ (sólo visible cuando hay títulos, es decir, cuotas y pagos iniciales a la vez). |

## Pagos iniciales (`MerchantDownPaymentsPanel`)

| Web | App | |
|---|---|---|
| Error («No fue posible leer los pagos iniciales.») / aviso de decisión | `Aviso` en el panel de Comprobantes | ✓; el aviso tras decidir lo pinta el panel para que no desaparezca al confirmarse el último pago inicial. |
| Panel «Pagos iniciales de compras» · «El 60 % que sus clientes le pagaron directo al comprar. …» + «Actualizar» | Título «Pagos iniciales» con ⓘ (sólo si también hay cuotas) | Texto movido al ⓘ; «Actualizar» quitado. |
| Vacío «No hay pagos iniciales esperando» / … | El vacío común de la pestaña | Ver arriba. |
| Tarjeta «Compra {código}», «PAGO INICIAL POR CONFIRMAR», «Avisado el …» / «Sin fecha», caja, referencia, «IMPORTE DECLARADO», moneda | `TarjetaDeComprobante`: importe, pastilla «Por confirmar», línea «Pago inicial · Ref. X · fecha / Sin fecha · caja · #ref» | Mismos datos. |
| Imagen (`pagoInicialImagen`) o «Sin comprobante adjunto» «… Búsquelo en su cuenta por la referencia …» | Miniatura / línea ámbar | ✓ |
| «Confirmar que recibí el pago» / «Rechazar»; motivo con la FRASE como valor, sin «Otro»; «Rechazar pago inicial» / «Cancelar» | Una fila «Rechazar» / «Confirmar»; en el rechazo «Cancelar» / «Rechazar» + `MOTIVOS_PAGO_INICIAL` | Rótulos acortados para medio ancho; motivos y cuerpo iguales (probado). |

## Pestaña «Historial» (`MerchantPosHistoryScreen`)

| Web | App | |
|---|---|---|
| Error («No fue posible cargar el historial.») | `Aviso` | ✓ |
| Panel «Historial de la caja» + descripción + «Actualizar» | — | **Quitado** (tarjeta-cabecera y «Actualizar»). |
| Filtros siempre a la vista | Botón «Filtros» (con «· N» filtros puestos, `cuantosFiltros`) que abre una hoja con los cuatro campos y «Quitar filtros» | Diferencia de forma (Pablo: los filtros ocupaban media pantalla). |
| Filtros Sucursal / Caja (con «Todas las sucursales», «Todas las cajas», caja «Alias · Sucursal» sin sucursal elegida) y sus tooltips | `SelectField` (`ayuda`) en la hoja | ✓ (probado). |
| Fecha inicio / Fecha fin (`max`/`min` cruzados) y tooltips | `DateField` con `maximumDate`/`minimumDate` | ✓; diferencia: el calendario nativo no tiene «borrar»: una fecha se quita con «Quitar filtros». Sin fecha muestra «Sin fecha». |
| Cambiar sucursal suelta una caja ajena; todo cambio vuelve a página 1 | `aplicarFiltro` | ✓ (casos de `pos-historial.test.ts`). |
| «**N** operación/operaciones · confirmado **Bs X** con estos filtros» | Línea pequeña junto a «Filtros»: «**N operaciones** · **Bs X** confirmados con estos filtros» | Orden cambiado: la cifra antes de la palabra. |
| «Quitar filtros» (sólo con filtros) | `Button ghost`, dentro de la hoja | ✓ |
| «Cargando…» (sólo la primera vez) | `SkeletonLista` | ✓ |
| Vacío «No hay nada con estos filtros.» / «Todavía no hay movimientos en la caja.» | `EmptyState` (el texto va como título) | ✓ |
| Tabla Fecha/Tipo/Código/Sucursal/Caja/Importe/Referencia/Estado; opacidad mientras recarga | Una `Card` compacta por fila: el IMPORTE como título, pastilla de estado («Confirmado», «Rechazada»…), pastilla de tipo, y UNA línea «9 oct, 14:03 · Casa matriz · Caja 5 · Ref. X · #ref» (`lineaDelMovimiento`); opacidad 0,6 | Mismos ocho datos y tonos. El código (antes título: «CRA-b51c9eaa-…») va como referencia corta en gris; lo que falta se salta en vez de poner «—». |
| Paginación «Anterior» / «Página X de Y · N en total» / «Siguiente» | Igual, el texto arriba y los dos botones debajo | ✓ |
| Sin expediente: «Cargando…» para siempre (su `recargar` sale sin bajar la bandera) | Muestra el vacío | Diferencia deliberada: es el estado que las otras dos colas de la web ya corrigieron. |
| Sin PDF en la web | Sin PDF | ✓ |

## Errores

La web muestra `error.message` de cualquier `Error`; la app usa `mensajeDeError` (el mensaje del
`ApiError`, o el respaldo literal de la web). Es el criterio del resto de la app: un error que no es
de la API es del programa y no se le enseña al comercio.
