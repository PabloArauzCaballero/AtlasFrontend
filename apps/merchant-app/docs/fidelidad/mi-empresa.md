# Fidelidad · Mi empresa

Web: `AtlasERPFrontend` en `origin/dev` (34f59e5), `app/portal-comercio/expediente/page.tsx` →
`components/screens/PartnerDossierScreen.tsx` (+ `PartnerDossierPanels`, `PartnerRequirementsPanel`,
`MerchantPaymentQrScreen`, `MerchantStructureScreen`, `ImportarSucursalesModal`, `ExcelImportModal`,
`ReautenticacionDialog`, `lib/qr.ts`, `lib/cartelQr.ts`, `lib/excel.ts`, `lib/importacionExcel.ts`,
`lib/cajasDeSucursal.ts`, `lib/cuentaEnmascarada.ts`, `lib/qrImagen.ts`, `hooks/useMerchantScope.ts`).

App: `app/(app)/(tabs)/empresa.tsx`, `src/ui/empresa/*`, `src/features/empresa/*`. Pruebas en `__tests__/empresa/`.

Leyenda: ✓ igual · ≈ igual en lo que hace, distinto en el cómo (motivo al lado) · ✗ no está (motivo).

## Pantalla (cabecera, expediente, pestañas)

| Web | App | |
|---|---|---|
| Título «Mi empresa» y descripción «Los datos de tu negocio…» | `ScreenHeader` con el mismo texto; avatar `BotonCuenta` a la derecha | ✓ |
| «Descargar PDF» (`pdf-mi-empresa`) sólo con expediente cargado | Botón bajo la cabecera (la cabecera admite una sola acción, que es el avatar) | ≈ |
| PDF «Mi empresa»: resumen, aviso «Expediente incompleto», Ficha comercial, Sucursales, Terminales POS | `documentoMiEmpresa` (mismas claves, etiquetas y textos; probado) | ✓ |
| El expediente se resuelve con `partner-onboarding/mine`, el aprobado primero | `useMerchantPartner` (mismo endpoint y regla) en el padre, pasado a las 4 pestañas | ✓ |
| Estado `buscando` / `sin-expediente` / `encontrado`; un fallo de `mine` no es «no tiene» | Igual: fallo → aviso rojo y se queda en «Comprobando…» | ✓ |
| — | `SelectorDeExpediente` cuando el usuario tiene más de un expediente | ≈ la web de «Mi empresa» elige el aprobado sin decirlo; la pieza común de la app lo dice (como hacía la web en «Mi QR de cobro» suelta) |
| Aviso de `feedback` («X: listo.», error) encima de las pestañas | `Aviso` en el mismo sitio (`expediente-feedback`) | ✓ |
| «No se pudo cargar tu empresa» si falla el estado | ✓ | ✓ |
| `TabbedPanels keepMounted` con `?tab=` (estado, ficha, qr, sucursales) | `usePestana` + `BarraDePestanas` + `Panel` (siempre montados); mismas etiquetas | ✓ |
| Las 4 pestañas se pintan siempre, también sin expediente | ✓ (probado en `pantalla.test.tsx`) | ✓ |
| Toda acción relee el estado; QR y Sucursales avisan al padre (`onDone`) | ✓ `recargarEstado` tras cada acción de las hijas | ✓ |
| — | Tirar hacia abajo: relee expedientes, estado, QR, sucursales y opciones | ≈ añadido del teléfono (la web recarga la página) |

## Estado del expediente

| Web | App | |
|---|---|---|
| Sin expediente: panel «Abrir expediente» «Todavía no tienes un expediente. Este es el primer paso.» | ✓ | ✓ |
| Campos: Razón social*, Nombre comercial, NIT* («Sólo dígitos.»), Matrícula de comercio, Rubro del negocio (select `domain:crm.merchantCategory`, «— Seleccione —», hint), Correo de contacto* (email), Teléfono; tooltips | Mismos campos, etiquetas, hint y tooltips (como ayuda ⓘ). Teclados numérico/correo/teléfono | ✓ |
| Validación nativa del navegador (`required`, `type=email`) | Se comprueba al pulsar y se marca el campo («Completa este campo.» / «Escribe un correo válido…») | ≈ el navegador pinta su propio globo; la app lo dice en el campo |
| Envía sólo lo escrito (`camposEscritos`) | ✓ probado | ✓ |
| «Abrir expediente» → «Expediente {id} abierto.» / error del 409 tal cual | ✓ | ✓ |
| Buscando: «Comprobando si ya tienes un expediente…» | ✓ (probado: no ofrece abrir) | ✓ |
| Con expediente: razón social, «NIT … · expediente …», píldora de estado (verde si approved) | `CardHeader` + `Badge` | ✓ |
| `SubmissionGaps`: listo (verde) / «Falta N requisito(s)…» con lista y «Resuélvelo en «…»» | ✓; el enlace cambia de pestaña (`?tab=`) | ✓ |
| `PartnerRequirementsPanel`: Matrícula (Número de matrícula*, «Guardar matrícula») | ✓ | ✓ |
| Representante legal: texto según falte representante o poder; «Editar»/«Cerrar»; Nombre completo*, Tipo de documento (ci/passport/foreign_id), Número de documento*, Poder notarial (PDF/PNG/JPG ≤10 MB, asterisco si falta el poder), «Guardar representante»; sube el poder ANTES de declarar | ✓; el archivo se elige con el selector de documentos y viaja en bytes | ≈ |
| «Enviar a revisión» deshabilitado si no está listo | ✓ | ✓ |

## Ficha comercial

| Web | App | |
|---|---|---|
| Sin expediente: «Primero hay que abrir tu expediente» + texto | ✓ | ✓ |
| Descripción del panel | ✓ | ✓ |
| Nombre comercial (hint), Rubro (`opcionesDeRubro`: «— Sin definir —» y «(fuera de catálogo)»), Teléfono de contacto | ✓ probado | ✓ |
| «Guardar ficha» → `commercial-profile` con sólo lo escrito | ✓ | ✓ |
| Razón social, NIT, Matrícula («Sin declarar»), Correo verificado («· verificado»/«· sin verificar») | `KeyValue` | ✓ |

## Mi QR de cobro

| Web | App | |
|---|---|---|
| Sin expediente: «Primero hay que abrir tu expediente» + texto | ✓ | ✓ |
| Avisos: bloqueo por estado del expediente, «Atlas rechazó su último QR», «Su QR está en revisión», error, aviso de la acción, «Sus clientes todavía no pueden pagarle» | ✓ mismos textos y condiciones | ✓ |
| Panel vigente: «Lo que ve su cliente» / «QR bancario del comercio» + descripción; «Descargar PDF» y «Actualizar» | ✓ | ✓ |
| Imagen del QR subido (fetch autenticado → blob) | `apiBlobUrl` → `data:` en `<Image>`; esqueleto mientras carga; «No se pudo mostrar el QR» | ✓ |
| Entidad, Cuenta, Huella del archivo, Subido (`es-BO`), píldora con texto de estado, nota «Hay un QR nuevo esperando revisión…» | ✓ | ✓ |
| Sin QR: «Todavía no hay QR de cobro» + texto | `EmptyState` | ✓ |
| Subir/Reemplazar: «Imagen del QR (PNG o JPG)» (input de archivo) | «Elegir de mis fotos» o «Tomar foto» (expo-image-picker) con ficha (miniatura, nombre, peso, «Quitar») | ≈ el teléfono no tiene campo de archivo; textos «Elegir de mis fotos», «Elegir otra», «Tomar foto» y el aviso de permiso de cámara son nuevos |
| Entidad (sigla ASFI)* (`domain:portal.bankInstitution`, «— Elija su banco —») | ✓ | ✓ |
| Cuenta enmascarada (se enmascara al salir del campo; maxLength 34) | ✓ teclado de teléfono (lleva `*`) | ✓ |
| Validaciones y su orden: sin imagen, sin entidad, cuenta inválida, imagen sin QR (`BarcodeDetector`) | ✓ mismo orden y textos; el QR se detecta con `scanFromURLAsync` de expo-camera; si el lector falla no bloquea | ≈ |
| Contraseña otra vez (ERP-03) antes de subir; `REAUTH_REQUIRED` reintenta sólo el registro | Hoja «Confirme que es usted» con los mismos textos; siempre se pide (la sesión de la app es siempre de comercio) | ✓ |
| Permiso firmado → subida → registro con `x-reauth-token` | ✓ bytes por `/almacen/subida` (nunca Blob) | ✓ |
| «QR bancario registrado: …», limpia el archivo, relee y avisa al padre | ✓ (`onDone` → «Estado» deja de pedir `bank_qr`) | ✓ |
| «QR anteriores (N)» con entidad, cuenta, huella, fecha, estado y nota de rechazo | Lista de tarjetas en vez de tabla | ✓ |
| «Atlas nunca recibe este dinero» | ✓ | ✓ |
| PDF «Mi QR de cobro» | `documentoQrDeCobro` (probado) | ✓ |

## Sucursales

| Web | App | |
|---|---|---|
| Negocio (sólo si administra varios), error de alcance, «personal interno» | `useMerchantScope` portado (probado) | ✓ |
| «Tu expediente todavía no está aprobado» con el estado en palabras | ✓ | ✓ |
| Aviso «Listo» / «No se pudo completar»; «No se pudo cambiar el estado» | ✓ | ✓ |
| Panel «Sucursales registradas» + acciones: Descargar PDF, Importar desde Excel, Agregar sucursal, Actualizar | ✓ | ✓ |
| Tabla (Sucursal/ciudad·dirección, BNPL con tooltip, Estado, Cajas y QR, Acciones) | Una tarjeta por sucursal; la explicación del BNPL va escrita bajo la píldora (no hay tooltip) | ≈ |
| Estados de «Cajas y QR»: buscando, sin expediente, sin enlazar (selector «¿Es uno de los locales que ya declaraste?» + «Habilitar QR en esta sucursal»), sin cajas, rejilla de cajas, «Agregar cajas» | ✓ mismos textos | ✓ |
| Caja: QR 88 px (toca → grande), alias, serial, «Código a mano», estado, nota «El teléfono del cliente rechaza…», «Descargar QR», Suspender/Activar/Reactivar | ✓ rejilla de 2 columnas | ✓ |
| QR en pantalla: `QrCanvas` con el serial, nivel M, zona tranquila, #0f172a sobre blanco | `react-native-qrcode-svg` con el mismo contenido y nivel (probado: misma matriz que el generador de la web) | ✓ |
| «QR de {caja}» grande (280 px) con alias y serial | Hoja | ✓ |
| «Descargar QR»: cartel PNG 1200×1900 (`cartelQr.ts`) | Mismo plano (medidas, colores, textos) dibujado como SVG y convertido a PNG con `toDataURL`; vista previa en hoja y «Guardar o compartir el cartel» → hoja de compartir | ≈ la web descarga directo; el logo de la cabecera no va (se escribe «ATLAS», que es el respaldo de la web); sin sombra bajo el marco del QR; el texto se encoge por estimación (SVG no mide) |
| Editar / Dar de baja / Reactivar sucursal | ✓ | ✓ |
| Modal «Agregar sucursal»: Nombre*, Ciudad (catálogo, «— Sin definir —»), Dirección, Cantidad de cajas (1, 0–50); se declara sola en el expediente y crea Caja 1… activas | Hoja; misma secuencia y textos | ✓ |
| Modal «Editar …»: Nombre*, Ciudad* (conserva «(valor anterior)»), Dirección | Hoja | ✓ |
| Modal «Agregar cajas en …»: Cantidad (1–50)*, Serial propio | Hoja; fuera de rango dice «Escribe un número entre 1 y 50.» | ≈ el navegador valida min/max con su globo |
| «Importar sucursales desde Excel»: descripción, «Descargar plantilla», «6 columnas · 1 obligatorias · hasta 500 filas», archivo .xlsx/.csv ≤10 MB, errores del archivo, píldoras (listas/incompletas/creadas/rechazadas), tabla de filas, resultado, «Crear N registros», progreso | Hoja con los mismos textos; la tabla pasa a lista; la plantilla se entrega a la hoja de compartir y el archivo se elige con el selector de documentos | ≈ |
| Lectura de Excel sin dependencias (`DecompressionStream` + `DOMParser`) | Porte con descompresor DEFLATE propio (`inflar.ts`) y lector XML mínimo; mismos topes (10 MB, 1000 piezas, 50 MB descomprimidos) | ≈ no hay `DecompressionStream`/`DOMParser` en el teléfono; probado contra zlib |
| Importar no duplica (sucursal por nombre, caja por serial) | `importarSucursal` (mismo algoritmo) | ✓ |
| PDF «Sucursales del comercio» | `documentoSucursales` (probado) | ✓ |

## Sin verificar en un teléfono

- `toDataURL` del cartel y el tipo devuelto por la fototeca de iOS (HEIC vs JPEG) sólo se han compilado
  (`expo export`) y probado en jest, no en un dispositivo.
- `scanFromURLAsync` con una foto real del QR de un banco.
