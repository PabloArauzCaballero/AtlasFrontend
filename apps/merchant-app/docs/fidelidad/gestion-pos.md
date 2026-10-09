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
| Descripción «Lo que pasa en su caja: …» | `ScreenHeader.subtitle` | ✓ |
| — | Avatar a «Mi cuenta» (`BotonCuenta`) | Equivale al avatar de la cabecera del portal. |
| `MerchantPartnerPicker` (sólo con >1 expediente; «Su usuario tiene varios expedientes», «Todo lo de esta pantalla es del expediente elegido», opción `tradeName ?? legalName ?? Expediente N`, detalle «Expediente N · estado X») | `SelectorDeExpediente` (compartido) | ✓ (el «:» final de la etiqueta web se quita porque en la app es la etiqueta del campo). |
| Aviso danger con `partner.error` (incluye `SIN_EXPEDIENTE`) | `Aviso tono="danger"` | ✓ |
| `PageSkeleton` mientras carga la ruta | `SkeletonLista` mientras se resuelve el expediente | Diferencia: en la web las pestañas reciben `partnerId=''` durante ese instante y pintan «No hay nada esperando» falso; aquí se espera al expediente. |
| Pestañas «Solicitudes de compra» (inbox), «Comprobantes por verificar» (receipt_long), «Historial» (history) | `BarraDePestanas` con iconos `lista`, `documento`, `reloj` | ✓ textos; iconos del set de la app del cliente. |
| Contador por pestaña (solicitudes y comprobantes de cuota; ninguno en Historial; sin número hasta la primera carga) | `cuenta` en `Pestana` | ✓ (los pagos iniciales no suman, como en la web). |
| `?tab=` en la URL, `keepMounted` | `usePestana` (`?tab=`), `Panel` siempre montado | ✓ |
| — | Tirar hacia abajo recarga todas las pestañas; volver a la pantalla las recarga; decidir en una recarga las demás | Añadido del teléfono (pedido): la web sólo tiene «Actualizar» por panel, que se conserva. |

## Pestaña «Solicitudes de compra» (`MerchantRequestsScreen` embebida)

| Web | App | |
|---|---|---|
| Aviso danger con el error de carga («No fue posible leer las solicitudes.» de respaldo) | `Aviso` | ✓ |
| Aviso success/danger tras decidir | `Aviso` | ✓ (`avisoDecisionSolicitud`, textos literales). |
| Panel «Esperando su respuesta» · «Sólo puede aceptar o rechazar. No hay ningún campo que se pueda modificar.» | `Card` + `CardHeader` | ✓ |
| Botón «Descargar PDF» (deshabilitado cargando o sin filas) | `BotonPdf` `pdf-solicitudes` | ✓ — en el teléfono abre la hoja de compartir. |
| PDF: «Solicitudes de compra», «Portal del comercio · {nombre}», resumen «Solicitudes», sección «Solicitudes recibidas» + descripción, columnas Código/Recibida/Importe/Cuotas/Sucursal/Estado, valores crudos | `documentoDeSolicitudes` | ✓ (probado). |
| «Actualizar» (deshabilitado sin expediente, girando mientras carga) | `Button` | ✓ |
| «Cargando…» | `SkeletonLista texto="Cargando…"` | Diferencia: si ya había filas se siguen viendo mientras recarga (en la web desaparecen); así el tirar-para-recargar no hace saltar la lista. |
| Vacío: «No hay nada esperando» / «Cuando un cliente escanee el QR y el motor apruebe su compra, aparecerá aquí.» | `EmptyState` | ✓ |
| Tarjeta: código, pastilla `businessAcceptance ?? 'PENDIENTE'` | `CardHeader` + `Badge warning` | ✓ |
| «Pedida el {fecha es-BO} · aprobada por el motor» | detalle de la cabecera | ✓ |
| `OrigenDeCaja` (sucursal + caja; «Sucursal sin nombre»; «Sin caja registrada en la compra») | `OrigenDeCaja` (RN) | ✓ |
| «IMPORTE» · monto · «{n} meses · {moneda}» (a la derecha) | `ImporteDeclarado` (debajo) | ✓ datos; debajo en vez de a la derecha por ancho de teléfono. |
| «Aceptar» / «Rechazar» | `DecisionConMotivo` | ✓ |
| Rechazo: select «Motivo del rechazo» (obligatorio), tooltip «Motivo codificado del rechazo; queda explicado para auditoría.», hint «Rechazar algo que el motor aprobó tiene que quedar explicado.», opciones y códigos de `MOTIVOS` | `SelectField` (`ayuda` = tooltip, `placeholder` = «— Elija el motivo —») | ✓ (probado). |
| «Confirmar rechazo» deshabilitado sin motivo / «Cancelar» | `Button destructive` / `secondary` | ✓ |
| Cuerpo `{ accepted, reasonCode? }` a `/acceptance` | `cuerpoDecisionSolicitud` | ✓ (probado). |
| Aviso info «Por qué no puede editar nada» + texto | `Aviso tono="info"` | ✓ |

## Pestaña «Comprobantes por verificar» (`MerchantPaymentProofsScreen` embebida)

| Web | App | |
|---|---|---|
| Error de carga / aviso de decisión | `Aviso` | ✓ |
| `MerchantDownPaymentsPanel` arriba (sólo con expediente) | `PanelPagosIniciales` | ✓ (ver abajo). |
| Panel «Esperando su confirmación» · «Compruebe en su extracto que el dinero entró antes de confirmar.» | `Card` | ✓ |
| «Descargar PDF» + PDF «Comprobantes por verificar» (resumen «Comprobantes», «Comprobantes recibidos», columnas Código/Avisado/Importe/Referencia/Estado/Resuelto) | `documentoDeComprobantes` | ✓ (probado). |
| «Actualizar» | `Button` | ✓ |
| Vacío: «No hay comprobantes esperando» / «Cuando un cliente avise que transfirió, aparecerá aquí con su comprobante.» | `EmptyState` | ✓ |
| Tarjeta: código, «POR VERIFICAR», «Avisado el …», caja, «Referencia del banco: **X** / sin referencia», «IMPORTE DECLARADO», moneda | Card | ✓ |
| Imagen del comprobante (fetch autenticado → blob; esqueleto «Cargando comprobante»; error «No se pudo mostrar el comprobante» + «… Puede rechazarlo indicando que el comprobante no se lee.») | `ComprobanteImagen` (`apiBlobUrl` → `data:`) | ✓ |
| Pulsar la imagen la amplía en la tarjeta; «Pulse la imagen para ampliarla/reducirla. Compruebe el monto, la fecha y la cuenta de destino antes de confirmar.» | Pulsar abre la imagen a pantalla completa con «Cerrar» | Diferencia: en el teléfono ampliar en la tarjeta no deja leer cifras pequeñas. El pie «ampliarla» es literal; «reducirla» no aplica (se cierra con «Cerrar»). |
| Sin imagen: «Sin comprobante adjunto» + «… Búsquelo en su extracto por la referencia antes de confirmar.» | `Aviso warning` | ✓ |
| «Verificar y dar por pagado» / «Rechazar»; motivo (tooltip «Por qué se rechaza el comprobante; el cliente lo lee.», hint «El cliente verá que su aviso fue rechazado; el motivo es lo que le permite corregirlo.», códigos `MOTIVOS`) | `DecisionConMotivo` | ✓ |
| Cuerpo `{ verified, reason? }` | `cuerpoVerificacion` | ✓ (probado). |
| Aviso info «Por qué lo confirma usted» + texto | `Aviso` | ✓ |

## Pagos iniciales (`MerchantDownPaymentsPanel`)

| Web | App | |
|---|---|---|
| Error («No fue posible leer los pagos iniciales.») / aviso de decisión | `Aviso` | ✓ |
| Panel «Pagos iniciales de compras» · «El 60 % que sus clientes le pagaron directo al comprar. …» + «Actualizar» | `Card` | ✓ (icono `billetera` en vez de `payments`). |
| Vacío «No hay pagos iniciales esperando» / «Cuando un cliente avise que pagó el inicial de su compra, aparecerá aquí con su comprobante.» | `EmptyState` | ✓ |
| Tarjeta «Compra {código}», «PAGO INICIAL POR CONFIRMAR», «Avisado el …» / «Sin fecha», caja, referencia, «IMPORTE DECLARADO», moneda | Card | ✓ |
| Imagen (`pagoInicialImagen`) o «Sin comprobante adjunto» «… Búsquelo en su cuenta por la referencia …» | `ComprobanteImagen` / `Aviso` | ✓ |
| «Confirmar que recibí el pago» / «Rechazar»; motivo con la FRASE como valor, sin «Otro»; «Rechazar pago inicial» / «Cancelar» | `DecisionConMotivo` + `MOTIVOS_PAGO_INICIAL` | ✓ (probado). |

## Pestaña «Historial» (`MerchantPosHistoryScreen`)

| Web | App | |
|---|---|---|
| Error («No fue posible cargar el historial.») | `Aviso` | ✓ |
| Panel «Historial de la caja» + descripción + «Actualizar» | `Card` | ✓ |
| Filtros Sucursal / Caja (con «Todas las sucursales», «Todas las cajas», caja «Alias · Sucursal» sin sucursal elegida) y sus tooltips | `SelectField` (`ayuda`) | ✓ (probado). |
| Fecha inicio / Fecha fin (`max`/`min` cruzados) y tooltips | `DateField` con `maximumDate`/`minimumDate` | ✓; diferencia: el calendario nativo no tiene «borrar»: una fecha se quita con «Quitar filtros». Sin fecha muestra «Sin fecha». |
| Cambiar sucursal suelta una caja ajena; todo cambio vuelve a página 1 | `aplicarFiltro` | ✓ (casos de `pos-historial.test.ts`). |
| «**N** operación/operaciones · confirmado **Bs X** con estos filtros» | línea del total | ✓ |
| «Quitar filtros» (sólo con filtros) | `Button ghost` | ✓ |
| «Cargando…» (sólo la primera vez) | `SkeletonLista` | ✓ |
| Vacío «No hay nada con estos filtros.» / «Todavía no hay movimientos en la caja.» | `EmptyState` (el texto va como título) | ✓ |
| Tabla Fecha/Tipo/Código/Sucursal/Caja/Importe/Referencia/Estado; opacidad mientras recarga | Una `Card` por fila con los ocho datos; opacidad 0,6 | Diferencia de forma (pedido: tablas → tarjetas). Mismos textos, tonos de pastilla y «—». |
| Paginación «Anterior» / «Página X de Y · N en total» / «Siguiente» | Igual, el texto arriba y los dos botones debajo | ✓ |
| Sin expediente: «Cargando…» para siempre (su `recargar` sale sin bajar la bandera) | Muestra el vacío | Diferencia deliberada: es el estado que las otras dos colas de la web ya corrigieron. |
| Sin PDF en la web | Sin PDF | ✓ |

## Errores

La web muestra `error.message` de cualquier `Error`; la app usa `mensajeDeError` (el mensaje del
`ApiError`, o el respaldo literal de la web). Es el criterio del resto de la app: un error que no es
de la API es del programa y no se le enseña al comercio.
