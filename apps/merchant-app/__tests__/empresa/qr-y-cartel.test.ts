/**
 * El QR de las cajas y su cartel.
 *
 * Lo que se fija aquí es lo que no se ve a simple vista: un QR mal generado se ve igual de
 * cuadriculado y falla recién en la caja, con el cliente delante.
 */
import { contenidoDelQrDeCaja, NIVEL_DE_CORRECCION, qrCodificado, qrMatrix } from '@/features/empresa/qr';
import { ALTO, ANCHO, nombreArchivoCartel, planoDelCartel, SIN_CODIGO_MANUAL, trazadoDelQr } from '@/features/empresa/cartel';

/*
 * `qrcode` es el generador que usa por dentro react-native-qrcode-svg (el QR de la pantalla). No trae
 * tipos y no es dependencia directa de la app: se carga sólo aquí, para comparar contra él.
 */
interface QrDeLibreria {
  version: number;
  maskPattern: number;
  modules: { size: number; get: (fila: number, col: number) => number };
  segments: { data: unknown }[];
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require('qrcode') as { create: (contenido: unknown, opciones: Record<string, unknown>) => QrDeLibreria };

const SERIALES = ['TIENDA-NORTE-D90000-CAJA-1', 'SN-00042', 'PANADERIA-EL-SOL-1A2B3C-CAJA-12', 'caja con tildes ñandú', 'X'.repeat(120)];

describe('lo que lleva el QR de una caja', () => {
  it('es el serial del terminal y nada más (ni nombre ni rubro del comercio)', () => {
    expect(contenidoDelQrDeCaja({ terminalSerial: 'TIENDA-NORTE-D90000-CAJA-1' })).toBe('TIENDA-NORTE-D90000-CAJA-1');
  });

  it('usa el nivel de corrección M, el mismo que la web', () => {
    expect(NIVEL_DE_CORRECCION).toBe('M');
  });

  it.each(SERIALES)('la matriz del cartel es un QR estándar idéntico al de la librería de pantalla (%s)', (serial) => {
    const propio = qrCodificado(serial);
    // La misma codificación (modo byte, M) y la misma máscara en la librería que pinta el QR en pantalla.
    const libreria = QRCode.create([{ data: serial, mode: 'byte' }], {
      errorCorrectionLevel: 'M',
      version: propio.version,
      maskPattern: propio.mascara,
    });
    const tamano = libreria.modules.size;
    expect(propio.matriz.length).toBe(tamano);
    const esperado = Array.from({ length: tamano }, (_, fila) => Array.from({ length: tamano }, (_, col) => libreria.modules.get(fila, col) === 1));
    expect(propio.matriz).toEqual(esperado);
  });

  it('lo que lee la librería de pantalla, decodificado, es exactamente el serial', () => {
    for (const serial of SERIALES) {
      const segmentos = QRCode.create(serial, { errorCorrectionLevel: 'M' }).segments;
      const texto = segmentos.map((s) => (s.data instanceof Uint8Array ? Buffer.from(s.data).toString('utf8') : String(s.data))).join('');
      expect(texto).toBe(serial);
    }
  });

  it('un contenido que no cabe en la versión 10 se rechaza en vez de recortarse', () => {
    expect(() => qrMatrix('A'.repeat(214))).toThrow('QR_CONTENT_TOO_LONG');
  });
});

describe('cartel de una caja', () => {
  const datos = { serial: 'TIENDA-NORTE-D90000-CAJA-1', codigoManual: 'K7M2-9QXD', comercio: 'Panadería El Sol', sucursal: 'Sucursal Norte', caja: 'Caja 1' };

  it('el nombre de archivo no lleva tildes, espacios ni signos (igual que la web)', () => {
    expect(nombreArchivoCartel({ comercio: 'Panadería «El Sol»', sucursal: 'Sucursal Norte (Equipetrol)', caja: 'Caja 1' })).toBe(
      'atlas-qr_Panaderia-El-Sol_Sucursal-Norte-Equipetrol_Caja-1.png',
    );
    expect(nombreArchivoCartel({ comercio: '', sucursal: '', caja: '' })).toBe('atlas-qr_caja.png');
  });

  it('no se imprime sin código manual: sería un QR sin su alternativa', () => {
    expect(() => planoDelCartel({ ...datos, codigoManual: '' })).toThrow(SIN_CODIGO_MANUAL);
  });

  it('lleva el QR del serial, el código a mano, el local, la caja y el serial al pie', () => {
    const plano = planoDelCartel(datos);
    expect(plano.qr.matriz).toEqual(qrMatrix(datos.serial));
    const textos = plano.textos.map((t) => t.texto);
    expect(textos).toEqual(
      expect.arrayContaining([
        'ATLAS',
        'Compra ahora, paga en cuotas',
        'Panadería El Sol',
        'Sucursal Norte · Caja 1',
        'Escanea con la app Atlas',
        '¿La cámara no lee el QR? Escribe este código en la app',
        'K7M2-9QXD',
        'Escanear → Ingresar el código a mano',
        'Caja TIENDA-NORTE-D90000-CAJA-1',
      ]),
    );
  });

  it('las medidas son las de la web: 1200×1900, QR centrado con zona tranquila de 4 módulos', () => {
    const plano = planoDelCartel(datos);
    expect([ANCHO, ALTO]).toEqual([1200, 1900]);
    const modulos = plano.qr.matriz.length + 8;
    expect(plano.qr.modulo).toBe(Math.floor(680 / modulos));
    expect(plano.qr.x0 * 2 + plano.qr.lado).toBeCloseTo(ANCHO, -1);
    expect(plano.qr.y0).toBe(530);
    expect(plano.cajaCodigo.y).toBe(plano.qr.y0 + plano.qr.lado + 28 + 160);
  });

  it('un nombre de comercio largo se parte en dos líneas y baja el resto 62 px', () => {
    const largo = planoDelCartel({ ...datos, comercio: 'Distribuidora de Productos Alimenticios del Oriente Boliviano Sociedad Anónima' });
    const lineas = largo.textos.filter((t) => t.peso === '800' && t.color === '#1d1d1f' && t.texto !== 'Escanea con la app Atlas');
    expect(lineas).toHaveLength(2);
    expect(largo.qr.y0).toBe(530 + 62);
    // Nada se sale del papel: cada texto centrado cabe en el ancho útil.
    for (const texto of largo.textos.filter((t) => t.ancla === 'middle')) {
      expect([...texto.texto].length * texto.tamano * (texto.mono ? 0.6 : 0.58)).toBeLessThanOrEqual(ANCHO);
    }
  });

  it('el trazado pinta un cuadro por módulo oscuro', () => {
    const plano = planoDelCartel(datos);
    const oscuros = plano.qr.matriz.flat().filter(Boolean).length;
    expect(trazadoDelQr(plano.qr).match(/M/g)).toHaveLength(oscuros);
  });
});
