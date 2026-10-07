/**
 * La silueta donde va la cara en la prueba de vida: cabeza y hombros, no un óvalo.
 *
 * Pablo (2026-10-07): «la silueta de las imágenes de selfie… ahora son óvalos sin sentido y poco relevantes; que sea ultra HD».
 * Un óvalo no dice cuánto acercarse ni hacia dónde girar. Aquí hay tres siluetas —de frente, girando a la izquierda y
 * girando a la derecha— que enseñan la postura exacta: dónde van la cabeza, el cuello y los hombros, y de qué lado se ve la oreja.
 *
 * ## Por qué «ultra HD»
 *
 * Son VECTORES (`react-native-svg`), no imágenes: se dibujan al tamaño y a la densidad de la pantalla —un iPhone a 3x se ve tan
 * nítido como uno a 2x— y pesan unos cientos de bytes. Nada que descargar, nada que se pixele al ampliar.
 *
 * ## Cómo se ve
 *
 * Todo lo que queda FUERA de la silueta se oscurece un poco (recorte con regla par-impar) y el contorno brilla con el color
 * de la marca. El contorno se llena de color según la persona se queda quieta (el color y el grosor vienen de fuera).
 * Los hombros siguen hasta el borde de la pantalla, así que no hay una línea horizontal cortando el dibujo.
 */
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import type { IdentityEvidenceKind } from '../features/evidence-upload';

/** El lienzo de las siluetas, en unidades propias; se escala a la pantalla. */
const ANCHO = 300;
const ALTO = 400;

/** Cabeza y hombros de frente. Los hombros bajan hasta 700 para llegar al borde inferior de cualquier pantalla. */
export const SILUETA_FRENTE =
  'M150 34 C 203 34 234 76 234 134 C 234 180 218 218 192 240 C 184 248 182 258 182 274 L 182 292 C 182 312 232 318 264 336 C 286 349 294 372 294 400 L 294 700 L 6 700 L 6 400 C 6 372 14 349 36 336 C 68 318 118 312 118 292 L 118 274 C 118 258 116 248 108 240 C 82 218 66 180 66 134 C 66 76 97 34 150 34 Z';
/** Las dos orejas, para que se vea que la cabeza va de frente y no girada. */
export const OREJAS_FRENTE = 'M66 116 C 50 114 46 148 62 166 M234 116 C 250 114 254 148 238 166';
/** Guías finas: la línea de los ojos y el eje de la cara. */
export const GUIAS_FRENTE = 'M150 44 L 150 250 M92 128 L 208 128';

/** Perfil mirando a la IZQUIERDA de la pantalla (nariz a la izquierda). */
export const SILUETA_PERFIL =
  'M170 34 C 120 34 100 68 100 94 C 100 108 98 116 98 122 C 98 130 104 134 104 140 C 96 152 82 164 76 172 C 74 178 82 180 96 182 C 94 188 94 192 96 194 C 100 198 98 202 100 204 C 96 208 96 212 98 216 C 100 226 100 232 106 240 C 118 252 136 252 150 258 L 150 292 C 150 312 100 320 64 334 C 28 348 8 368 8 400 L 8 700 L 296 700 L 296 400 C 296 366 280 346 248 334 C 222 324 214 310 214 290 L 220 238 C 244 214 252 170 250 126 C 248 70 216 34 170 34 Z';
/** La oreja que se ve cuando se gira. */
export const OREJA_PERFIL = 'M184 126 C 168 122 164 150 174 170 C 182 184 198 178 198 162 C 198 146 194 130 184 126 Z';

export type PoseDeSilueta = 'frente' | 'izquierda' | 'derecha';

/** Qué silueta le toca a cada captura de la prueba de vida. */
export function silutaDe(kind: IdentityEvidenceKind): PoseDeSilueta {
  if (kind === 'selfie_left') return 'izquierda';
  if (kind === 'selfie_right') return 'derecha';
  return 'frente';
}

/** De la silueta de frente a la de perfil: lo que cambia entre poses, para pintar y para probar. */
export function trazosDe(pose: PoseDeSilueta) {
  if (pose === 'frente') return { contorno: SILUETA_FRENTE, detalle: OREJAS_FRENTE, guias: GUIAS_FRENTE, espejo: false, orejaRellena: false };
  // Girar a la izquierda (cámara frontal en espejo): la nariz va a la izquierda de la pantalla. A la derecha, el espejo.
  return { contorno: SILUETA_PERFIL, detalle: OREJA_PERFIL, guias: null, espejo: pose === 'derecha', orejaRellena: true };
}

export function SiluetaDeCara({
  pose,
  color,
  grosor = 3,
  testID,
}: {
  pose: PoseDeSilueta;
  color: string;
  grosor?: number;
  testID?: string;
}) {
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
  const alMedir = (evento: LayoutChangeEvent) => setMedida({ ancho: evento.nativeEvent.layout.width, alto: evento.nativeEvent.layout.height });
  const { contorno, detalle, guias, espejo } = trazosDe(pose);

  // La silueta ocupa casi todo el ancho y ~60 % del alto; la cabeza queda por encima del centro, lejos del panel de abajo.
  const escala = medida.ancho > 0 ? Math.min((medida.ancho * 0.88) / ANCHO, (medida.alto * 0.6) / ALTO) : 1;
  const x = (medida.ancho - ANCHO * escala) / 2;
  const y = medida.alto * 0.16;
  const espejar = espejo ? `translate(${ANCHO} 0) scale(-1 1)` : '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={alMedir} testID={testID}>
      {medida.ancho > 0 ? (
        <Svg width={medida.ancho} height={medida.alto}>
          <G transform={`translate(${x} ${y}) scale(${escala})`}>
            {/* Lo de fuera, oscurecido: el recorte par-impar deja la silueta sin tapar. */}
            <Path fillRule="evenodd" fill="rgba(6,18,31,0.58)" d={`M-3000 -3000 H4000 V4000 H-3000 Z ${contorno}`} transform={espejar} />
            <G transform={espejar}>
              <Path d={contorno} fill="none" stroke={color} strokeWidth={grosor / escala} strokeLinejoin="round" />
              <Path d={detalle} fill="none" stroke={color} strokeWidth={(grosor * 0.85) / escala} strokeLinecap="round" />
              {guias ? <Path d={guias} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5 / escala} strokeDasharray="4 6" /> : null}
            </G>
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
