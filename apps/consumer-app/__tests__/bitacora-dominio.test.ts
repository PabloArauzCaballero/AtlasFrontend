/**
 * La bitacora del alta, sin React ni red: reloj, deteccion, cola, traduccion y lista blanca.
 *
 * Lo que fijan estas pruebas es lo que separa una bitacora defendible de una que espía:
 *   1. nunca viaja el TEXTO de un campo, solo cuentas y tiempos;
 *   2. el cronometro no salta con la hora del sistema;
 *   3. lo que el servidor rechaza no se pierde en silencio: se repone o queda anotado el hueco;
 *   4. ningun codigo de la lista blanca contiene las palabras que el servidor prohibe.
 */
import type { TelemetryBatch } from '../src/api/endpoints/telemetry';
import { bitacora, esCampo, esControl, pantallaDeRuta, TAMANO_DE_LOTE } from '../src/features/bitacora/bitacora';
import { Cola, type Almacen, TOPE_DE_COLA } from '../src/features/bitacora/cola';
import { abrirSesionDeCampo, anotarCambio, clasificarCambio, posicionRelativa } from '../src/features/bitacora/deteccion';
import { Reloj } from '../src/features/bitacora/reloj';
import { traducir } from '../src/features/bitacora/traduccion';
import { CAMPOS, CONTROLES, normalizarComoElServidor, PALABRAS_PROHIBIDAS, PANTALLAS } from '../src/features/bitacora/tipos';

function almacenEnMemoria(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    leer: async (clave) => datos.get(clave) ?? null,
    escribir: async (clave, valor) => {
      datos.set(clave, valor);
    },
    borrar: async (clave) => {
      datos.delete(clave);
    },
  };
}

function relojFalso(inicio = 1_000_000) {
  let monotonico = inicio;
  let epoch = Date.UTC(2026, 8, 18, 3, 0, 0);
  return {
    fuentes: { ahoraMonotonico: () => monotonico, ahoraEpoch: () => epoch },
    avanzar(ms: number) {
      monotonico += ms;
      epoch += ms;
    },
    saltarHoraDelSistema(ms: number) {
      epoch += ms;
    },
  };
}

describe('la lista blanca', () => {
  it.each(PALABRAS_PROHIBIDAS)('ningun codigo contiene «%s» tras normalizar como el servidor', (palabra) => {
    const todos = [...PANTALLAS, ...CONTROLES, ...CAMPOS, 'tap', 'flujo', 'captura_carnet_frente', 'permiso_contactos'];
    for (const codigo of todos) {
      expect(normalizarComoElServidor(codigo)).not.toContain(palabra);
    }
  });

  it('reconoce pantalla, control y campo solo si estan en la lista', () => {
    expect(pantallaDeRuta('/(onboarding)/registro')).toBe('registro');
    expect(pantallaDeRuta('/registro')).toBe('registro');
    expect(pantallaDeRuta('/comercio/123')).toBeNull();
    expect(pantallaDeRuta(null)).toBeNull();
    expect(esControl('continuar')).toBe(true);
    expect(esControl('boton_del_comercio')).toBe(false);
    expect(esCampo('telefono')).toBe(true);
    expect(esCampo('nombre_del_perro')).toBe(false);
  });
});

describe('el reloj', () => {
  it('mide con el monotonico y no se inmuta si la hora del sistema salta', () => {
    const f = relojFalso();
    const reloj = new Reloj(f.fuentes);
    reloj.iniciar();
    f.avanzar(3000);
    expect(reloj.ahora()).toBe(3000);
    f.saltarHoraDelSistema(-600_000);
    f.avanzar(1000);
    expect(reloj.ahora()).toBe(4000);
    // La marca real sale del ancla + monotonico, no de la hora actual del sistema.
    expect(reloj.marcaDe(4000)).toBe('2026-09-18T03:00:04.000Z');
  });

  it('no reinicia al volver a iniciar y retoma una linea de tiempo guardada', () => {
    const f = relojFalso();
    const reloj = new Reloj(f.fuentes);
    reloj.iniciar();
    f.avanzar(500);
    reloj.iniciar();
    expect(reloj.ahora()).toBe(500);
    const otro = new Reloj(f.fuentes);
    otro.retomar(reloj.ancla!, 500);
    f.avanzar(250);
    expect(otro.ahora()).toBe(750);
    expect(otro.marcaDe(750)).toBe(reloj.marcaDe(750));
  });

  it('antes de arrancar vale cero', () => {
    expect(new Reloj(relojFalso().fuentes).ahora()).toBe(0);
  });
});

describe('la deteccion', () => {
  it.each([
    ['telefono', 0, 1, 'tecleo'],
    ['telefono', 3, 6, 'tecleo'],
    ['telefono', 0, 4, 'pegado'],
    ['nombres', 2, 14, 'pegado'],
    ['nombres', 5, 4, 'correccion'],
    ['nombres', 5, 5, 'sin_cambio'],
    ['codigo_verificacion', 0, 6, 'tecleo'],
    ['pin', 0, 4, 'tecleo'],
  ] as const)('%s de %i a %i caracteres es %s', (campo, antes, despues, esperado) => {
    expect(clasificarCambio(campo, antes, despues)).toBe(esperado);
  });

  it('acumula cambios, correcciones y pegados por sesion de campo', () => {
    const sesion = abrirSesionDeCampo('apellidos', 100, 0);
    expect(anotarCambio(sesion, 1)).toBe('tecleo');
    expect(anotarCambio(sesion, 2)).toBe('tecleo');
    expect(anotarCambio(sesion, 1)).toBe('correccion');
    expect(anotarCambio(sesion, 9)).toBe('pegado');
    expect(anotarCambio(sesion, 9)).toBe('sin_cambio');
    expect(sesion).toMatchObject({ cambios: 4, correcciones: 1, pegados: 1, longitud: 9 });
  });

  it('acota la posicion relativa a [0, 1] y no divide por cero', () => {
    expect(posicionRelativa(10, 5, 100, 50)).toEqual({ rx: 0.1, ry: 0.1 });
    expect(posicionRelativa(-3, 80, 100, 50)).toEqual({ rx: 0, ry: 1 });
    expect(posicionRelativa(10, 10, 0, 0)).toEqual({ rx: 0, ry: 0 });
    expect(posicionRelativa(Number.NaN, 10, 100, 100)).toEqual({ rx: 0, ry: 0.1 });
  });
});

describe('la cola', () => {
  it('persiste, recorta por tope y anota cuantos descarto', async () => {
    const almacen = almacenEnMemoria();
    const cola = new Cola(almacen, 3);
    await cola.cargar();
    cola.encolar({ tipo: 'flujo', accion: 'inicio', t: 0 });
    cola.encolar({ tipo: 'pantalla', accion: 'entra', pantalla: 'registro', t: 1 });
    cola.encolar({ tipo: 'pantalla', accion: 'sale', pantalla: 'registro', t: 2 });
    expect(cola.encolar({ tipo: 'flujo', accion: 'segundo_plano', t: 3 })).toEqual({ recortados: 1 });
    expect(cola.tamano).toBe(3);
    await cola.sincronizar();

    const otra = new Cola(almacen, 3);
    const cargado = await otra.cargar();
    expect(cargado.eventos).toBe(3);
    expect(otra.tomar(10).map((e) => e.evento.t)).toEqual([1, 2, 3]);
  });

  it('un tramo en vuelo no se vuelve a tomar hasta que se reponga, y confirmar lo borra', async () => {
    const cola = new Cola(almacenEnMemoria());
    await cola.cargar();
    for (let i = 0; i < 5; i += 1) cola.encolar({ tipo: 'flujo', accion: 'primer_plano', t: i });
    const primero = cola.tomar(2);
    expect(primero.map((e) => e.evento.t)).toEqual([0, 1]);
    expect(cola.tomar(2).map((e) => e.evento.t)).toEqual([2, 3]);
    cola.reponer(primero.map((e) => e.id));
    expect(cola.tomar(10).map((e) => e.evento.t)).toEqual([0, 1, 4]);
    cola.confirmar(primero.map((e) => e.id));
    expect(cola.tamano).toBe(3);
    expect(cola.pendientes).toBe(0);
  });

  it('un disco corrupto arranca vacio en vez de romper', async () => {
    const almacen = almacenEnMemoria();
    almacen.datos.set('atlas.bitacora.v1', '{no es json');
    const cola = new Cola(almacen);
    await expect(cola.cargar()).resolves.toMatchObject({ eventos: 0 });
  });

  it('el tope por defecto es 2000', () => {
    expect(TOPE_DE_COLA).toBe(2000);
  });
});

describe('la traduccion', () => {
  const f = relojFalso();
  const reloj = new Reloj(f.fuentes);
  reloj.iniciar();

  it('cada evento cae en un tipo del servidor y nunca lleva texto tecleado', () => {
    const campo = traducir({ tipo: 'campo', pantalla: 'registro', campo: 'telefono', accion: 'desenfoque', duracionMs: 1200, correcciones: 2, t: 5000 }, reloj);
    expect(campo).toMatchObject({
      eventType: 'form_field_interaction',
      eventCode: 'telefono',
      occurredAt: '2026-09-18T03:00:05.000Z',
      metadata: { interactionType: 'desenfoque', durationMs: 1200, corrections: 2, usedCopyPaste: false, screenName: 'registro' },
    });
    expect(JSON.stringify(campo)).not.toMatch(/value|text|valor/);

    expect(traducir({ tipo: 'campo', pantalla: 'identidad', campo: 'documento_numero', accion: 'pegado', t: 1 }, reloj).metadata).toMatchObject({ usedCopyPaste: true });
    expect(traducir({ tipo: 'toque', pantalla: 'registro', control: 'crear_cuenta', rx: 0.5, ry: 0.4, sx: 0.5, sy: 0.9, viewport: [390, 844], t: 10 }, reloj)).toMatchObject({
      eventType: 'customer_action',
      eventCode: 'tap',
      metadata: { screenName: 'registro', control: 'crear_cuenta', rx: 0.5, ry: 0.4 },
    });
    expect(traducir({ tipo: 'pantalla', accion: 'atras', pantalla: 'perfil', t: 10, desdeEntradaMs: 700 }, reloj)).toMatchObject({
      eventType: 'onboarding_step_event',
      eventCode: 'perfil',
      metadata: { eventType: 'back', sinceEnterMs: 700 },
    });
    expect(traducir({ tipo: 'captura', que: 'selfie', accion: 'segundo_plano', t: 10 }, reloj)).toMatchObject({ eventCode: 'captura_selfie', metadata: { eventType: 'segundo_plano' } });
    expect(traducir({ tipo: 'permiso', permiso: 'contactos', decision: 'denegado', t: 10 }, reloj)).toMatchObject({
      eventType: 'onboarding_step_event',
      eventCode: 'permiso_contactos',
      metadata: { eventType: 'permission_denegado' },
    });
    expect(traducir({ tipo: 'envio', pantalla: 'registro', resultado: 'error', codigo: 'VALIDATION_ERROR', latenciaMs: 300, t: 10 }, reloj).metadata).toMatchObject({ eventType: 'submit_error', code: 'VALIDATION_ERROR', latencyMs: 300 });
    expect(traducir({ tipo: 'validacion', pantalla: 'registro', campo: 'correo', codigo: 'correo_invalido', t: 10 }, reloj).metadata).toMatchObject({ eventType: 'validation_error', field: 'correo' });
    expect(traducir({ tipo: 'flujo', accion: 'cola_recortada', t: 10, detalle: '7' }, reloj)).toMatchObject({ eventCode: 'flujo', metadata: { eventType: 'cola_recortada', detail: '7' } });
  });
});

describe('la fachada', () => {
  function montar(opciones: { fallar?: (n: number) => Error | null } = {}) {
    const lotes: TelemetryBatch[] = [];
    let n = 0;
    const f = relojFalso();
    const almacen = almacenEnMemoria();
    bitacora.configurar({
      almacen,
      reloj: f.fuentes,
      umbralDeVaciado: 5,
      intervaloDeVaciadoMs: 0,
      transporte: async (_customerId, lote) => {
        n += 1;
        const error = opciones.fallar?.(n);
        if (error) throw error;
        lotes.push(lote);
        return { accepted: lote.events?.length ?? 0 };
      },
    });
    return { lotes, f, almacen };
  }

  it('sin sesion encola y no toca la red; con sesion vacia en lotes de 100 con ventana correcta', async () => {
    const { lotes, f } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('registro');
    for (let i = 0; i < 230; i += 1) {
      f.avanzar(10);
      bitacora.toque('continuar', { x: 5, y: 5, ancho: 10, alto: 10, pageX: 100, pageY: 700, viewport: [390, 844] });
    }
    expect(lotes).toHaveLength(0);

    bitacora.adjuntarSesion({ customerId: '7', sessionId: '9', deviceId: '3' });
    await bitacora.vaciar();
    // 1 inicio + 1 entra + 230 toques = 232 → 100 + 100 + 32
    expect(lotes.map((l) => l.events?.length)).toEqual([100, 100, 32]);
    for (const lote of lotes) {
      expect(lote.sessionId).toBe('9');
      expect(lote.deviceId).toBe('3');
      const marcas = lote.events!.map((e) => e.occurredAt);
      expect(lote.capturedFrom).toBe([...marcas].sort()[0]);
      expect(lote.capturedUntil).toBe([...marcas].sort().at(-1));
    }
    expect(lotes[0]!.events![0]).toMatchObject({ eventCode: 'flujo', metadata: { eventType: 'inicio' } });
  });

  it('un 5xx repone el tramo y se reintenta en el siguiente vaciado; un 422 lo descarta y anota el hueco', async () => {
    const { lotes } = montar({
      fallar: (n) => (n === 1 ? Object.assign(new Error('caido'), { status: 503 }) : n === 3 ? Object.assign(new Error('mal'), { status: 422, code: 'RAW_CONTACTS_NOT_ALLOWED' }) : null),
    });
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('registro');
    bitacora.adjuntarSesion({ customerId: '7', sessionId: '9', deviceId: '3' });
    await bitacora.vaciar(); // n=1 falla con 503
    expect(lotes).toHaveLength(0);
    await bitacora.vaciar(); // n=2 acepta los mismos eventos
    expect(lotes).toHaveLength(1);
    expect(lotes[0]!.events!.map((e) => e.eventCode)).toEqual(['flujo', 'registro']);

    bitacora.focoEnCampo('telefono', 0);
    await bitacora.vaciar(); // n=3 → 422: se descarta y queda `lote_rechazado`
    expect(lotes).toHaveLength(1);
    await bitacora.vaciar(); // n=4 manda el hueco
    expect(lotes[1]!.events!.map((e) => [e.eventCode, e.metadata?.eventType])).toEqual([['flujo', 'lote_rechazado']]);
    expect(lotes[1]!.events![0]!.metadata).toMatchObject({ detail: 'RAW_CONTACTS_NOT_ALLOWED' });
  });

  it('mide el tiempo por campo, cuenta correcciones, detecta pegado y no anota tecleo normal', async () => {
    const { lotes, f } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('identidad');
    bitacora.focoEnCampo('documento_numero', 0);
    f.avanzar(400);
    bitacora.cambioEnCampo('documento_numero', 1);
    bitacora.cambioEnCampo('documento_numero', 2);
    bitacora.cambioEnCampo('documento_numero', 1);
    bitacora.cambioEnCampo('documento_numero', 8);
    f.avanzar(600);
    bitacora.desenfoqueDeCampo('documento_numero');
    bitacora.adjuntarSesion({ customerId: '7', sessionId: '9', deviceId: '3' });
    await bitacora.vaciar();
    const campos = lotes[0]!.events!.filter((e) => e.eventType === 'form_field_interaction').map((e) => e.metadata?.interactionType);
    expect(campos).toEqual(['foco', 'correccion', 'pegado', 'desenfoque']);
    const desenfoque = lotes[0]!.events!.find((e) => e.metadata?.interactionType === 'desenfoque')!;
    expect(desenfoque.metadata).toMatchObject({ durationMs: 1000, corrections: 1 });
  });

  it('el PIN y el codigo nunca producen pegado ni cambio', async () => {
    const { lotes } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('registro');
    bitacora.focoEnCampo('pin', 0);
    bitacora.cambioEnCampo('pin', 4);
    bitacora.campoCompleto('pin');
    bitacora.adjuntarSesion({ customerId: '7', sessionId: '9', deviceId: '3' });
    await bitacora.vaciar();
    expect(lotes[0]!.events!.filter((e) => e.eventCode === 'pin').map((e) => e.metadata?.interactionType)).toEqual(['foco', 'completo']);
  });

  it('salir de una pantalla anota cuanto se estuvo, y el segundo plano durante una captura queda marcado', async () => {
    const { lotes, f } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('identidad');
    bitacora.captura('carnet_frente', 'abre');
    f.avanzar(2500);
    bitacora.segundoPlano();
    bitacora.primerPlano();
    bitacora.captura('carnet_frente', 'toma');
    bitacora.entraEnPantalla('perfil'); // implica salir de identidad
    bitacora.adjuntarSesion({ customerId: '7', sessionId: '9', deviceId: '3' });
    await bitacora.vaciar();
    const codigos = lotes[0]!.events!.map((e) => `${e.eventCode}:${String(e.metadata?.eventType ?? e.eventCode)}`);
    expect(codigos).toEqual([
      'flujo:inicio',
      'identidad:enter',
      'captura_carnet_frente:abre',
      'captura_carnet_frente:segundo_plano',
      'flujo:segundo_plano',
      'flujo:primer_plano',
      'captura_carnet_frente:toma',
      'identidad:leave',
      'perfil:enter',
    ]);
    const salida = lotes[0]!.events!.find((e) => e.metadata?.eventType === 'leave')!;
    expect(salida.metadata).toMatchObject({ sinceEnterMs: 2500 });
  });

  it('retoma la linea de tiempo guardada si la app se cerro a mitad del alta', async () => {
    const { f, almacen } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('registro');
    f.avanzar(5000);
    bitacora.focoEnCampo('correo', 0);
    await bitacora._sincronizar();
    const anclaOriginal = almacen.datos.get('atlas.bitacora.v1');
    expect(anclaOriginal).toContain('"anclaEpoch"');

    // «Nueva instancia» de la app: misma persistencia, reloj nuevo.
    const lotes: TelemetryBatch[] = [];
    bitacora.configurar({ almacen, reloj: f.fuentes, intervaloDeVaciadoMs: 0, transporte: async (_c, lote) => void lotes.push(lote) });
    f.avanzar(1000);
    await bitacora.arrancar('reanudado');
    bitacora.adjuntarSesion({ customerId: '7', sessionId: '9', deviceId: '3' });
    await bitacora.vaciar();
    const eventos = lotes[0]!.events!;
    expect(eventos.map((e) => String(e.metadata?.eventType ?? e.metadata?.interactionType))).toEqual(['inicio', 'enter', 'foco', 'reanudado']);
    // El reanudado va DESPUES del foco en la misma linea de tiempo, no en otra.
    expect(eventos[3]!.occurredAt > eventos[2]!.occurredAt).toBe(true);
    // 5 s medidos antes de cerrar + 1 s con la app cerrada: el hueco cuenta, y `reanudado` lo delata.
    expect(eventos[3]!.metadata).toMatchObject({ elapsedMs: 6000 });
  });

  it('cerrar vacia lo pendiente, borra el disco y deja la bitacora inactiva', async () => {
    const { lotes, almacen } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('revision');
    bitacora.adjuntarSesion({ customerId: '7', sessionId: '9', deviceId: '3' });
    await bitacora.cerrar();
    expect(lotes).toHaveLength(1);
    expect(almacen.datos.has('atlas.bitacora.v1')).toBe(false);
    expect(bitacora.estaActiva).toBe(false);
    bitacora.entraEnPantalla('revision');
    expect(bitacora.transcurridoMs()).toBe(0);
  });

  it('el tamaño de lote es el tope del servidor', () => {
    expect(TAMANO_DE_LOTE).toBe(100);
  });
});
