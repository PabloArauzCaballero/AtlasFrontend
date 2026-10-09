/**
 * El entorno de las pruebas.
 *
 * La app ya no tiene base de API por defecto (APP-26, `src/api/config.ts`): sin URL, cargar el
 * modulo de configuracion lanza. Las pruebas no hablan con ningun servidor —todas simulan `fetch`—,
 * asi que se les da una base que no resuelve a nada (`.invalid` esta reservado para eso, RFC 2606).
 */
process.env.EXPO_PUBLIC_ATLAS_API_URL = process.env.EXPO_PUBLIC_ATLAS_API_URL || 'https://api.atlas.invalid/api/v1';
