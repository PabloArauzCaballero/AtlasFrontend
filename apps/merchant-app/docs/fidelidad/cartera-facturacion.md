# Fidelidad · Cartera y facturación

Web (fuente de verdad, `AtlasERPFrontend` en `origin/dev`, leída el 2026-10-09):
`app/portal-comercio/{cartera,facturacion}/page.tsx`, `components/layout/CarteraFacturacionSwitch.tsx`,
`components/screens/MerchantPortfolioScreen.tsx`, `components/screens/MerchantBillingScreen.tsx`,
`hooks/useMerchantScope.ts`, `lib/facturaPdf.ts`, `components/atlas/OrigenDeCaja.tsx`, `lib/formatters.ts`.

App: `app/(app)/(tabs)/cartera.tsx`, `src/ui/cartera/*`, `src/features/cartera/*`.

✓ = igual que la web (texto literal, mismo dato, misma acción). ≠ = difiere, con el motivo.

## Selector de las dos vistas (`CarteraFacturacionSwitch`)

| Web | App | |
|---|---|---|
| Dos rutas, `/portal-comercio/cartera` y `/portal-comercio/facturacion` | Una pestaña con el parámetro `vista` (`cartera` / `facturacion`) | ≠ una pestaña de la barra, dos vistas; un enlace con `?vista=facturacion` aterriza en facturación como la URL de la web |
| Selector «Mi cartera» · «Consumo y facturación» | `BarraDePestanas` con los mismos dos rótulos | ✓ (dibujo de la app del cliente) |
| `?tab=` de cada vista | `?tab=`; al cambiar de vista se borra | ≠ sólo se monta la vista elegida; `tab=creditos` no significa nada en facturación |
| Breadcrumbs «Portal comercio › Cartera» | Antetítulo «Cartera y facturación» | ≠ no hay migas en un teléfono |

## Expediente (negocio)

| Web | App | |
|---|---|---|
| Cartera: `profiles[0]`, sin selector | `useMerchantPartner` (aprobado primero) para las dos vistas | ≠ la web de cartera toma el primero sin decirlo; aquí cartera y facturación hablan siempre del MISMO negocio (regla del gancho compartido) |
| Facturación: «Negocio» si hay más de un expediente, hint «Tiene más de un expediente: los cobros y las cuotas son los del que elija aquí.», tooltip «Expediente cuyos cobros y cuotas se muestran, si tienes más de uno.» | `SelectorDeNegocio` (mismos textos; el tooltip va en el ⓘ) visible en las dos vistas | ✓ textos · ≠ también en cartera, por lo de arriba |
| Sin expediente: `SIN_EXPEDIENTE` en rojo | Igual (cartera: aviso rojo; facturación: «No se pudieron cargar sus cobros» + `SIN_EXPEDIENTE`) | ✓ |
| — | Tirar hacia abajo recarga expedientes, cartera, alcance y cargos | ≠ añadido del teléfono (no hay F5) |

## Mi cartera (`MerchantPortfolioScreen`)

| Web | App | |
|---|---|---|
| Título «Mi cartera»; descripción «Lo que le deben[ a {nombre}], con su detalle cuota a cuota y el calendario de cobros.» | `ScreenHeader` con ese título y subtítulo | ✓ |
| Botón «Descargar PDF» (`pdf-cartera`), apagado cargando o sin cartera | `BotonPdf` (`pdf-cartera`), mismas condiciones; se entrega por la hoja de compartir | ✓ · ≠ entrega (no hay Descargas en iOS) |
| PDF: título, subtítulo «Portal del comercio · {nombre}», resumen (Por cobrar, Vencido, Cobrado, Comisión a Atlas), sección «Resumen de la cartera» (Créditos activos, Cuotas en mora, MDR aplicado), tabla «Próximos cobros» (Vence, Cliente, Importe, Estado) | `documentoCartera` idéntico (probado en `__tests__/cartera/documentos.test.ts`) | ✓ **Bug de la web reproducido**: la tabla pide `dueDate`, `customerName` y `status` a filas del calendario que traen `date`, `installments`, `amount`, `overdue`; esas tres columnas salen vacías en la web y aquí. Arreglar en las dos a la vez |
| Error: aviso rojo con el mensaje | `Aviso tono="danger"` | ✓ |
| Resumen: Por cobrar · Vencido (alerta si > 0) · Cobrado · Comisión a Atlas ({tasa} %), «…» cargando | `Resumen` con las mismas cuatro cifras | ✓ |
| Pestañas Panel · Créditos · Calendario · Comisión | `BarraDePestanas` (iconos del set de la app) | ✓ |
| Panel «Los próximos cobros» / «Lo que debería entrar en los siguientes días.»: 8 días, icono aviso si vencido, «Vencido», importe, «N cuota(s)»; vacío «No hay cuotas pendientes de cobro.» | Tarjeta con las mismas filas y textos | ✓ |
| Créditos «Créditos pendientes de pago» / «Abra uno para ver su detalle cuota a cuota.»: código, «N cuotas · estado», «Por cobrar», plegable; tabla Cuota · Vence · Debe · Pagado · Falta · Estado («Mora Nd» / estado) | Fila plegable; cada cuota es un bloque con las mismas columnas como pares etiqueta–valor | ✓ datos · ≠ tabla → bloques (no cabe una tabla de 560 px) |
| Vacío «No hay créditos originados en su comercio.» | Igual | ✓ |
| Calendario «Calendario de cobros» / «Cuánto debería entrar cada día.»: hasta 30 días en rejilla, ámbar si vencido | Rejilla de dos columnas de tarjetas (`tone="warning"` si vencido) | ✓ |
| Vacío «No hay cobros programados.» | Igual | ✓ |
| Comisión «Comisión por venta» + 3 casillas (Tasa de comisión / Sobre cada venta financiada; Cobrado (base) / Lo que sus clientes ya pagaron; Comisión a Atlas / Devengada sobre lo cobrado) | `Cifra` ×3, mismos textos | ✓ |
| Tabla Crédito · Cobrado · Comisión ({tasa} %) · Estado; vacío «Todavía no hay ventas financiadas en su comercio.» | Lista de tarjetas con los mismos datos | ✓ datos · ≠ tabla → lista |
| Aviso «Cómo se cobra» | Igual, literal | ✓ |
| Bloque «Lo que Atlas ya le facturó» (Facturado (N ventas), Ya pagado por usted, Pendiente de pago a Atlas en ámbar, nota «Devengado y facturado…») sólo si `/portal/commissions` respondió | Igual, mismo criterio (su fallo se traga) | ✓ |
| Aviso «Por qué no ve nombres» | Igual, literal | ✓ |
| Fecha corta `es-BO` (weekday, día, mes) | `fechaCorta` | ✓ (además tolera un instante con hora) |

## Consumo y facturación (`MerchantBillingScreen`)

| Web | App | |
|---|---|---|
| Título «Consumo y facturación»; descripción «Cada cobro con su comisión, lo que queda por cobrar y los cargos que Atlas le factura.» | `ScreenHeader` | ✓ |
| «Descargar PDF» (`pdf-facturacion`), apagado si `cargandoCartera && !ready` | `BotonPdf` con la misma condición | ✓ |
| PDF: subtítulo «Portal del comercio · N cobro(s) · N factura(s)», resumen (Cobrado, Comisión ({tasa} %), Pendiente, En mora), tablas Cobros recibidos · Cuotas por cobrar (con «Sucursal · Caja») · Cargos de Atlas · Facturas emitidas | `documentoFacturacion` idéntico (probado) | ✓ |
| Aviso «Se factura cuando el cliente termina de pagar» | Igual, literal | ✓ |
| Alcance `/portal/scope`; «Negocio» de cuentas propias si hay varias, opción «— Elige uno de tus negocios —», hint «Administras varios negocios: elige de cuál quieres ver el consumo.» | `useMerchantScope` porteado; `SelectField` con ese placeholder y hint | ✓ |
| Personal interno: mensaje «Esta sección es del portal del comercio…» | Igual | ✓ |
| Avisos rojos: «No se pudo determinar tu negocio», «No se pudieron cargar sus cobros», «No se pudieron cargar los cargos de Atlas» | Igual | ✓ |
| Resumen Cobrado · Comisión a Atlas ({tasa} %) · Pendiente · En mora (alerta) | `Resumen` | ✓ |
| Pestañas Cobros recibidos · Estado de sus cuotas · Cargos de Atlas | `BarraDePestanas` | ✓ |
| Cobros: título, descripción, pastilla con el nombre del negocio; columnas Fecha · Crédito · Cuota(s) · Medio · Importe · Comisión ({tasa} %) · Estado («Pagado» / «Revertido» en gris) | Tarjeta con una fila por cobro (mismas columnas; revertido atenuado) | ✓ datos · ≠ tabla → filas |
| Vacío «Todavía no se ha registrado ningún cobro en sus créditos.» | Igual | ✓ |
| Aviso ámbar «Hay cobros sin pago registrado» con las tres cifras | Igual (`cuadreDeCobros`, probado) | ✓ |
| Cuotas: «Rojo en mora, ámbar pendiente y verde pagado.»; filtros «Todas (n)», «En mora (n)», «Pendiente (n)», «Pagado (n)» | `Chip` con el número como contador | ✓ (el número va en el contador del chip, no entre paréntesis) |
| Por crédito: «Compra {código}» + código corto, `OrigenDeCaja` («Sin caja registrada en la compra» si no hay), «Fecha de origen:», «Falta X de Y», pastilla «Pagado: listo para facturar» / «Se factura al terminar de pagar»; tabla Cuota · Vence · Importe · Pagado · Falta · Estado («En mora N d») | Tarjeta por crédito con todo eso; cuotas como bloques | ✓ datos · ≠ el código completo no tiene `title` (no hay hover): lo lee el lector de pantalla |
| Vacíos «No hay créditos originados en su comercio.» / «Ninguna cuota en ese estado.» | Igual | ✓ |
| Cargos (sólo con `ready` y sin error): «Cargos de Atlas», pastilla «Tarifa: {plan}» / «sin tarifa»; columnas Concepto · Emitido · Vencimiento · Original · Saldo · Estado (tres cestas) | Igual, como filas | ✓ · ≠ mientras llega `/portal/billing` la app dice «Cargando…» (la web enseña el vacío un instante) |
| Vacío «Atlas todavía no le ha emitido ningún cargo.» | Igual | ✓ |
| «Facturas emitidas» / «N factura(s) · Bs X facturado»; Número · Fecha · Vencimiento · Total · Estado · «Descargar» (`descargar-factura-{id}`) | Igual; «Descargar» por factura | ✓ |
| Descargar: `GET /portal/billing/invoices/:id` → `facturaDeComercio` → PDF `factura-{número}.pdf`; error en toast «No se pudo descargar la factura» | Igual; el error en `Alert.alert` con ese título; el PDF por la hoja de compartir | ✓ · ≠ toast → alerta; mientras una factura se genera, los otros «Descargar» se apagan (evita dos hojas de compartir encadenadas) |
| Vacío «Este comercio aún no tiene facturas emitidas.» | Igual | ✓ |
| Aviso «Elige un negocio» si `!ready && !error` | Igual | ✓ |
| Aviso «Cómo se cobra la comisión» con la tasa | Igual, literal | ✓ |

## Formato

`formatBob` y `formatDate` son copia de `lib/formatters.ts` (es-BO, BOB, La Paz, fechas `AAAA-MM-DD`
ancladas a mediodía UTC). Única diferencia: un importe no numérico se pinta `Bs 0,00` en vez de `Bs NaN`.

## Sin verificar en un dispositivo

- La hoja de compartir con el PDF de una factura (el camino `apiArchivo` → `guardarArchivo` ya lo usa
  el `BotonPdf` común; el de factura es el mismo).
