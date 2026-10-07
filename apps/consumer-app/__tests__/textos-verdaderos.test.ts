import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as avisosCopy from '../src/features/avisos-copy';
import * as demoCopy from '../src/features/demo-copy';
import * as trustCopy from '../src/features/trust-copy';
import { bannerDesdeContenido } from '../src/ui/partner-banner';
import type { ContentEntry } from '../src/api/endpoints/app-content';

/**
 * Guardia de promesas: ninguna frase que Core no cumple puede volver a la app.
 *
 * `src/features/trust-copy.ts` ya establecia que «ninguna garantia puede describir algo que el
 * backend no haga», pero nada lo hacia cumplir, y la auditoria del 2026-09-29 encontro una docena de
 * frases que si lo hacian (avisos de cuota que nadie emite, «sin intereses», «cuotas quincenales»,
 * «Ni Atlas lo ve»…). Esta prueba es lo que lo hace cumplir.
 *
 * LA LISTA DE PROHIBIDAS VIVE AQUI, en un solo sitio, cada una con su motivo. Para quitar una hay
 * que borrar su motivo a la vista de quien revisa; para anadir otra basta una linea.
 *
 * Alcance: (1) todo texto exportado por los modulos de copy y (2) cada archivo de `app/` y `src/`,
 * sin comentarios (los comentarios explican POR QUE se retiro una frase y por eso la nombran).
 */

type Prohibida = { patron: RegExp; motivo: string; soloConfianza?: boolean };

export const PROHIBIDAS: Prohibida[] = [
  { patron: /sin inter[eé]s(es)?\b/i, motivo: 'Core cobra una tasa que fija el Motor por solicitud: nada es «sin interés».' },
  { patron: /\b0\s?%\s*(de\s*)?inter[eé]s/i, motivo: 'Igual que «sin interés»: no existe un producto al 0 %.' },
  { patron: /cuotas?\s+quincenales?/i, motivo: 'Core arma cuotas MENSUALES (loan-schedule); las quincenales son de la demostración.' },
  { patron: /42 segundos/i, motivo: 'Cifra inventada: no hay medición del tiempo de aprobación.' },
  { patron: /\b500\+/, motivo: 'Cifra inventada de comercios.' },
  { patron: /cr[eé]dito al instante/i, motivo: 'La aprobación pasa por el Motor y, a veces, por una persona.' },
  { patron: /una sola vez/i, motivo: 'La app rastrea la ubicación de forma continua si se da el permiso.', soloConfianza: true },
  { patron: /ni atlas lo ve/i, motivo: 'El PIN llega al servidor, que guarda su huella Argon2id: la promesa es «no lo guardamos».' },
  { patron: /solo cobranza/i, motivo: 'El domicilio también sirve para verificar: «verificar y cobranza».' },
  {
    patron: /(?<!\bno )te avis(amos|aremos)[^.]{0,80}(cuota|vence|vencimiento|se aprueba)/i,
    motivo: 'Core no emite installment.due_soon|due_today|overdue|paid ni credit_line.approved ni purchase.*.',
  },
  { patron: /(cuota|vence|vencimiento)[^.]{0,60}(?<!\bno )te avis(amos|aremos)/i, motivo: 'Igual: ningún aviso de cuota sale hacia el cliente.' },
  { patron: /te (enviamos|mandamos) (un )?recordatorio/i, motivo: 'Core no envía recordatorios de cuota.' },
  { patron: /inter[eé]s penal/i, motivo: 'Core no calcula interés penal (late_fee_amount nunca se escribe).' },
  { patron: /empezar[aá]n a correr intereses/i, motivo: 'No corre ningún interés por mora: sólo baja el puntaje.' },
  { patron: /central de (informaci[oó]n crediticia|riesgo)/i, motivo: 'Core no reporta a ninguna central de riesgo.' },
  { patron: /suspensi[oó]n de tu cuenta/i, motivo: 'La mora no bloquea compras ni cuentas: sólo baja el puntaje.' },
  { patron: /no pasa por la app/i, motivo: 'El extracto sí pasa por la app (copia en caché mientras se sube).' },
  { patron: /escr[ií]benos y se elimina/i, motivo: 'No hay borrado dirigido de extractos: se pide como solicitud de supresión (Privacidad).' },
  { patron: /te avisaremos cuando haya respuesta|te respond(emos|eremos) por los avisos/i, motivo: 'Ningún cambio de estado de una solicitud de datos genera aviso.' },
  { patron: /te atiende una persona|estamos del otro lado/i, motivo: 'No hay control de disponibilidad de soporte: no se promete atención humana inmediata.' },
  { patron: /normalmente el mismo d[ií]a/i, motivo: 'No hay plazo comprobable para la revisión de identidad.' },
  { patron: /compr[eé] la nevera/i, motivo: 'Testimonio inventado de un cliente que no existe.' },
];

/** Devuelve los motivos de cada frase prohibida presente en `texto`. */
export function hallazgos(texto: string, confianza = false): string[] {
  return PROHIBIDAS.filter((regla) => (confianza || !regla.soloConfianza) && regla.patron.test(texto)).map(
    (regla) => `${regla.patron} -> ${regla.motivo}`,
  );
}

function textosDe(valor: unknown, salida: string[] = []): string[] {
  if (typeof valor === 'string') salida.push(valor);
  else if (Array.isArray(valor)) for (const v of valor) textosDe(v, salida);
  else if (valor && typeof valor === 'object') for (const v of Object.values(valor)) textosDe(v, salida);
  return salida;
}

function archivos(dir: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules') continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else if (/\.tsx?$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

const RAIZ = join(__dirname, '..');

describe('guardia de promesas: textos que la app dice al cliente', () => {
  it('los textos de confianza, avisos y demostración no contienen frases prohibidas', () => {
    const textos = [trustCopy, avisosCopy, demoCopy].flatMap((modulo) => textosDe(modulo));
    expect(textos.length).toBeGreaterThan(20);
    const fallos = textos.flatMap((texto) => hallazgos(texto, true).map((h) => `«${texto}» ${h}`));
    expect(fallos).toEqual([]);
  });

  it('ningún archivo de app/ ni src/ contiene una frase prohibida fuera de sus comentarios', () => {
    const rutas = [...archivos(join(RAIZ, 'app')), ...archivos(join(RAIZ, 'src'))];
    expect(rutas.length).toBeGreaterThan(50);
    const fallos = rutas.flatMap((ruta) =>
      hallazgos(sinComentarios(readFileSync(ruta, 'utf8'))).map((h) => `${relative(RAIZ, ruta)}: ${h}`),
    );
    expect(fallos).toEqual([]);
  });

  it('la guardia falla en negativo: caza cada frase conocida', () => {
    const malas = [
      'Paga en 3 cuotas sin interés con tu línea Atlas.',
      'Sin intereses. Las tres cuotas suman el 40 %.',
      '3 cuotas quincenales, con 0% de intereses',
      'Aprobado en 42 segundos',
      '500+ comercios',
      'Crédito al instante en Santa Cruz',
      'Ni Atlas lo ve',
      'Solo cobranza',
      'Te avisamos cuando vence una cuota y cuando se aprueba una compra.',
      'Con la app instalada te avisamos cuando vence una cuota.',
      'El interés penal corre solo sobre el capital.',
      'Se reporta a la Central de Información Crediticia.',
      'Puede llevar a la suspensión de tu cuenta.',
      'No pasa por la app ni queda en tu teléfono.',
      'Escríbenos y se elimina.',
      'Te avisaremos cuando haya respuesta.',
      'Te atiende una persona.',
      'Estamos del otro lado.',
      'Te avisamos en cuanto termine, normalmente el mismo día.',
      '“Compré la nevera que necesitaba sin descuadrar el mes.”',
    ];
    for (const mala of malas) expect({ mala, encontrados: hallazgos(mala).length > 0 }).toEqual({ mala, encontrados: true });
    expect(hallazgos('Una sola vez')).toEqual([]);
    expect(hallazgos('Una sola vez', true)).toHaveLength(1);
  });

  it('no castiga la frase verdadera equivalente', () => {
    const buenas = [
      'Todavía no te avisamos cuando se acerca o vence una cuota. Revisa tus fechas en la pestaña Pagos.',
      avisosCopy.AVISOS_QUE_LLEGAN_RESUMEN,
      'Cuotas mensuales, con la tasa que Atlas te asigna según tu perfil.',
    ];
    for (const buena of buenas) expect(hallazgos(buena, true)).toEqual([]);
  });

  it('las fotos del carnet no prometen cifrado y el PIN no promete que Atlas no lo ve', () => {
    const etiquetas = (dato: RegExp) =>
      [...trustCopy.TRUST_IDENTIDAD, ...trustCopy.TRUST_REGISTRO]
        .filter((item) => dato.test(item.dato))
        .flatMap((item) => item.garantias.map((g) => g.label));
    expect(etiquetas(/fotos/i)).not.toContain('Cifrado');
    expect(etiquetas(/fotos/i)).toContain('Viaja por conexión segura');
    expect(etiquetas(/PIN/)).toContain('Solo guardamos su huella');
    expect(etiquetas(/PIN/)).toContain('No se guarda');
  });

  it('la sesión en web no dice que está cifrada', () => {
    expect(trustCopy.SESION_GUARDADA_WEB).not.toMatch(/cifrad/i);
    expect(trustCopy.SESION_GUARDADA_MOVIL).toMatch(/cifrad/i);
  });
});

describe('avisos: solo se presenta como enviado lo que Core emite', () => {
  it.each([
    'installment.due_soon',
    'installment.due_today',
    'installment.overdue',
    'installment.paid',
    'credit_line.approved',
    'purchase.created',
    'purchase.downpayment_confirmed',
    'cuota_por_vencer',
    'cuota_vencida',
  ])('%s no tiene emisor', (codigo) => {
    expect(avisosCopy.avisoSinEmisor(codigo)).toBe(true);
  });

  it.each(['payment.reported', 'payment.confirmed', 'payment.rejected', 'kyc.approved', 'kyc.rejected', 'customer.lifecycle.active', 'alerta_seguridad', 'codigo_acceso'])(
    '%s sigue tratándose como emitido',
    (codigo) => {
      expect(avisosCopy.avisoSinEmisor(codigo)).toBe(false);
    },
  );
});

describe('banner de partner: sale del contenido del servidor y no se inventa', () => {
  const entrada = (parcial: Partial<ContentEntry>): ContentEntry => ({
    contentKey: 'home-banner',
    surface: 'home',
    title: null,
    subtitle: null,
    body: null,
    bullets: [],
    metadata: {},
    action: null,
    displayOrder: 1,
    ...parcial,
  });

  it('sin contenido no hay banner', () => {
    expect(bannerDesdeContenido([])).toBeNull();
  });

  it('sin nombre del comercio o sin título no hay banner', () => {
    expect(bannerDesdeContenido([entrada({ title: 'Promo' })])).toBeNull();
    expect(bannerDesdeContenido([entrada({ metadata: { partnerName: 'Tienda' } })])).toBeNull();
  });

  it('con contenido completo, lo pinta tal cual y sólo enlaza a https/whatsapp', () => {
    const banner = bannerDesdeContenido([
      entrada({
        title: '2x1',
        subtitle: 'Hasta el viernes',
        metadata: { partnerName: 'Librería X' },
        action: { kind: 'link', label: 'Ver', url: 'https://x.test/promo' },
      }),
    ]);
    expect(banner).toMatchObject({ partnerName: 'Librería X', headline: '2x1', detail: 'Hasta el viernes', icon: 'comercio' });
    expect(banner?.action?.url).toBe('https://x.test/promo');
    const peligroso = bannerDesdeContenido([
      entrada({ title: '2x1', metadata: { partnerName: 'X' }, action: { kind: 'link', label: 'Ver', url: 'javascript:alert(1)' } }),
    ]);
    expect(peligroso?.action).toBeNull();
  });
});
