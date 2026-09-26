/**
 * Las dos acciones nuevas de `captura` —`escanea` y `respaldo_camara`— y lo que NO tiene que pasar
 * con el escaner del sistema delante: que irse la app al fondo (en Android el escaner es otra
 * actividad) se anote como una salida a mitad de la captura.
 */
import type { TelemetryBatch } from '../src/api/endpoints/telemetry';
import { bitacora, DETALLE_ESCANER } from '../src/features/bitacora/bitacora';
import type { Almacen } from '../src/features/bitacora/cola';
import { Reloj } from '../src/features/bitacora/reloj';
import { traducir } from '../src/features/bitacora/traduccion';
import { normalizarComoElServidor, PALABRAS_PROHIBIDAS } from '../src/features/bitacora/tipos';

function montar() {
  const lotes: TelemetryBatch[] = [];
  const datos = new Map<string, string>();
  const almacen: Almacen = {
    leer: async (clave) => datos.get(clave) ?? null,
    escribir: async (clave, valor) => {
      datos.set(clave, valor);
    },
    borrar: async (clave) => {
      datos.delete(clave);
    },
  };
  let monotonico = 1_000_000;
  let epoch = Date.UTC(2026, 8, 26, 3, 0, 0);
  bitacora.configurar({
    almacen,
    reloj: { ahoraMonotonico: () => monotonico, ahoraEpoch: () => epoch },
    umbralDeVaciado: 1_000,
    intervaloDeVaciadoMs: 0,
    transporte: async (_customerId, lote) => {
      lotes.push(lote);
      return { accepted: lote.events?.length ?? 0 };
    },
  });
  return {
    lotes,
    avanzar(ms: number) {
      monotonico += ms;
      epoch += ms;
    },
  };
}

async function codigos(lotes: TelemetryBatch[]) {
  bitacora.adjuntarSesion({ customerId: '7', sessionId: '9', deviceId: '3' });
  await bitacora.vaciar();
  return lotes.flatMap((lote) => lote.events ?? []);
}

describe('bitacora: el escaner del sistema', () => {
  afterEach(async () => {
    await bitacora.cerrar();
  });

  it('escanea -> toma: viajan como eventType de captura_<que>', async () => {
    const { lotes, avanzar } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('identidad');
    bitacora.captura('carnet_frente', 'abre');
    bitacora.captura('carnet_frente', 'escanea');
    avanzar(4000);
    bitacora.captura('carnet_frente', 'toma');
    const eventos = await codigos(lotes);
    expect(eventos.filter((e) => e.eventCode === 'captura_carnet_frente').map((e) => e.metadata?.eventType)).toEqual(['abre', 'escanea', 'toma']);
  });

  it('con el escaner abierto, irse al fondo NO se anota como segundo plano de la captura, y el flujo lleva el detalle', async () => {
    const { lotes, avanzar } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('identidad');
    bitacora.captura('carnet_reverso', 'abre');
    bitacora.captura('carnet_reverso', 'escanea');
    bitacora.segundoPlano();
    avanzar(6000);
    bitacora.primerPlano();
    bitacora.captura('carnet_reverso', 'toma');
    // Despues de cerrar el escaner, el segundo plano vuelve a ser uno cualquiera.
    bitacora.segundoPlano();
    bitacora.primerPlano();
    const eventos = await codigos(lotes);
    expect(eventos.some((e) => e.eventCode === 'captura_carnet_reverso' && e.metadata?.eventType === 'segundo_plano')).toBe(false);
    const flujo = eventos.filter((e) => e.eventCode === 'flujo' && e.metadata?.eventType !== 'inicio');
    expect(flujo.map((e) => [e.metadata?.eventType, e.metadata?.detail])).toEqual([
      ['segundo_plano', DETALLE_ESCANER],
      ['primer_plano', DETALLE_ESCANER],
      ['segundo_plano', undefined],
      ['primer_plano', undefined],
    ]);
  });

  it('respaldo_camara vuelve a abrir la captura: con la camara de la app, irse al fondo si cuenta', async () => {
    const { lotes } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.entraEnPantalla('identidad');
    bitacora.captura('carnet_frente', 'abre');
    bitacora.captura('carnet_frente', 'escanea');
    bitacora.captura('carnet_frente', 'respaldo_camara');
    bitacora.segundoPlano();
    const eventos = await codigos(lotes);
    expect(eventos.filter((e) => e.eventCode === 'captura_carnet_frente').map((e) => e.metadata?.eventType)).toEqual([
      'abre',
      'escanea',
      'respaldo_camara',
      'segundo_plano',
    ]);
    expect(eventos.find((e) => e.eventCode === 'flujo' && e.metadata?.eventType === 'segundo_plano')?.metadata?.detail).toBeUndefined();
  });

  it('cancelar el escaner cierra el estado: el siguiente segundo plano ya no lleva detalle', async () => {
    const { lotes } = montar();
    await bitacora.arrancar('crear_cuenta');
    bitacora.captura('carnet_frente', 'escanea');
    bitacora.captura('carnet_frente', 'cancela');
    bitacora.segundoPlano();
    const eventos = await codigos(lotes);
    expect(eventos.find((e) => e.eventCode === 'flujo' && e.metadata?.eventType === 'segundo_plano')?.metadata?.detail).toBeUndefined();
  });

  it('la traduccion no cambia de forma: la accion va en metadata.eventType', () => {
    const reloj = new Reloj({ ahoraMonotonico: () => 0, ahoraEpoch: () => Date.UTC(2026, 8, 26) });
    expect(traducir({ tipo: 'captura', que: 'carnet_frente', accion: 'respaldo_camara', t: 5 }, reloj)).toMatchObject({
      eventType: 'onboarding_step_event',
      eventCode: 'captura_carnet_frente',
      metadata: { eventType: 'respaldo_camara', elapsedMs: 5 },
    });
  });

  it.each(['escanea', 'respaldo_camara', DETALLE_ESCANER, 'captura_pequena', 'captura_proporcion'])(
    '«%s» no contiene ninguna palabra que el servidor rechace',
    (codigo) => {
      for (const palabra of PALABRAS_PROHIBIDAS) expect(normalizarComoElServidor(codigo)).not.toContain(palabra);
    },
  );
});
