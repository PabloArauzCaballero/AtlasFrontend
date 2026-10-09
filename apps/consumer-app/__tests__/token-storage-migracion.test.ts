/**
 * APP-19: los tokens pasan a claves NUEVAS escritas con `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.
 *
 * En iOS reescribir una clave existente no cambia su accesibilidad, así que hay que copiar a otra y
 * borrar la vieja, sin desloguear a nadie por el camino.
 */
import { CLAVES_VIEJAS, secureTokenStore } from '../src/session/token-storage';

type Entrada = { valor: string; opciones?: { keychainAccessible?: number } };
const mockLlavero = new Map<string, Entrada>();
let mockFallarEscritura = false;

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(async (clave: string) => mockLlavero.get(clave)?.valor ?? null),
  setItemAsync: jest.fn(async (clave: string, valor: string, opciones?: { keychainAccessible?: number }) => {
    if (mockFallarEscritura) throw new Error('mockLlavero bloqueado');
    mockLlavero.set(clave, { valor, opciones });
  }),
  deleteItemAsync: jest.fn(async (clave: string) => {
    mockLlavero.delete(clave);
  }),
}));

beforeEach(() => {
  mockLlavero.clear();
  mockFallarEscritura = false;
});

describe('migración de los tokens a claves nuevas', () => {
  it('quien ya tenía sesión sigue dentro: se copia a las nuevas, con la accesibilidad nueva, y se borran las viejas', async () => {
    mockLlavero.set(CLAVES_VIEJAS.access, { valor: 'a1' });
    mockLlavero.set(CLAVES_VIEJAS.refresh, { valor: 'r1' });

    await expect(secureTokenStore.read()).resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1' });

    expect(mockLlavero.has(CLAVES_VIEJAS.access)).toBe(false);
    expect(mockLlavero.has(CLAVES_VIEJAS.refresh)).toBe(false);
    const nuevas = [...mockLlavero.entries()];
    expect(nuevas.map(([, e]) => e.valor).sort()).toEqual(['a1', 'r1']);
    expect(nuevas.every(([, e]) => e.opciones?.keychainAccessible === 7)).toBe(true);
    // La segunda lectura ya sale de las nuevas.
    await expect(secureTokenStore.read()).resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });

  it('si no se puede copiar, NO se borran las viejas y la sesión sigue', async () => {
    mockLlavero.set(CLAVES_VIEJAS.access, { valor: 'a1' });
    mockLlavero.set(CLAVES_VIEJAS.refresh, { valor: 'r1' });
    mockFallarEscritura = true;

    await expect(secureTokenStore.read()).resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    expect(mockLlavero.get(CLAVES_VIEJAS.refresh)?.valor).toBe('r1');
  });

  it('lecturas simultáneas al arrancar migran una sola vez', async () => {
    mockLlavero.set(CLAVES_VIEJAS.access, { valor: 'a1' });
    mockLlavero.set(CLAVES_VIEJAS.refresh, { valor: 'r1' });
    const SecureStore = jest.requireMock<{ setItemAsync: jest.Mock }>('expo-secure-store');
    SecureStore.setItemAsync.mockClear();

    const lecturas = await Promise.all([secureTokenStore.read(), secureTokenStore.read(), secureTokenStore.read()]);

    expect(lecturas.every((t) => t?.refreshToken === 'r1')).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
  });

  it('escribir usa las claves nuevas con la accesibilidad nueva y limpia las viejas', async () => {
    mockLlavero.set(CLAVES_VIEJAS.refresh, { valor: 'viejo' });
    await secureTokenStore.write({ accessToken: 'a2', refreshToken: 'r2' });
    expect(mockLlavero.has(CLAVES_VIEJAS.refresh)).toBe(false);
    expect([...mockLlavero.values()].every((e) => e.opciones?.keychainAccessible === 7)).toBe(true);
  });

  it('cerrar sesión borra las nuevas y las viejas', async () => {
    await secureTokenStore.write({ accessToken: 'a2', refreshToken: 'r2' });
    mockLlavero.set(CLAVES_VIEJAS.access, { valor: 'a1' });
    await secureTokenStore.clear();
    expect(mockLlavero.size).toBe(0);
    await expect(secureTokenStore.read()).resolves.toBeNull();
  });
});
