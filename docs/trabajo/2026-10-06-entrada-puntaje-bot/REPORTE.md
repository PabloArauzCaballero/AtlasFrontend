# Reporte — Entrada a la app, subpestañas Puntaje/Calificación, bot, y tarjetas de Inicio

> **AVANCE: 8 / 8 — 100 % de lo planificado en este archivo.** Pendiente del plan predecesor: H1.S1.M1 (motor), H1.S1.M3 y H2.S1.M4 (matriz de autorización), H2.S3 (AdminPortal), H3 (tarjetas Normal…Black de punta a punta) y la prueba visual de las pantallas internas.

- Fecha: 2026-10-06 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/plan-credito-calificacion-mobile-b95b6f` en AtlasFrontend y AtlasBackend
- Peldaño: entrada (H5) `VERIFIED` en navegador real (web export) · bot (H6), subpestañas (H7) y tarjetas (H1/H2) `TESTED` (componente) · backend (H2.S1) `TESTED`

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H5.M1–M2 | Primera vez → bienvenida; luego directo a Ingresar. Las salidas de sesión pasan por la puerta | `npx jest __tests__/puerta-entrada.test.tsx` + capturas | PASS (3/3); en navegador `/` → `/ingresar` en 390, 820 y 1366 px, 0 errores de consola |
| H5.M3 | «Ingresar» siempre verde; al pulsar vacío, error en cada campo; «Crear una cuenta» como botón visible | `npx jest __tests__/ingresar-pin.test.tsx` | PASS (7/7) + `evidencia/03-ingresar-vacio-movil.png` |
| H6.M1 | El asistente ya no se cierra al aparecer el teclado | `npx jest __tests__/asistente-fab-teclado.test.tsx` | PASS (4/4); con el código anterior fallan 2 (reproduce el bug) |
| H7.M1 | «Puntaje» con subpestañas «Mis puntos» y «Mi calificación» | `npx jest __tests__/progreso.test.tsx` | PASS (26/26) |
| H1.S2 | Tarjeta «Crédito habilitado» con el monto del motor, procedencia y 4 estados | `npx jest __tests__/portada-orden.test.tsx` | PASS (11/11) |
| H2.S1 | `GET /customers/:id/progress` publica `rating` (1–100) y `points` | `npx jest test/unit/credit/...` (AtlasBackend) | PASS (34/34) |
| H2.S2 | Rótulos: «puntos» sólo para lo ganado pagando; el 0–100 es «calificación»; el 0–1000 es «índice de crédito»; la letra es «categoría de riesgo» | suite completa de la app | PASS |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S1.M1 artefacto del motor publica el monto | TODO | Correr contra el motor de dev |
| H1.S1.M3 / H2.S1.M4 matriz de autorización negativa | TODO | Test de integración con base real |
| H2.S3 AdminPortal con los mismos nombres | TODO | — |
| H3 tarjetas Normal…Black de punta a punta | TODO | — |
| Push a GitHub | BLOQUEADO | La app de Claude no tiene permiso de escritura (403); el commit queda local |

## Evidencia
Prueba visual de Inicio y «Tu nivel Atlas» HECHA después: `evidencia/10-inicio-*.png`, `11-puntaje-mis-puntos-*.png`, `12-puntaje-mi-calificacion-*.png` (backend simulado en el navegador, datos sintéticos). El resto del plan se cerró en el reporte raíz: `AtlasBackend/docs/trabajo/2026-10-06-credito-puntaje-calificacion-app/REPORTE.md`.

```text
consumer-app $ npx jest
Test Suites: 83 passed, 83 total
Tests:       820 passed, 820 total
consumer-app $ npx tsc --noEmit -p .   → 0 errores
consumer-app $ npx eslint .            → 0 errores, 14 avisos (los mismos 14 que antes del cambio)
AtlasBackend $ npx jest --testPathPatterns=test/unit/credit
Test Suites: 37 passed, 37 total
Tests:       438 passed, 438 total
AtlasBackend $ yarn type-check → exit 0
```
Capturas: `evidencia/01-primera-vez-*.png`, `02-segunda-vez-*.png` (móvil, tablet, escritorio), `03-ingresar-vacio-movil.png`. Revisadas.

## No cubierto
- Las tarjetas de Inicio y las subpestañas no se vieron renderizadas en un dispositivo ni en web con datos: sólo pruebas de componente.
- El bot no se probó en un teléfono real; el arreglo cubre la causa encontrada (desmontaje al abrir el teclado). Si se sigue cerrando por otra causa en un modelo concreto, hace falta el video o el modelo de teléfono.
- Tema claro: la app sólo tiene tema oscuro.

## Desvíos del plan
- A4: el 0–1000 del motor no se ocultó al cliente, se renombró a «índice de crédito». Ocultarlo quitaba información que la persona usa y no lo pidió nadie.
- Las rutas de guarda que mandaban a la bienvenida ahora mandan a `/`, la puerta que decide (si no, al cerrar sesión volvía la presentación).

## Riesgos residuales
- Las frases por tramo de la calificación (≥80, ≥60, ≥40) son de presentación, no política; si negocio quiere otros cortes se cambian en `src/features/calificacion.ts`.
- Quien ya tiene la app instalada verá la bienvenida una vez más (la marca es nueva).

## Decisiones y ambigüedades
- A1 (supuesto, confirmar con Pablo): la Calificación 1–100 es la puntuación de relación ya existente.
- «Botón de entrar en verde»: se interpretó como «Ingresar» siempre verde con errores por campo.

## Verificación contra el backend REAL (2026-10-06, después del merge)
- Backend de `dev` (con #198) compilado y levantado contra Postgres 16 y Redis reales locales, migraciones aplicadas y datos SINTÉTICOS de demo (`yarn db:seed:demo`, 965 filas). Cliente sintético 910001.
- `GET /customers/910001/progress` → `rating` 68/100, `points` 6.928 (= XP), nivel ESTABLECIDO, tarjeta GOLD. Otro cliente → 403; sin token → 401.
- Ajuste manual de tarjeta como operador interno (`POST /operations/customers/910001/card-tier`, BLACK) → el cliente la ve como MANUAL en `/progress`; fila `credit.card_tier.override_set` en `audit.operational_audit_logs`.
- App web contra esa API: `evidencia/20-real-inicio-*.png`, `21-real-mi-calificacion-*.png`. Únicos 404: `/credit-rating` (sin crédito calificado, tolerado) y `/mobile/assist/conversation` (asistente apagado en local, 404 por diseño).
- Encontrado ahí y corregido: el panel del motor decía «Te faltan 60 puntos» y dos avisos de mora decían que el puntaje baja. Ahora: «Te faltan 60» y «tu calificación baja». Prueba `__tests__/nombres-puntaje-calificacion.test.ts` (falla con los textos viejos).
