# Reporte — Correcciones vistas en la app real (capturas de Pablo, 2026-10-06)

> **AVANCE: 11 / 12 — 91,7 %.** Las seis correcciones (C1–C6) están escritas, probadas y verificadas contra el backend real levantado en local; falta X.M1 (PRs, CI, merge a `dev` y promoción a `test`), que se completa en este mismo turno.

- Fecha: 2026-10-06 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/plan-credito-calificacion-mobile-b95b6f` en AtlasBackend y AtlasFrontend
- Peldaño: backend `VERIFIED` (API real + Postgres real; motor = DOBLE por contrato) · app `VERIFIED` (export web contra ese backend, 3 anchos, revisadas) · motor real: no ejercitado

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| C1.M1 | Cliente activo sin línea abre `/credit-line` → el backend pide la decisión al motor en ese momento y devuelve el monto | `jest credit-line-on-demand` + curl real | PASS 7/7; real: 200 `approvedLimit 1800` (del doble), 2.ª apertura 0 llamadas nuevas, motor caído 503 `CREDIT_LINE_ENGINE_UNAVAILABLE`, reintento inmediato 503 sin llamar (pausa 60 s), no activo 404, otro cliente 403, sin token 401 |
| C1.M2 | App: motor caído → «El motor de decisión no respondió… Reintentar», no «calculando» | `jest credito-motor-no-responde portada-orden` | PASS; captura `C1-inicio-motor-caido-movil.png` |
| C1.M3 | Inicio muestra «Crédito habilitado Bs 1.800,00 · Lo decidió el motor de decisión de Atlas» | capturas `C1-inicio-credito-motor-{movil,tablet,escritorio}.png` | revisadas |
| C2.M1 | `/progress` publica `level/nextLevel/levelLadder` en PUNTOS; la tarjeta sigue a ese nivel | `jest points-level credit-progress` + curl real | PASS; real: 910001 6.928 puntos → Consolidado (faltan 3.072), calificación 68 aparte |
| C2.M2 | Tarjeta de nivel: «6.928 puntos», nunca «24 de 100» | `jest nivel progreso perfil-puntaje` | PASS |
| C3.M1 | «Tu nivel Atlas»: Puntaje (tarjeta, nivel, puntos, cómo se ganan) · Calificación (1-100, cuenta, índice del motor) · Logros · Historia (escalera en puntos) | `jest progreso` + capturas `C3-*`, `C2-*` | PASS 41/41 dirigidos; revisadas |
| C4.M1 | Captura del carnet: encabezado «Tus capturas» + insignia «0 de 5» sin cortes; Anterior/Siguiente como botones con flecha a lo ancho; «Todavía» con tilde | `jest identidad` + `C4-identidad-capturas-*` | PASS 13/13; revisadas |
| C5.M1 | Pantalla «Pautas para tus fotos» (Documento / Selfie) con pares Correcto/Incorrecto vectoriales; botón «Ver pautas para tus fotos» en la captura | `jest pautas-documento` + `C5-*` (móvil a 3x) | PASS 3/3; recorte a 3x revisado: nítido |
| C6.M1 | `economicActivityOther` obligatorio con Z-OTRO; migración nueva | `jest otro-cual.schemas` + API real + migración up/down/up | PASS; 400 sin texto, guarda y relee «Apicultura»; 2.ª corrida de `up` no aplica nada |
| C6.M2 | `genderSelfDescribed` con `genderDeclared: other`; columna nueva; cambiar de género lo borra | `jest customer-profile-gender-other` + API real | PASS 3/3 (correcto/límite/inválido); real 400 con `female`, 200 con `other` |
| C6.M3 | App: «¿Cuál es tu actividad?», «¿Cuál es tu zona o barrio?» y «¿Cuál?» de género; bloquean el guardado vacío y se envían | `jest otro-cual otro-cual-zona` + `C6-*` | PASS 7/7; revisadas |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| X.M1 | EN CURSO | PRs, CI verde, merge a `dev`, promoción `dev → test` (este turno) |
| Verificar C1 contra el motor REAL de dev | BLOQUEADO (infraestructura) | El motor de dev está detrás de Tailscale (`node quota reached on this tailnet`). Se verificó contra un doble por contrato en los 3 niveles (aprueba, falla, no activo). |

## Evidencia
```text
AtlasBackend $ npx jest test/unit/credit test/e2e/credit → Test Suites 42 passed · Tests 489 passed
AtlasBackend $ npx jest test/unit/customer-onboarding test/unit/customers → 64 suites · 590 passed (+11 nuevas)
AtlasBackend $ yarn type-check · type-check:tests · format:check · lint → OK · OK · OK · 0 errores (109 avisos, igual que antes)
consumer-app $ npx tsc --noEmit → 0 errores · npx eslint . → 0 errores (14 avisos, igual que antes)
consumer-app $ npx jest → Test Suites 88 passed · Tests 873 passed
Migraciones: up (2 migradas) → down ×2 (atributo 0 filas, columna ausente) → up (2) → up (0)
```
Capturas en `evidencia/` (datos SINTÉTICOS de la siembra de demostración; clientes 910098/910099 son copias sintéticas de 910006 creadas sólo en la base local desechable para tener un cliente activo SIN línea). Consola/red: sólo los 404 ya conocidos de `credit-rating` y `assist/conversation` (sin datos) y el 503 esperado del motor caído.

## No cubierto
- El motor de decisión REAL: el monto 1.800 lo devolvió un doble (`approved_credit_limit`), declarado como tal.
- Teléfono físico: la verificación es el export web; la app nativa no se abrió.
- Tema claro: la app sólo tiene oscuro.
- La deduplicación «una llamada a la vez» es por instancia de API; con varias réplicas, dos podrían pedir a la vez (inocuo: el recálculo escribe una versión nueva).

## Desvíos del plan
- C2: además se quitó el nivel de las frases de la calificación («Tu calificación es 68 de 100.»), porque mezclarlos es lo que hacía leer «24» como nivel.
- La tarjeta «TU PUNTAJE» partía «6.928 puntos» en dos renglones; se corrigió tras ver la captura.

## Riesgos residuales
- Si el rubro deja de ser Z-OTRO en un guardado parcial que no manda el texto, el valor anterior de `economic_activity_other` queda guardado (la app sí lo borra al cambiar).
- Hallazgo fuera de alcance: con `/me` devolviendo `profile: null` para un cliente activo, la app queda en una pantalla en blanco.

## Decisiones y ambigüedades
- A1 escalones del nivel (0 · 500 · 2.000 · 5.000 · 10.000 puntos) — supuesto; confirmar con Pablo. Se cambian en `AtlasBackend/src/modules/credit/domain/points-level.ts` (y su espejo `consumer-app/src/features/nivel.ts`).
- A2 el nivel por puntos y la tarjeta son presentación: el monto y la capacidad de pago NO cambian.
- El texto libre de «Otra actividad» se marca `allowed_for_credit_decision = false`: un texto a mano no es una variable comparable.
