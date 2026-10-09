/** Las pruebas no hablan con ningún servidor: todas simulan `fetch`. `.invalid` no resuelve (RFC 2606). */
process.env.EXPO_PUBLIC_ATLAS_API_URL = process.env.EXPO_PUBLIC_ATLAS_API_URL || 'https://api.atlas.invalid/api/v1';
