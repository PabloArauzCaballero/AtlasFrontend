/**
 * La lógica del chat y de los casos: qué hace cada evento del hilo, el doble tic, el árbol de
 * motivos y la regla de «Enviar el caso». Son las reglas de `MerchantSupportScreen` de la web.
 */
import type { CasoDeSoporte, EstadoDeLectura, MensajeDeSoporte } from '@/api/servicios/supportService';
import {
  agregarMensaje,
  aplanarMotivos,
  aplicarLectura,
  canalVivo,
  casoListoParaEnviar,
  efectoDelEvento,
  fechaHora,
  fueLeido,
  motivoDeBloqueo,
  nuevoClientMessageId,
  tonoDelCaso,
} from '@/features/soporte/chat';

function mensaje(parcial: Partial<MensajeDeSoporte>): MensajeDeSoporte {
  return {
    messageId: 'm1',
    sequence: '1',
    clientMessageId: 'x',
    senderActorType: 'PARTNER_USER',
    messageType: 'TEXT',
    visibility: 'PUBLIC',
    body: 'hola',
    redacted: false,
    createdAt: '2026-10-09T15:00:00Z',
    attachments: [],
    ...parcial,
  };
}

describe('eventos del hilo en vivo', () => {
  it('traduce cada tipo y descarta lo desconocido', () => {
    expect(efectoDelEvento({ type: 'message.created', data: { messageId: 'm9', sequence: '9' } })).toEqual({
      tipo: 'mensaje',
      mensaje: { messageId: 'm9', sequence: '9' },
    });
    expect(efectoDelEvento({ type: 'agent.typing', data: {} })).toEqual({ tipo: 'escribiendo' });
    expect(efectoDelEvento({ type: 'message.read', data: { actorType: 'AGENT', upToSequence: 7 } })).toEqual({
      tipo: 'leido',
      actorType: 'AGENT',
      upToSequence: '7',
    });
    expect(efectoDelEvento({ type: 'channel.closed', data: {} })).toEqual({ tipo: 'cerrado' });
    expect(efectoDelEvento({ type: 'otra.cosa', data: {} })).toBeNull();
  });

  it('no duplica un mensaje que llega por el envío y por el hilo', () => {
    const uno = mensaje({ sequence: '5' });
    const lista = agregarMensaje([uno], mensaje({ messageId: 'otro', sequence: '5' }));
    expect(lista).toHaveLength(1);
    expect(agregarMensaje(lista, mensaje({ messageId: 'm6', sequence: '6' }))).toHaveLength(2);
  });

  it('mueve el acuse de lectura sólo del actor que lo manda', () => {
    const estados: EstadoDeLectura[] = [
      { actorType: 'AGENT', roleInChannel: 'agent', lastReadSequence: '1', lastReadAt: null },
      { actorType: 'PARTNER_USER', roleInChannel: 'requester', lastReadSequence: '3', lastReadAt: null },
    ];
    const despues = aplicarLectura(estados, 'AGENT', '4');
    expect(despues[0]!.lastReadSequence).toBe('4');
    expect(despues[1]!.lastReadSequence).toBe('3');
    expect(aplicarLectura(estados, 'AGENT', undefined)[0]!.lastReadSequence).toBe('1');
  });

  it('el doble tic sólo existe en lo que mandó el comercio y ya leyó alguien', () => {
    const leido: EstadoDeLectura[] = [{ actorType: 'AGENT', roleInChannel: 'agent', lastReadSequence: '10', lastReadAt: null }];
    expect(fueLeido(mensaje({ sequence: '9' }), leido)).toBe(true);
    expect(fueLeido(mensaje({ sequence: '11' }), leido)).toBe(false);
    expect(fueLeido(mensaje({ sequence: '9', senderActorType: 'AGENT' }), leido)).toBe(false);
  });

  it('el identificador del mensaje cabe en lo que acepta el backend (8 a 64)', () => {
    const id = nuevoClientMessageId(1_760_000_000_000, 0.123456789);
    expect(id).toMatch(/^merchant-app-1760000000000-[a-z0-9]+$/);
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(id.length).toBeLessThanOrEqual(64);
  });
});

describe('casos', () => {
  it('aplana el árbol de motivos con «Padre › Hijo»', () => {
    expect(
      aplanarMotivos([
        {
          categoryCode: 'PAGOS',
          label: 'Pagos',
          description: null,
          requiresSpecialist: false,
          subcategories: [{ categoryCode: 'PAGOS_QR', label: 'QR', description: null, requiresSpecialist: false }],
        },
      ]),
    ).toEqual([
      { label: 'Pagos', value: 'PAGOS' },
      { label: 'Pagos › QR', value: 'PAGOS_QR' },
    ]);
  });

  it('«Enviar el caso» exige motivo, título de 3 y descripción de 10, y dice qué falta', () => {
    const listo = { categoryCode: 'PAGOS', title: 'QR', description: '' };
    expect(casoListoParaEnviar(listo)).toBe(false);
    expect(motivoDeBloqueo({ ...listo, categoryCode: '' })).toBe('Elige el motivo del caso.');
    expect(motivoDeBloqueo(listo)).toMatch(/título/);
    expect(motivoDeBloqueo({ ...listo, title: 'El QR no carga' })).toMatch(/descripción/);
    const completo = { categoryCode: 'PAGOS', title: 'El QR no carga', description: '  desde ayer a la tarde  ' };
    expect(casoListoParaEnviar(completo)).toBe(true);
    expect(motivoDeBloqueo(completo)).toBeNull();
  });

  const caso = (parcial: Partial<CasoDeSoporte>): CasoDeSoporte => ({
    caseId: 'c',
    caseNumber: 'SUP-1',
    title: 't',
    caseType: 'INCIDENT',
    domain: 'PAYMENTS',
    status: 'OPEN',
    summary: null,
    openedAt: '2026-10-01T10:00:00Z',
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    lastActivityAt: '2026-10-01T10:00:00Z',
    reopenedCount: 0,
    ...parcial,
  });

  it('«Ver conversación» sólo aparece con un canal que no esté cerrado ni abandonado', () => {
    expect(canalVivo(caso({ channels: [{ channelId: 'a', status: 'CLOSED', type: 'CHAT' }] }))).toBeNull();
    expect(canalVivo(caso({ channels: [{ channelId: 'a', status: 'ABANDONED', type: 'CHAT' }, { channelId: 'b', status: 'OPEN', type: 'CHAT' }] }))).toBe('b');
    expect(canalVivo(caso({}))).toBeNull();
  });

  it('el tono del estado: cerrado gris, resuelto verde, abierto informativo', () => {
    expect(tonoDelCaso(caso({ closedAt: 'x', resolvedAt: 'x' }))).toBe('neutral');
    expect(tonoDelCaso(caso({ resolvedAt: 'x' }))).toBe('success');
    expect(tonoDelCaso(caso({}))).toBe('info');
  });

  it('una fecha que todavía no llegó dice «Todavía no»', () => {
    expect(fechaHora(null)).toBe('Todavía no');
    expect(fechaHora('2026-10-01T10:00:00Z')).not.toBe('Todavía no');
  });
});
