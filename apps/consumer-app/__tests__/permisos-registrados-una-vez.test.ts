/**
 * Una decision de permisos se manda como consentimiento UNA vez por cliente. Las señales se activan
 * al abrir sesion, al restaurarla y al volver de la pantalla de permisos; sin esta memoria cada
 * activacion escribia otra fila igual (tres por cliente en DEV el 2026-09-18).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decisionYaRegistrada, marcarDecisionRegistrada } from '../src/session/permisos-de-arranque';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('registro unico de la decision de permisos', () => {
  beforeEach(async () => AsyncStorage.clear());

  it('no esta registrada hasta que se marca, y solo para ese cliente y esa fecha', async () => {
    expect(await decisionYaRegistrada('7', '2026-09-18T01:00:00.000Z')).toBe(false);
    await marcarDecisionRegistrada('7', '2026-09-18T01:00:00.000Z');
    expect(await decisionYaRegistrada('7', '2026-09-18T01:00:00.000Z')).toBe(true);
    // Otra decision (otra fecha) u otro cliente se registran de nuevo.
    expect(await decisionYaRegistrada('7', '2026-09-18T02:00:00.000Z')).toBe(false);
    expect(await decisionYaRegistrada('8', '2026-09-18T01:00:00.000Z')).toBe(false);
  });
});
