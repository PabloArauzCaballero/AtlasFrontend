/**
 * «Descargar QR» de una caja: el cartel listo para imprimir (`lib/cartelQr.ts` de la web).
 *
 * El plano (qué va dónde y a qué tamaño) lo calcula `features/empresa/cartel.ts` con las medidas de
 * la web; aquí se pinta como UN SVG de 1200×1900 y se convierte en PNG con `toDataURL` de
 * react-native-svg. Así no hace falta capturar la pantalla (react-native-view-shot no está en la
 * app) y la imagen sale a su tamaño real, no al de la vista previa.
 *
 * En la web el clic descarga el PNG directamente. En el teléfono se abre la vista previa del cartel
 * en una hoja y el botón lo entrega a la hoja de compartir del sistema, desde donde se guarda en
 * Fotos, se imprime o se manda por WhatsApp: abrir la hoja de compartir mientras otra hoja todavía
 * sube es justo lo que iOS rechaza.
 */
import { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { space } from '@cliente/theme/tokens';
import { Button } from '@cliente/ui/primitives';
import { guardarArchivo } from '@/features/pdf';
import { ALTO, ANCHO, COLORES, nombreArchivoCartel, planoDelCartel, trazadoDelQr, type DatosCartel } from '@/features/empresa/cartel';
import { mensajeDe } from '@/features/empresa/errores';
import { Aviso } from '@/ui/aviso';
import { Hoja } from './hoja';

const FUENTE = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

type SvgConCaptura = { toDataURL: (callback: (base64: string) => void, options?: object) => void };

function base64ABytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function HojaDelCartel({ datos, onClose }: { datos: DatosCartel | null; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const svg = useRef<SvgConCaptura | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plano = useMemo(() => {
    if (!datos) return null;
    try {
      return planoDelCartel(datos);
    } catch (fallo) {
      return mensajeDe(fallo, 'No se pudo descargar el QR.');
    }
  }, [datos]);

  const compartir = async () => {
    if (!datos || !svg.current) return;
    setGenerando(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolver, rechazar) => {
        const vencido = setTimeout(() => rechazar(new Error('No se pudo generar la imagen del cartel.')), 15_000);
        svg.current?.toDataURL(
          (datosPng) => {
            clearTimeout(vencido);
            resolver(datosPng);
          },
          { width: ANCHO, height: ALTO },
        );
      });
      await guardarArchivo(base64ABytes(base64), nombreArchivoCartel(datos), 'image/png');
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No se pudo descargar el QR.'));
    } finally {
      setGenerando(false);
    }
  };

  const ancho = Math.min(width - space.lg * 4, 360);
  return (
    <Hoja visible={datos !== null} titulo={datos ? `Cartel de ${datos.caja}` : 'Cartel'} onClose={onClose} cierre="Cerrar" descripcion="Descarga el cartel con el diseño de Atlas, listo para imprimir.">
      {typeof plano === 'string' ? <Aviso tono="danger">{plano}</Aviso> : null}
      {plano && typeof plano !== 'string' ? (
        <View style={styles.vista} testID="cartel-vista">
          <Svg
            ref={(nodo) => {
              svg.current = nodo as unknown as SvgConCaptura | null;
            }}
            width={ancho}
            height={(ancho * ALTO) / ANCHO}
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
          >
            {/* Fondo blanco: un PNG transparente se imprime sobre el color del papel y deja de leerse. */}
            <Rect x={0} y={0} width={ANCHO} height={ALTO} fill="#ffffff" />
            <Rect x={0} y={0} width={ANCHO} height={300} fill={COLORES.noche} />
            <Rect x={0} y={300} width={ANCHO} height={10} fill={COLORES.menta} />
            {/* El marco del QR: blanco con el filete del acento. */}
            <Rect
              x={plano.marcoQr.x}
              y={plano.marcoQr.y}
              width={plano.marcoQr.lado}
              height={plano.marcoQr.lado}
              rx={plano.marcoQr.radio}
              fill="#ffffff"
              stroke={COLORES.acento}
              strokeWidth={6}
            />
            <Rect x={plano.qr.x0} y={plano.qr.y0} width={plano.qr.lado} height={plano.qr.lado} fill="#ffffff" />
            <Path d={trazadoDelQr(plano.qr)} fill={COLORES.modulo} />
            {/* El recuadro del código a mano, con el borde discontinuo de la web. */}
            <Rect
              x={plano.cajaCodigo.x}
              y={plano.cajaCodigo.y}
              width={plano.cajaCodigo.ancho}
              height={plano.cajaCodigo.alto}
              rx={plano.cajaCodigo.radio}
              fill={COLORES.lavado}
              stroke={COLORES.acento}
              strokeWidth={4}
              strokeDasharray={[18, 12]}
            />
            {plano.textos.map((texto, indice) => (
              <SvgText
                key={`${indice}-${texto.texto}`}
                x={texto.x}
                y={texto.y}
                fontSize={texto.tamano}
                fontWeight={texto.peso}
                fontFamily={texto.mono ? MONO : FUENTE}
                fill={texto.color}
                textAnchor={texto.ancla}
              >
                {texto.texto}
              </SvgText>
            ))}
          </Svg>
        </View>
      ) : null}
      {error ? <Aviso tono="danger">{error}</Aviso> : null}
      <Button
        label="Guardar o compartir el cartel"
        icon="descargar"
        loading={generando}
        disabled={!plano || typeof plano === 'string'}
        onPress={() => compartir()}
        testID="cartel-compartir"
      />
    </Hoja>
  );
}

const styles = StyleSheet.create({
  vista: { alignItems: 'center' },
});
