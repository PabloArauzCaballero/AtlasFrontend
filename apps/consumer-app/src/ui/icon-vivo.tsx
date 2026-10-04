/**
 * La vida de los iconos: cada uno tiene su manera de moverse, siempre, y nunca se mueve igual que el de al lado.
 *
 * ## Por qué se mueven solos
 *
 * Pablo lo pidió así: «serios pero divertidos y con movimiento constante». Un icono quieto es una pegatina; uno que respira
 * dice «esto está vivo». Por eso el movimiento aquí NO responde a un toque: es el carácter de la pieza. A cambio es
 * pequeño (unos pocos píxeles o grados), lento (1,5 a 4 s por ciclo) y fuera de fase entre iconos hermanos, para que una
 * fila de iconos parezca una fila de cosas con vida y no un metrónomo.
 *
 * ## Dónde se enciende
 *
 * Sólo donde el icono es protagonista (`IconChip`, la pestaña activa, estados vacíos). Los iconos de los botones y las
 * flechas se quedan quietos: ahí el icono acompaña a un texto y moverse le robaría la atención a la acción.
 *
 * Con «reducir movimiento» todo queda quieto y completo: el contenido nunca depende del movimiento.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Vivo, type TipoDeVida } from './motion';

export type VidaIcono = { tipo: TipoDeVida | 'gira'; periodo: number };

/** Cómo se mueve cada icono. Los que no aparecen (flechas, cerrar, lista…) son controles y se quedan quietos. */
export const VIDA_ICONO: Readonly<Record<string, VidaIcono>> = {
  inicio: { tipo: 'flota', periodo: 3600 },
  pagos: { tipo: 'oscila', periodo: 3200 },
  perfil: { tipo: 'flota', periodo: 3800 },
  alerta: { tipo: 'oscila', periodo: 1700 },
  reloj: { tipo: 'late', periodo: 2200 },
  candado: { tipo: 'pulsa', periodo: 2800 },
  escudo: { tipo: 'late', periodo: 2600 },
  camara: { tipo: 'pulsa', periodo: 3000 },
  documento: { tipo: 'flota', periodo: 3600 },
  editar: { tipo: 'oscila', periodo: 2200 },
  ayuda: { tipo: 'oscila', periodo: 2600 },
  info: { tipo: 'pulsa', periodo: 2800 },
  billetera: { tipo: 'flota', periodo: 3000 },
  chispa: { tipo: 'late', periodo: 1500 },
  asistente: { tipo: 'flota', periodo: 2800 },
  refrescar: { tipo: 'gira', periodo: 2800 },
  educacion: { tipo: 'oscila', periodo: 3000 },
  electronica: { tipo: 'pulsa', periodo: 3200 },
  celulares: { tipo: 'oscila', periodo: 2800 },
  ropa: { tipo: 'oscila', periodo: 3400 },
  hogar: { tipo: 'flota', periodo: 3600 },
  salud: { tipo: 'late', periodo: 1700 },
  supermercado: { tipo: 'flota', periodo: 3200 },
  transporte: { tipo: 'flota', periodo: 2400 },
  servicios: { tipo: 'gira', periodo: 7000 },
  comercio: { tipo: 'flota', periodo: 3200 },
  grafico: { tipo: 'flota', periodo: 3000 },
  tendencia: { tipo: 'flota', periodo: 2600 },
  estrella: { tipo: 'late', periodo: 1800 },
  etiqueta: { tipo: 'oscila', periodo: 2600 },
  ubicacion: { tipo: 'flota', periodo: 2000 },
  sobre: { tipo: 'flota', periodo: 3000 },
  telefono: { tipo: 'oscila', periodo: 1900 },
  ojo: { tipo: 'pulsa', periodo: 3200 },
  enviar: { tipo: 'flota', periodo: 2000 },
  chat: { tipo: 'flota', periodo: 2800 },
  galeria: { tipo: 'flota', periodo: 3400 },
  descargar: { tipo: 'flota', periodo: 2400 },
};

/**
 * Iconos que NO llevan destello aunque sean de dos tonos: los controles (flechas, cerrar, copiar…), donde un destello
 * parece un error, y los que ya son un destello, donde sería redundante.
 */
export const SIN_BRILLO: ReadonlySet<string> = new Set([
  'atras', 'adelante', 'check', 'cerrar', 'salir', 'copiar', 'lista', 'cuadricula', 'filtro', 'descargar',
  'clip', 'papelera', 'ojo-tachado', 'enviar', 'chispa', 'asistente', 'estrella',
]);

/** Un número estable por nombre, para que dos iconos iguales de la misma fila no latan a la vez. */
export const faseDe = (nombre: string): number => [...nombre].reduce((suma, c) => suma + c.charCodeAt(0), 0);

/** Giro continuo, sin ida y vuelta: el refrescar da vueltas y la llave de servicios engrana lento. */
function Gira({ periodo, children }: { periodo: number; children: React.ReactNode }) {
  const reducido = useReducedMotion();
  const vuelta = useSharedValue(0);

  useEffect(() => {
    if (reducido) return;
    vuelta.value = withRepeat(withTiming(1, { duration: periodo, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(vuelta);
  }, [periodo, reducido, vuelta]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ rotate: `${reducido ? 0 : vuelta.value * 360}deg` }] }));
  return <Animated.View style={estilo}>{children}</Animated.View>;
}

/** La línea de lectura del escáner: sube y baja por el visor, como el láser de una caja registradora. */
function Barrido({ size, acento }: { size: number; acento: string }) {
  const reducido = useReducedMotion();
  const pos = useSharedValue(0.5);

  useEffect(() => {
    if (reducido) return;
    pos.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pos);
  }, [pos, reducido]);

  const k = size / 24;
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: (3.2 + pos.value * 13.6) * k }] }));
  return (
    <Animated.View
      pointerEvents="none"
      testID="icono-barrido"
      style={[{ position: 'absolute', left: 3.5 * k, width: 17 * k, height: Math.max(1.5, 1.75 * k), borderRadius: 2, backgroundColor: acento }, estilo]}
    />
  );
}

/** El destello de cuatro puntas en la esquina: lo que hace «divertido» a un icono serio. */
function Brillo({ size, acento, retardo }: { size: number; acento: string; retardo: number }) {
  const lado = Math.round(size * 0.42);
  return (
    <View pointerEvents="none" style={[styles.brillo, { top: -size * 0.14, right: -size * 0.14 }]} testID="icono-brillo">
      <Vivo tipo="late" periodo={1700} retardo={retardo}>
        <Svg width={lado} height={lado} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M12 1c.8 7 2.2 9.2 11 11-8.8 1.8-10.2 4-11 11-.8-7-2.2-9.2-11-11C9.8 10.2 11.2 8 12 1z" fill={acento} />
        </Svg>
      </Vivo>
    </View>
  );
}

/**
 * Envuelve el dibujo de un icono con su vida: el movimiento de su personalidad, el barrido del escáner y el destello.
 * `vivo` enciende el movimiento; `duo` pone el destello (sólo a partir de 20 px, debajo se vuelve ruido).
 */
export function VidaDeIcono({ nombre, size, acento, duo, vivo, children }: { nombre: string; size: number; acento: string; duo: boolean; vivo: boolean; children: React.ReactNode }) {
  const vida = vivo ? VIDA_ICONO[nombre] : undefined;
  const retardo = faseDe(nombre) % 1200;

  let cuerpo: React.ReactNode = children;
  if (vida?.tipo === 'gira') cuerpo = <Gira periodo={vida.periodo}>{children}</Gira>;
  else if (vida) cuerpo = <Vivo tipo={vida.tipo} periodo={vida.periodo} retardo={retardo}>{children}</Vivo>;

  return (
    <View style={{ width: size, height: size }} testID={`icono-${vivo ? 'vivo' : 'duo'}-${nombre}`}>
      {cuerpo}
      {vivo && nombre === 'escanear' ? <Barrido size={size} acento={acento} /> : null}
      {duo && size >= 20 && !SIN_BRILLO.has(nombre) ? <Brillo size={size} acento={acento} retardo={retardo} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ brillo: { position: 'absolute' } });
