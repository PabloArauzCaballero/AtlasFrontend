# Plan — DDD y código expresivo: Selección de canal y verificación de contacto

- Fecha: 2026-09-22 · Repo: AtlasFrontend (frontend móvil) · Predecesor: ninguno en esta pasada
- Resultado observable de esta pasada: flujo, regla, evidencia y próxima comprobación definidos sin modificar producto.
- Kill-test: si no se puede seguir `apps/consumer-app/app/(onboarding)/verificar-contacto.tsx` → `apps/consumer-app/src/features/onboarding/canales-de-verificacion.ts`, el diagnóstico no está completo.

## Alcance

- IN: `apps/consumer-app/app/(onboarding)/verificar-contacto.tsx`, `apps/consumer-app/src/features/onboarding/canales-de-verificacion.ts`, contrato y prueba de referencia del flujo.
- OUT: migraciones, cambios de API, UX o reglas no confirmadas; resto del repo.
- Ambigüedad registrada: El backend es autoridad sobre canal y verificación; respetar Expo 57 antes de tocar código.

## H1 — Diagnóstico y referencia

**CA:** Dado el flujo existente, cuando se inspeccionan entrada, decisión y resultado, entonces la regla tiene un propietario y una prueba de referencia identificables.
**DoD:** inspección de los archivos citados y `npm test -- --runInBand __tests__/canales-de-verificacion.test.ts` con el resultado literal del reporte.
**Estado:** HECHO

### H1.S1 — Rastrear y probar

**CA:** Dado el checkout actual, cuando se sigue el flujo, entonces se distingue regla de coordinación. **DoD:** rutas y símbolos reales registrados abajo. **Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Localizar entrada y propietario | Ambas rutas existen y se identificó la regla | `test -f 'apps/consumer-app/app/(onboarding)/verificar-contacto.tsx' && test -f 'apps/consumer-app/src/features/onboarding/canales-de-verificacion.ts'` → salida 0 | HECHO |
| H1.S1.M2 | Fijar referencia | El chequeo dirigido termina con salida 0 | `npm test -- --runInBand __tests__/canales-de-verificacion.test.ts` → 1 suite; 10/10 pruebas pasan | HECHO |

**Regla observada:** La app ofrece los canales disponibles en el orden que manda el servidor.

## H2 — Próxima capacidad acotada

**CA:** Dado el contrato confirmado, cuando se ejerce la condición límite del flujo, entonces el resultado visible o persistido coincide con la regla y un rechazo no produce efecto parcial.
**DoD:** prueba de comportamiento dirigida, verificación de contrato y recorrido real si se modifica código; reporte con salida literal.
**Estado:** HECHO

### H2.S1 — Confirmar semántica antes de refactorizar

**CA:** La condición límite tiene resultado esperado documentado. **DoD:** prueba dirigida y revisión del contrato vigente. **Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Probar el estado visible tras timeout de la petición de código y la reconciliación posterior, sin prometer que el envío falló definitivamente. | Hay un caso verificable y no cambia reglas hipotéticas | `npm test -- --runInBand __tests__/verificar-contacto.test.tsx` → resultado y límites registrados | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El backend es autoridad sobre canal y verificación; respetar Expo 57 antes de tocar código. | Resultado o contrato falso | Confirmar con código, contrato y prueba antes de editar producto |

## Decisión de diseño

El propietario observado es `apps/consumer-app/src/features/onboarding/canales-de-verificacion.ts`. No se introduce una capa DDD nueva por nombre. Una refactorización futura necesitará mostrar una llamada más clara y la misma semántica en la entrada real, con prueba roja antes de cambiar implementación. Si la comprobación H2 demuestra que el diseño actual ya protege la regla, se registra como DESCARTADO el cambio de código.
