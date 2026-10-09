/**
 * APP-02: en la WEB ningún token toca el almacenamiento del navegador.
 *
 * El token de refresco lo guarda el servidor en una cookie `HttpOnly` (modo cookie, cabecera
 * `x-atlas-session-mode`); el de acceso vive en memoria y, al recargar, se recupera refrescando. Aquí
 * se prueba el lado de la app: qué sale por la red, qué queda en `localStorage` y qué pasa al recargar,
 * al migrar desde el par viejo y al cerrar sesión. Cada «recarga» vuelve a cargar los módulos desde
 * cero con el mismo `localStorage`, como hace el navegador.
 */
type Llamada = { url: string; method: string; headers: Record<string, string>; credentials?: string; body: unknown };

function respuesta(status: number, data: unknown) {
  const body = status < 400 ? { requestId: 'r', data } : { requestId: 'r', error: { code: 'UNAUTHORIZED', message: String(data) } };
  return { ok: status < 400, status, statusText: '', text: async () => JSON.stringify(body) } as unknown as Response;
}

class AlmacenFalso {
  datos = new Map<string, string>();
  getItem(k: string) {
    return this.datos.has(k) ? (this.datos.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.datos.set(k, String(v));
  }
  removeItem(k: string) {
    this.datos.delete(k);
  }
}

const ACCESO = 'eyJ.acceso.web';
const REFRESCO_VIEJO = 'refresco-viejo-de-localstorage-0123456789';

type Modulos = {
  client: typeof import('../src/api/client');
  auth: typeof import('../src/api/endpoints/auth');
  web: typeof import('../src/session/token-storage.web');
};

let fetchFalso: typeof fetch | null = null;

/** Carga la app «desde cero» (una recarga de la página): memoria vacía, `localStorage` el mismo. */
function cargar(onSessionExpired?: () => void): Modulos {
  let modulos!: Modulos;
  jest.isolateModules(() => {
    // `require` y no `import`: cada recarga necesita su propio registro de módulos.
    /* eslint-disable @typescript-eslint/no-require-imports */
    modulos = {
      client: require('../src/api/client'),
      auth: require('../src/api/endpoints/auth'),
      web: require('../src/session/token-storage.web'),
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  modulos.client.configureClient({ tokenStore: modulos.web.secureTokenStore, onSessionExpired });
  // Cargar react-native en un registro nuevo vuelve a instalar su `fetch`: se repone el falso.
  if (fetchFalso) globalThis.fetch = fetchFalso;
  return modulos;
}

describe('sesión web en modo cookie (APP-02)', () => {
  const llamadas: Llamada[] = [];
  const originalFetch = globalThis.fetch;
  let almacen: AlmacenFalso;
  let servidor: (llamada: Llamada) => Response;

  beforeEach(() => {
    llamadas.length = 0;
    almacen = new AlmacenFalso();
    (globalThis as { localStorage?: unknown }).localStorage = almacen;
    servidor = (llamada) => {
      if (llamada.url.endsWith('/auth/login')) return respuesta(200, { accessToken: ACCESO, tokenType: 'Bearer', expiresIn: '15m', sessionMode: 'cookie' });
      if (llamada.url.endsWith('/auth/refresh')) return respuesta(200, { accessToken: `${ACCESO}.renovado`, sessionMode: 'cookie' });
      if (llamada.url.endsWith('/auth/logout')) return respuesta(200, { loggedOut: true });
      return llamada.headers.authorization ? respuesta(200, { ok: true }) : respuesta(401, 'sin token');
    };
    fetchFalso = (async (url: string, init: RequestInit) => {
      const llamada: Llamada = {
        url: String(url),
        method: String(init.method),
        headers: (init.headers ?? {}) as Record<string, string>,
        credentials: init.credentials,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      };
      llamadas.push(llamada);
      return servidor(llamada);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchFalso;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchFalso = null;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  const todoElAlmacen = () => [...almacen.datos.entries()].map(([k, v]) => `${k}=${v}`).join('\n');

  it('login: pide el modo cookie con credenciales y no deja ningún token en localStorage', async () => {
    const { auth, web } = cargar();
    const tokens = await auth.login('pablo@example.com', '4821');
    expect(tokens.refreshToken).toBeUndefined();

    const [login] = llamadas;
    expect(login?.headers['x-atlas-session-mode']).toBe('cookie');
    expect(login?.credentials).toBe('include');

    await web.secureTokenStore.write({ accessToken: tokens.accessToken, refreshToken: 'cookie:1' });
    await web.profileStorage.write({ customerId: '53', displayName: 'Pablo', identifier: 'pablo@example.com' });
    expect(todoElAlmacen()).not.toContain(ACCESO);
    expect(todoElAlmacen()).not.toContain('pablo@example.com');
    expect(todoElAlmacen()).not.toContain('Pablo');
    // Sólo la pista «puede haber sesión» y el identificador interno del cliente.
    expect([...almacen.datos.keys()].sort()).toEqual([web.CLAVE_CLIENTE, web.CLAVE_PISTA].sort());
  });

  it('al recargar recupera la sesión refrescando con la cookie (cuerpo vacío) antes de la primera llamada', async () => {
    const primera = cargar();
    await primera.web.secureTokenStore.write({ accessToken: ACCESO, refreshToken: 'cookie:1' });

    const { client } = cargar(); // recarga: la memoria se pierde
    await expect(client.request('/customers/53/me')).resolves.toEqual({ ok: true });

    expect(llamadas.map((l) => l.url.replace(/^.*\/api\/v1/, ''))).toEqual(['/auth/refresh', '/customers/53/me']);
    const [refresco, llamada] = llamadas;
    expect(refresco?.body).toEqual({});
    expect(refresco?.headers['x-atlas-session-mode']).toBe('cookie');
    expect(refresco?.credentials).toBe('include');
    expect(llamada?.headers.authorization).toBe(`Bearer ${ACCESO}.renovado`);
    // La llamada normal no lleva ni la cabecera de modo ni credenciales: la cookie no tiene nada que hacer ahí.
    expect(llamada?.headers['x-atlas-session-mode']).toBeUndefined();
    expect(llamada?.credentials).toBeUndefined();
  });

  it('varias llamadas a la vez tras recargar comparten UN solo refresco', async () => {
    cargar().web.secureTokenStore.write({ accessToken: ACCESO, refreshToken: 'cookie:1' });
    const { client } = cargar();
    await Promise.all([client.request('/a'), client.request('/b'), client.request('/c')]);
    expect(llamadas.filter((l) => l.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('quien no ha entrado no dispara ningún refresco al cargar', async () => {
    const { web } = cargar();
    await expect(web.secureTokenStore.read()).resolves.toBeNull();
    expect(llamadas).toHaveLength(0);
  });

  it('migración: el par viejo de localStorage se canjea UNA vez por la cookie y se borra (también el perfil con PII)', async () => {
    almacen.setItem('atlas.session.access', 'acceso-viejo');
    almacen.setItem('atlas.session.refresh', REFRESCO_VIEJO);
    almacen.setItem('atlas.session.profile', JSON.stringify({ customerId: '53', displayName: 'Pablo', identifier: 'pablo@example.com' }));

    const { client, web } = cargar();
    await expect(web.profileStorage.read()).resolves.toEqual({ customerId: '53', displayName: null, identifier: '' });
    await client.request('/customers/53/me');

    const [refresco, llamada] = llamadas;
    expect(refresco?.url).toMatch(/\/auth\/refresh$/);
    expect(refresco?.body).toEqual({ refreshToken: REFRESCO_VIEJO });
    expect(refresco?.headers['x-atlas-session-mode']).toBe('cookie');
    // El token de acceso viejo no se reutiliza.
    expect(llamada?.headers.authorization).toBe(`Bearer ${ACCESO}.renovado`);
    expect(todoElAlmacen()).not.toMatch(/acceso-viejo|refresco-viejo|pablo@example\.com|Pablo/);
    expect(almacen.getItem(web.CLAVE_PISTA)).toBe('1');

    // Y la siguiente recarga ya va por la cookie.
    llamadas.length = 0;
    await cargar().client.request('/x');
    expect(llamadas[0]?.body).toEqual({});
  });

  it('si el servidor rechaza la cookie, la sesión se cierra y la pista se borra', async () => {
    cargar().web.secureTokenStore.write({ accessToken: ACCESO, refreshToken: 'cookie:1' });
    servidor = () => respuesta(401, 'cookie vencida');
    const expirada = jest.fn();
    const { client, web } = cargar(expirada);

    await expect(client.request('/customers/53/me')).rejects.toMatchObject({ kind: 'auth' });
    expect(expirada).toHaveBeenCalledTimes(1);
    expect(almacen.getItem(web.CLAVE_PISTA)).toBeNull();
    await expect(web.secureTokenStore.read()).resolves.toBeNull();
  });

  it('el refresco de un 401 a media sesión también va por la cookie', async () => {
    const { client, web } = cargar();
    await web.secureTokenStore.write({ accessToken: 'vencido', refreshToken: 'cookie:1' });
    let primera = true;
    servidor = (l) => {
      if (l.url.endsWith('/auth/refresh')) return respuesta(200, { accessToken: 'nuevo' });
      if (primera) {
        primera = false;
        return respuesta(401, 'vencido');
      }
      return respuesta(200, { ok: true });
    };
    await client.request('/x');
    const refresco = llamadas.find((l) => l.url.endsWith('/auth/refresh'));
    expect(refresco?.body).toEqual({});
    expect(llamadas.at(-1)?.headers.authorization).toBe('Bearer nuevo');
    await expect(web.secureTokenStore.read()).resolves.toMatchObject({ accessToken: 'nuevo' });
    expect(todoElAlmacen()).not.toContain('nuevo');
  });

  it('logout: sin token en el cuerpo, con la cabecera de modo y credenciales (el servidor borra la cookie)', async () => {
    const { auth } = cargar();
    await auth.logout(null);
    const [salida] = llamadas;
    expect(salida?.body).toEqual({ allDevices: false });
    expect(salida?.headers['x-atlas-session-mode']).toBe('cookie');
    expect(salida?.credentials).toBe('include');
  });

  it('clear borra la memoria, la pista y el identificador del cliente', async () => {
    const { web } = cargar();
    await web.secureTokenStore.write({ accessToken: ACCESO, refreshToken: 'cookie:1' });
    await web.profileStorage.write({ customerId: '53', displayName: null, identifier: 'x' });
    await web.secureTokenStore.clear();
    await web.profileStorage.clear();
    expect(almacen.datos.size).toBe(0);
    await expect(web.secureTokenStore.read()).resolves.toBeNull();
    await expect(web.profileStorage.read()).resolves.toBeNull();
  });

  it('sin localStorage (ventana privada que lo bloquea) la sesión funciona en memoria', async () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    const { web } = cargar();
    await web.secureTokenStore.write({ accessToken: ACCESO, refreshToken: 'cookie:1' });
    await expect(web.secureTokenStore.read()).resolves.toEqual({ accessToken: ACCESO, refreshToken: 'cookie:1' });
  });
});
