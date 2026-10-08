/**
 * Las piezas físicas de la tarjeta Atlas, dibujadas en vectores para que se vean nítidas a cualquier densidad de
 * pantalla: el chip EMV, el símbolo de pago sin contacto, la textura de metal y el reflejo que sigue al dedo.
 *
 * Van aparte de `tarjeta-atlas.tsx` porque son dibujo puro: no saben nada del nivel, del catálogo ni de los gestos.
 */
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * El chip EMV: el bloque dorado con sus ocho contactos.
 *
 * Es dorado en TODAS las tarjetas, también en la negra y en la plata, porque así son los de verdad: el chip es oro sobre
 * cobre, no se pinta del color de la tarjeta. Es lo que más hace que el objeto se lea como una tarjeta bancaria.
 */
export function ChipEmv({ ancho }: { ancho: number }) {
  const alto = ancho * 0.76;
  return (
    <Svg width={ancho} height={alto} viewBox="0 0 50 38" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="chip-oro" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F6E3A1" />
          <Stop offset="0.35" stopColor="#D9B45A" />
          <Stop offset="0.6" stopColor="#F2D98C" />
          <Stop offset="1" stopColor="#A9802F" />
        </LinearGradient>
        <LinearGradient id="chip-brillo" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0.5} y={0.5} width={49} height={37} rx={6.5} fill="url(#chip-oro)" stroke="#8C6A24" strokeWidth={0.8} />
      {/* Las pistas de contacto: un marco central y las seis lengüetas que salen a los lados. */}
      <G stroke="#8C6A24" strokeWidth={0.9} fill="none" opacity={0.85}>
        <Rect x={17} y={9} width={16} height={20} rx={3} />
        <Line x1={0.5} y1={13} x2={17} y2={13} />
        <Line x1={0.5} y1={25} x2={17} y2={25} />
        <Line x1={33} y1={13} x2={49.5} y2={13} />
        <Line x1={33} y1={25} x2={49.5} y2={25} />
        <Line x1={25} y1={0.5} x2={25} y2={9} />
        <Line x1={25} y1={29} x2={25} y2={37.5} />
        <Line x1={17} y1={19} x2={33} y2={19} />
      </G>
      <Rect x={0.5} y={0.5} width={49} height={18} rx={6.5} fill="url(#chip-brillo)" />
    </Svg>
  );
}

/** El símbolo de pago sin contacto: cuatro arcos que se abren hacia la derecha. */
export function SinContacto({ alto, color }: { alto: number; color: string }) {
  return (
    <Svg width={alto * 0.8} height={alto} viewBox="0 0 20 25" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <G stroke={color} strokeWidth={1.9} strokeLinecap="round" fill="none" opacity={0.9}>
        <Path d="M3 9.5a5 5 0 0 1 0 6" />
        <Path d="M7 7a9 9 0 0 1 0 11" />
        <Path d="M11 4.5a13 13 0 0 1 0 16" />
        <Path d="M15 2a17 17 0 0 1 0 21" />
      </G>
    </Svg>
  );
}

/**
 * La textura del material: metal cepillado (líneas finísimas en diagonal) y un guilloché de ondas concéntricas como el
 * de los billetes. A esta opacidad no se «ven» como dibujo: se perciben como superficie, que es lo que separa una
 * tarjeta realista de un rectángulo con degradado.
 */
export function TexturaMetal({ ancho, alto, tinta }: { ancho: number; alto: number; tinta: string }) {
  if (ancho === 0 || alto === 0) return null;
  const lineas: number[] = [];
  for (let x = -alto; x < ancho; x += 3) lineas.push(x);
  const ondas = [0.55, 0.75, 0.95, 1.15, 1.35];
  return (
    <Svg width={ancho} height={alto} style={{ position: 'absolute' }} pointerEvents="none">
      <G stroke={tinta} strokeWidth={0.5} opacity={0.05}>
        {lineas.map((x) => (
          <Line key={x} x1={x} y1={alto} x2={x + alto} y2={0} />
        ))}
      </G>
      <G stroke={tinta} strokeWidth={0.7} fill="none" opacity={0.07}>
        {ondas.map((r) => (
          <Circle key={r} cx={ancho * 1.02} cy={alto * 1.1} r={ancho * r} />
        ))}
      </G>
    </Svg>
  );
}

/**
 * El reflejo especular: una mancha de luz suave que se coloca donde está el dedo.
 *
 * Es un círculo con degradado radial (blanco en el centro, transparente en el borde); la tarjeta lo mueve, no lo
 * redibuja, así que seguir el dedo no cuesta un fotograma.
 */
export function ReflejoEspecular({ diametro }: { diametro: number }) {
  return (
    <Svg width={diametro} height={diametro} pointerEvents="none">
      <Defs>
        <RadialGradient id="reflejo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={diametro / 2} cy={diametro / 2} r={diametro / 2} fill="url(#reflejo)" />
    </Svg>
  );
}

/**
 * Un destello de cuatro puntas: el brillo que salta de un metal pulido. Dibujo puro; quién lo hace titilar es la tarjeta.
 */
export function Chispa({ tamano, color }: { tamano: number; color: string }) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24" pointerEvents="none">
      <Defs>
        <RadialGradient id="chispa-aura" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={12} cy={12} r={9} fill="url(#chispa-aura)" />
      {/* Cuatro puntas muy afiladas: el cuerpo es estrecho para que se lea como luz y no como una estrella dibujada. */}
      <Path d="M12 0 L13.3 10.7 L24 12 L13.3 13.3 L12 24 L10.7 13.3 L0 12 L10.7 10.7 Z" fill="#FFFFFF" />
    </Svg>
  );
}
