# Plan — Entrada a la app, subpestañas Puntaje/Calificación, bot que se cierra, y ejecución del plan de crédito

- Fecha: 2026-10-06 · Repos: AtlasFrontend (`apps/consumer-app`), AtlasBackend · Rama: `claude/plan-credito-calificacion-mobile-b95b6f` (desde `origin/dev`)
- Predecesor: `AtlasBackend/docs/trabajo/2026-10-06-credito-puntaje-calificacion-app/PLAN.md` (H1–H4). Pablo pidió ejecutarlo de corrido; se toman los supuestos recomendados A1–A5.
- Resultado observable: (1) la primera vez la app muestra la presentación de Atlas y las siguientes abre directo en Ingresar, con «Ingresar» en verde y «Crear una cuenta» a la vista; (2) en «Tu nivel Atlas → Puntaje» hay dos subpestañas: **Mis puntos** (se ganan pagando) y **Mi calificación** (1–100); (3) el asistente no se cierra al escribir; (4) Inicio enseña Crédito habilitado / Puntaje / Calificación como tarjetas separadas.
- Kill-test: abrir el asistente y tocar el campo de texto → si la hoja desaparece, no está hecho.

## Hallazgos
| # | Hecho | Dónde |
|---|---|---|
| E1 | La puerta manda SIEMPRE a `/(public)/bienvenida` a quien no tiene sesión; no recuerda si ya la vio. | `app/index.tsx:28` |
| E2 | «Ingresar» es `primary` (verde) pero arranca APAGADO (gris `action.disabled`) hasta que hay identificador y PIN; «Crear una cuenta» es `ghost`. | `app/(auth)/ingresar.tsx:79-80`, `src/ui/primitives.tsx:1190` |
| E3 | **Causa del bot:** `AssistFab` hace `return null` cuando aparece el teclado; ese `return` desmonta también `AssistSheet`, así que al tocar el campo para escribir la hoja se cierra y pierde su estado. | `src/ui/assist-fab.tsx:96-99,131` |
| E4 | La pestaña «Puntaje» mezcla el desglose 0–100 (titulado «calificación») con el puntaje 0–1000 del motor; los XP están en «Resumen». | `src/ui/progreso-pestanas.tsx:55-82` |

## Alcance
- IN: E1–E4 y H1–H3 del plan predecesor (tarjeta de crédito, separación puntaje/calificación, `rating` en `/progress`).
- OUT: fórmula de la línea, artefactos del motor, AdminPortal (H2.S3 queda pendiente), pesos de la calificación.
- Ambigüedad: «botón de entrar en verde» → supuesto: «Ingresar» siempre verde y los campos que faltan se señalan al pulsar (regla 95.3), en vez de un botón gris. Confirmar con Pablo.

## H5 — Entrada a la app
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H5.M1 | `src/session/primera-vez.ts`: marca persistente «presentación vista» (AsyncStorage, falla hacia mostrarla) | lee/escribe/tolera fallo | `jest primera-vez` PASS | HECHO |
| H5.M2 | La puerta: sin sesión y con marca → `/(auth)/ingresar`; sin marca → bienvenida. La bienvenida marca al salir por cualquiera de sus botones | 2 casos de la puerta | `jest puerta-entrada` PASS | HECHO |
| H5.M3 | Ingresar siempre verde; al pulsar sin datos, error en el campo; «Crear una cuenta» como `secondary` | pulsar vacío muestra errores y no llama a `signIn` | `jest ingresar` PASS | HECHO |

## H6 — Bot
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H6.M1 | El teclado/tour solo ocultan el BOTÓN; la hoja sigue montada mientras está abierta | con la hoja abierta, mostrar teclado no la desmonta | `jest asistente-fab-teclado` PASS | HECHO |

## H7 — Subpestañas Puntaje / Calificación
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H7.M1 | Dentro de «Puntaje», subpestañas «Mis puntos» (XP + racha + cómo se ganan) y «Mi calificación» (1–100 + desglose + lo que usó el motor, sin llamarlo «puntaje») | cambiar de subpestaña cambia el contenido | `jest progreso-subpestanas` PASS | HECHO |

## H1–H3 (del plan predecesor, ejecución)
Se ejecutan H1.S1.M2, H1.S2.M1–M3, H2.S1.M1–M2, H2.S2.M1–M6 tal como están escritos allá; su estado se lleva en este archivo:

| ID | Estado |
|---|---|
| H1.S2.M1–M3 tarjeta «Crédito habilitado» | HECHO |
| H2.S1.M1–M2 `rating` 1–100 en `/progress` | HECHO |
| H2.S2.M1–M6 rótulos y tarjetas en la app | HECHO |

## Gates
`npx tsc --noEmit` y `npx jest` del consumer-app; `yarn type-check` y tests dirigidos en AtlasBackend.
