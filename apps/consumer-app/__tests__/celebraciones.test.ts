import type { Badge, Progress } from '../src/api/endpoints/credit-line';
import { esRutaTranquila, instantanea, MAXIMO_POR_VEZ, pendientesDeCelebrar, rangoDeNivel } from '../src/features/celebraciones';
import { PROGRESO_DE_PRUEBA } from './progreso-datos';

const insignia = (code: string, extra: Partial<Badge> = {}): Badge => ({
  code,
  label: code,
  detail: '',
  icon: 'estrella',
  earned: false,
  current: 0,
  target: 1,
  rank: 'bronce',
  category: 'pagos',
  secret: false,
  ...extra,
});

const con = (badges: Badge[], xp = 0): Progress =>
  ({ ...PROGRESO_DE_PRUEBA, level: undefined, nextLevel: undefined, levelLadder: undefined, points: undefined, experience: { ...PROGRESO_DE_PRUEBA.experience, xp, badges } }) as Progress;

describe('pendientesDeCelebrar', () => {
  it('la primera vez en el teléfono no celebra el pasado: sólo lo anota', () => {
    const p = con([insignia('a', { earned: true }), insignia('b', { earned: true }), insignia('c')], 700);
    const r = pendientesDeCelebrar(p, null);
    expect(r.logros).toEqual([]);
    expect(r.siguiente.insignias).toEqual(['a', 'b']);
    expect(r.siguiente.nivel).toBe('EN_CONSTRUCCION');
  });

  it('celebra sólo lo ganado desde la última vez', () => {
    const p = con([insignia('a', { earned: true }), insignia('b', { earned: true })]);
    const r = pendientesDeCelebrar(p, { insignias: ['a'], nivel: 'NUEVO' });
    expect(r.logros.map((l) => (l.tipo === 'insignia' ? l.insignia.code : 'nivel'))).toEqual(['b']);
  });

  it('sin novedades no hay nada que celebrar', () => {
    const p = con([insignia('a', { earned: true })]);
    expect(pendientesDeCelebrar(p, instantanea(p)).logros).toEqual([]);
  });

  it('de menor a mayor rango, y el cambio de nivel va al final como clímax', () => {
    const p = con(
      [insignia('oro', { earned: true, rank: 'oro' }), insignia('bronce', { earned: true }), insignia('plata', { earned: true, rank: 'plata' })],
      600,
    );
    const r = pendientesDeCelebrar(p, { insignias: [], nivel: 'NUEVO' });
    expect(r.logros.map((l) => (l.tipo === 'insignia' ? l.insignia.code : 'nivel'))).toEqual(['bronce', 'plata', 'oro', 'nivel']);
  });

  it('no pasa de cuatro por vez y se queda con las más grandes; el resto se anota', () => {
    const rangos = ['bronce', 'bronce', 'plata', 'oro', 'platino', 'diamante'] as const;
    const p = con(rangos.map((rank, i) => insignia(`i${i}`, { earned: true, rank })));
    const r = pendientesDeCelebrar(p, { insignias: [], nivel: 'NUEVO' });
    expect(r.logros).toHaveLength(MAXIMO_POR_VEZ);
    expect(r.masSinMostrar).toBe(2);
    expect(r.logros.map((l) => l.rango)).toEqual(['plata', 'oro', 'platino', 'diamante']);
    // Lo que no se mostró también queda como visto: no vuelve a salir mañana.
    expect(r.siguiente.insignias).toHaveLength(6);
  });

  it('un nivel que sube cuenta como uno de los cuatro', () => {
    const p = con(Array.from({ length: 6 }, (_, i) => insignia(`i${i}`, { earned: true })), 5_200);
    const r = pendientesDeCelebrar(p, { insignias: [], nivel: 'ESTABLECIDO' });
    expect(r.logros).toHaveLength(MAXIMO_POR_VEZ);
    expect(r.logros.at(-1)).toMatchObject({ tipo: 'nivel', nivel: { id: 'CONSOLIDADO', index: 7 } });
  });

  it('subir varios niveles de golpe es UNA celebración, la del nivel al que se llegó', () => {
    const r = pendientesDeCelebrar(con([], 5_200), { insignias: [], nivel: 'NUEVO' });
    expect(r.logros).toHaveLength(1);
    expect(r.logros[0]).toMatchObject({ tipo: 'nivel', nivel: { id: 'CONSOLIDADO' } });
  });

  it('un nivel guardado que la app no reconoce no se celebra', () => {
    expect(pendientesDeCelebrar(con([], 5_200), { insignias: [], nivel: 'NIVEL_DEL_FUTURO' }).logros).toEqual([]);
  });

  it('no baja de nivel ni celebra al retroceder', () => {
    expect(pendientesDeCelebrar(con([], 0), { insignias: [], nivel: 'CONSOLIDADO' }).logros).toEqual([]);
  });

  it('la celebración trae la colección y lo siguiente más cercano, sin delatar secretas', () => {
    const p = con([
      insignia('r3', { earned: true, category: 'rachas', rank: 'plata' }),
      insignia('r6', { category: 'rachas', rank: 'oro', current: 3, target: 6 }),
      insignia('r12', { category: 'rachas', rank: 'platino', current: 3, target: 12 }),
      insignia('rs', { category: 'rachas', secret: true, current: 5, target: 6 }),
    ]);
    const [logro] = pendientesDeCelebrar(p, { insignias: [], nivel: 'NUEVO' }).logros;
    expect(logro).toMatchObject({ tipo: 'insignia', coleccion: { ganadas: 1, total: 4 }, siguiente: { code: 'r6' } });
  });

  it('un backend anterior (sin rank ni category) también se celebra, con el rango por código', () => {
    const vieja = { code: 'racha_6', label: 'Racha de 6', detail: '', icon: 'tendencia', earned: true, current: 6, target: 6 } as Badge;
    const [logro] = pendientesDeCelebrar(con([vieja]), { insignias: [], nivel: 'NUEVO' }).logros;
    expect(logro).toMatchObject({ rango: 'oro', coleccion: null, siguiente: null });
  });
});

describe('rangoDeNivel', () => {
  it.each([
    [1, 'bronce'],
    [4, 'plata'],
    [7, 'oro'],
    [9, 'platino'],
    [12, 'diamante'],
  ])('nivel %i → %s', (n, r) => expect(rangoDeNivel(n)).toBe(r));
});

describe('esRutaTranquila', () => {
  it.each(['/', '/pagos', '/perfil', '/progreso', '/avisos'])('%s es tranquila', (r) => expect(esRutaTranquila(r)).toBe(true));
  it.each(['/pagar/12', '/pago/9', '/compra/monto', '/soporte/3', '/escanear'])('%s es una tarea: no se celebra encima', (r) => expect(esRutaTranquila(r)).toBe(false));
});
