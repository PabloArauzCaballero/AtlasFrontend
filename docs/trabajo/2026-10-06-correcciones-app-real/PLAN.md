# Plan — Correcciones vistas en la app real (2026-10-06, capturas de Pablo)

- Repos: AtlasBackend, AtlasFrontend (`apps/consumer-app`), AtlasAdminPortal (sólo si cambia el contrato que lee)
- Rama: `claude/plan-credito-calificacion-mobile-b95b6f` desde `origin/dev`. Al terminar: PR por repo y merge con CI en verde.
- Resultado observable: en el teléfono, (1) Inicio muestra el monto de crédito que decidió el motor, no «Todavía estamos calculando»; (2) el nivel se mide en PUNTOS ganados por compras pagadas, no en el 24 de la calificación; (3) «Tu nivel Atlas» tiene una pestaña de Puntaje (con la tarjeta) y otra de Calificación; (4) la pantalla de capturas no tiene textos cortados ni el «Siguiente» suelto; (5) hay una pestaña de información con las pautas del documento ilustradas en máxima calidad; (6) toda opción «Otro/Otra» abre un campo «¿Cuál?» que se guarda en el servidor.
- Kill-test: cliente activo recién creado, sin línea → abrir Inicio → si sigue diciendo «calculando» sin que nadie haya pedido la decisión al motor, no está hecho.

## Hallazgos (causa real de cada reclamo)
| # | Reclamo | Causa | Dónde |
|---|---|---|---|
| C1 | No aparece el monto de crédito | Nadie pide la línea al motor cuando el cliente termina el alta. Sólo la calcula una tarea programada (cada hora, 50 clientes, y sólo si hay worker con planificador). Mientras, la app pinta «calculando» para siempre, también cuando el motor falló. | `AtlasBackend/src/modules/credit/application/credit-line-refresh.service.ts`, `credit-line.service.ts:68` (`requireCurrent` → 404 sin pedir nada) |
| C2 | El nivel sale «24» | El nivel (y la tarjeta) se calculan sobre la puntuación de relación 0-100, que es la Calificación, no sobre los puntos. | `AtlasBackend/src/modules/credit/domain/relationship-progress.ts`, `payment-capacity.ts:76-80` |
| C3 | La pestaña de la tarjeta no está separada en dos | «Resumen» mezcla tarjeta + nivel + puntos; puntos y calificación quedaron como subpestañas dentro de «Puntaje». | `consumer-app/app/(app)/progreso.tsx`, `src/ui/progreso-pestanas.tsx` |
| C4 | Bugs en la captura del carnet | Detalle del encabezado cortado a 2 líneas por la insignia; «Siguiente» es un botón fantasma alineado a la izquierda que parece texto suelto; «Todavia» sin tilde. | `app/(onboarding)/identidad.tsx:643`, `src/ui/image-slides.tsx:229-236` |
| C5 | Pautas del documento con imágenes | Existen los dibujos vectoriales (carnet bien/oscuro/reflejo/borroso/inclinado) pero sólo como desplegable sobre la cámara. No hay pestaña de información. | `src/ui/consejos-foto.tsx`, `src/ui/consejos-foto-dibujos.ts` |
| C6 | «Otra» sin «¿Cuál?» | Rubro «Otra actividad» (Z-OTRO), zona «Otra zona», género «Otro»: ninguno pide ni guarda el texto. | `economia.tsx`, `domicilio.tsx`, `editar-perfil.tsx`; backend `customer-onboarding-profile.schemas.ts` |

## Ambigüedades (supuesto tomado — confirmar con Pablo)
- A1 Escalones del nivel por puntos: Nuevo 0 · En construcción 500 · Establecido 2.000 · Consolidado 5.000 · Preferente 10.000 puntos (1 punto = 1 Bs pagado a tiempo). Se cambian en un solo archivo.
- A2 El nivel por puntos y la tarjeta Normal…Black son presentación: NO tocan el monto. El monto sigue saliendo del motor, que sigue recibiendo la puntuación de relación como hoy (no se cambia una regla con consecuencia económica sin aprobación).
- A3 «Puntaje por cada compra realizada»: los puntos se ganan por las compras PAGADAS a tiempo (comprar sin pagar no suma), como se definió antes.

## C1 — Crédito habilitado desde el motor, sin esperar a una tarea
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| C1.M1 | Backend: si un cliente ACTIVO no tiene línea, `GET /credit-line` pide la decisión al motor en ese momento (una sola vez a la vez por cliente, con pausa si el motor acaba de fallar) | Cliente activo sin línea → 200 con el monto del motor; motor caído → 503 `CREDIT_LINE_ENGINE_UNAVAILABLE`; no activo → 404 | `jest credit-line-on-demand` PASS (3 niveles) | HECHO |
| C1.M2 | App: 503 → error accionable con reintento (no «calculando»); 404 sigue diciendo calculando | Estados probados | `jest portada-orden` PASS | HECHO |
| C1.M3 | Verificación real: backend + Postgres + motor simulado por contrato; cliente activo sin línea abre Inicio y ve el monto | Captura | evidencia `C1-*` (contra DOBLE del motor) | HECHO |

## C2 — Nivel por puntos
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| C2.M1 | Backend: `level`, `nextLevel`, `levelLadder` sobre los puntos; la tarjeta sigue al nivel por puntos | 0 pts → Nuevo; 2.000 → Establecido | `jest points-level credit-progress` PASS | HECHO |
| C2.M2 | App: la tarjeta de nivel muestra «N puntos» y lo que falta en puntos | Nunca «24 de 100» en el nivel | `jest progreso nivel` PASS | HECHO |

## C3 — Dos pestañas: Puntaje y Calificación
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| C3.M1 | «Tu nivel Atlas»: pestañas Puntaje (tarjeta, nivel, puntos, cómo se ganan) · Calificación (1-100, desglose, índice del motor) · Logros · Historia | Cada pestaña sólo lo suyo | `jest progreso` PASS + captura | HECHO |

## C4 — Bugs de la captura
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| C4.M1 | Encabezado sin cortes, «Siguiente/Anterior» como botones claros con flecha y alineados, tildes | Captura sin texto truncado | `jest identidad` + captura `C4-*` | HECHO |

## C5 — Pestaña de pautas del documento
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| C5.M1 | Pantalla «Pautas para tu documento» (iluminación, reflejos, enfoque, encuadre) con pares bien/mal vectoriales a ancho completo; se abre desde la captura | Render nítido a 3x | `jest pautas-documento` + capturas a 3x revisadas | HECHO |

## C6 — «Otro/Otra» → «¿Cuál?»
| C6.M1 | Backend: `economicActivityOther` (atributo nuevo por migración) obligatorio si el rubro es Z-OTRO | 400 sin texto; guarda con texto | `jest` + migración real up/down | HECHO |
| C6.M2 | Backend: `genderSelfDescribed` opcional en el perfil (columna nueva por migración) | Se guarda y se devuelve | `jest` + migración real | HECHO |
| C6.M3 | App: campo «¿Cuál?» en rubro, zona y género; la zona escrita viaja como zona | Aparece sólo con «Otro/Otra», se valida y se envía | `jest otro-cual otro-cual-zona` PASS + capturas `C6-*` | HECHO |

## Cierre
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| X.M1 | Gates de los repos tocados + PR + CI verde + merge a `dev` y promoción a `test` | | | EN CURSO |
