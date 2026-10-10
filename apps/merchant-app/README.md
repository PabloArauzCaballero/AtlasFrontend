# Atlas Comercio — la app del comercio afiliado

App nativa (iPhone y Android, Expo 57) con **lo mismo que el portal del comercio en la web**
(`AtlasERPFrontend/app/portal-comercio`): Gestión POS, Cartera y facturación, Mi empresa, Soporte y
tutoriales, y Mi cuenta. Plan completo: `_plan-app-comercio-2026-10-09/PLAN.md` en la carpeta de Atlas.

## Dos reglas que definen la app

1. **Qué hace = la web.** Las pantallas, pestañas, textos, datos y acciones son los del portal web.
   Los servicios de `src/api/servicios/` son copia de `AtlasERPFrontend/services/` y el cliente
   (`src/api/client.ts`) es un porte de `lib/apiClient.ts`. Si la web cambia, se cambia aquí.
2. **Cómo se ve = la app del cliente.** No hay tokens ni componentes propios: se importan los de su
   hermana con el alias `@cliente/*` (→ `apps/consumer-app/src/*`). Lo propio de esta app vive en
   `src/ui/` y está hecho con esas piezas. `metro.config.js` explica cómo se evita que entren dos React.

## La API y la sesión

- La URL es la del backend del ERP, **siempre por https** (`EXPO_PUBLIC_ATLAS_API_URL`, ver
  `eas.json` y `.env.example`). En TEST: `https://atlas.erp.test.arauzsoftware.com/api/v1`.
- La sesión vive en las cookies httpOnly que pone el gateway del ERP, igual que en la web. El
  `fetch` de Expo las guarda en el almacén nativo y las conserva al cerrar la app (comprobado en el
  simulador de iOS el 2026-10-09). Por eso toda petición pasa por `src/api/client.ts`
  (`credentials: 'include'`).
- Las subidas pasan por `/almacen/subida` del mismo origen y llevan bytes, nunca un Blob.

## Comandos

```sh
npm run start        # Metro; con Expo Go sirve para todo lo que no sea nativo propio
npm run verify       # typecheck + lint + jest
```
