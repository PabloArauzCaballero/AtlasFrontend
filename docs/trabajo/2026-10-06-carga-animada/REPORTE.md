# Reporte — La espera se ve: barra de carga y animación de marca

> **AVANCE: 5 / 6 — 83,3 %.** L1–L5 hechas y verificadas en el export web; falta L6 (PR, CI, merge a `dev` y promoción a `test`), en curso en este turno.

- Fecha: 2026-10-06 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/plan-credito-calificacion-mobile-b95b6f` (AtlasFrontend)
- Peldaño: `VERIFIED` en el export web (3 anchos, animado y con movimiento reducido); no se probó en un teléfono físico.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| L1 | `src/ui/cargador-atlas.tsx`: «A» de la marca que respira, anillo de luz con degradado y punto-satélite que gira, arco interior en sentido contrario y barra de carga indeterminada; 3 tamaños; movimiento reducido = quieto | `jest cargador-atlas` | PASS 6/6 |
| L2 | `Cargando` usa la marca animada (misma API; 6 llamadores sin tocar) | `jest` | PASS 896/896 |
| L3 | `Skeleton` con un brillo que lo recorre; `SkeletonLista` anuncia «Cargando…» con la marca (grande en cargas de pantalla completa: Inicio, Tu nivel Atlas, Compras, Mis datos) | `jest` + capturas | PASS; revisadas |
| L4 | Subida de fotos con el anillo y la barra de marca | `jest` | PASS |
| L5 | Capturas de la espera real (respuestas retenidas en el navegador) en móvil 3x, tablet 2x y escritorio, y con movimiento reducido | `evidencia/L-*.png` + diferencia entre dos fotogramas | Animado: 13.492 px cambian (móvil), 6.114 (tablet), 1.655 (escritorio). Movimiento reducido: **0** px. Consola sin errores. |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| L6 | EN CURSO | PR, CI verde, merge a `dev`, promoción a `test` |

## Evidencia
```text
consumer-app $ npx tsc --noEmit → 0 errores · npx eslint . → 0 errores (14 avisos, igual que antes) · npx jest → 896 passed
```

## No cubierto
- Teléfono físico (iOS/Android): la animación se verificó en el export web, no en el dispositivo.
- El spinner DENTRO de los botones sigue siendo el del sistema (fuera de alcance: un logotipo no cabe en el alto del texto del botón).

## Desvíos del plan
- Las cargas de pantalla completa usan la marca grande (prop `pantalla` de `SkeletonLista`): la única espera «grande» que existía (pago) se resuelve casi al instante y no se habría visto nunca.
- La geometría de la «A» pasó a `src/ui/marca-letra.tsx` (re-exportada desde `brand.tsx`) para no crear un import circular `primitives → cargador → brand → primitives`.

## Riesgos residuales
- Las animaciones en bucle corren mientras dura la espera; se cancelan al desmontar. En teléfonos de gama baja conviene mirar la fluidez en un dispositivo real.

## Decisiones y ambigüedades
- «Barra de carga» sin porcentaje real → barra INDETERMINADA (un tramo de luz que la recorre): inventar un porcentaje mentiría sobre el avance. Confirmar con Pablo.
