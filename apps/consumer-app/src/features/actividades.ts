/**
 * A qué se dedica la persona, de catálogo cerrado.
 *
 * ## Por qué deja de ser texto libre
 *
 * El campo pedía «comercio, salud, transporte…» y aceptaba cualquier cosa. Lo que entraba era
 * «comercio», «Comercio», «comerciante», «vendo ropa» y «negocio propio» para la misma actividad, y
 * una cartera de crédito que no puede contar cuántos clientes tiene por rubro no puede decidir en
 * qué rubro conviene crecer ni cuál se está deteriorando. Es el mismo argumento que ya justificaba
 * el catálogo de ciudades en `geografia.ts`: **un dato que se escribe a mano no se agrupa después**.
 *
 * ## De dónde salen los rubros
 *
 * Son las secciones de la CAEB —la clasificación de actividades económicas de Bolivia, que sigue a
 * la CIIU— agrupadas y renombradas a como las diría el titular. La sección oficial dice «Comercio al
 * por mayor y al por menor; reparación de vehículos automotores y motocicletas»; aquí dice «Comercio
 * y ventas», y el `codigo` conserva la letra de la sección para que el día que Riesgo quiera cruzar
 * con la CAEB no haya que adivinar la correspondencia.
 *
 * ## Por qué hay «Otra actividad»
 *
 * Porque un catálogo cerrado sin escape obliga a mentir: quien no se reconoce en ninguna elige la
 * que menos se aleja y ensucia el dato de esa. Una fila «otro» honesta se puede contar y, si crece,
 * dice que al catálogo le falta un rubro.
 */
import type { IconName } from '../ui/icons';

export type Actividad = { codigo: string; nombre: string; detalle?: string; icono: IconName };

/**
 * Ordenadas por cuántos titulares se reconocen en ellas, no por la letra de la CAEB. El comercio
 * minorista y el transporte son la mayoría de la cartera de un crédito de consumo en Bolivia; poner
 * «Agricultura» primero porque es la sección A obliga a recorrer la lista entera a casi todo el
 * mundo.
 */
export const ACTIVIDADES: Actividad[] = [
  { codigo: 'G-COMERCIO', nombre: 'Comercio y ventas', detalle: 'Tienda, puesto de mercado, venta por catálogo.', icono: 'comercio' },
  { codigo: 'H-TRANSPORTE', nombre: 'Transporte', detalle: 'Taxi, micro, camión, mensajería.', icono: 'transporte' },
  { codigo: 'I-GASTRONOMIA', nombre: 'Comida y hospedaje', detalle: 'Restaurante, pensión, alojamiento.', icono: 'supermercado' },
  { codigo: 'F-CONSTRUCCION', nombre: 'Construcción', detalle: 'Albañilería, electricidad, plomería, acabados.', icono: 'hogar' },
  { codigo: 'C-MANUFACTURA', nombre: 'Manufactura y talleres', detalle: 'Costura, carpintería, metalmecánica, panadería.', icono: 'ropa' },
  { codigo: 'Q-SALUD', nombre: 'Salud', detalle: 'Consultorio, farmacia, laboratorio, enfermería.', icono: 'salud' },
  { codigo: 'P-EDUCACION', nombre: 'Educación', detalle: 'Colegio, instituto, clases particulares.', icono: 'educacion' },
  { codigo: 'S-SERVICIOS', nombre: 'Servicios personales', detalle: 'Peluquería, limpieza, reparaciones, cuidado.', icono: 'servicios' },
  { codigo: 'J-TECNOLOGIA', nombre: 'Tecnología y comunicaciones', detalle: 'Informática, celulares, internet, publicidad.', icono: 'celulares' },
  { codigo: 'M-PROFESIONAL', nombre: 'Servicios profesionales', detalle: 'Contabilidad, derecho, arquitectura, consultoría.', icono: 'documento' },
  { codigo: 'A-AGROPECUARIA', nombre: 'Agricultura y ganadería', detalle: 'Cultivo, ganado, avicultura, pesca.', icono: 'chispa' },
  { codigo: 'K-FINANCIERO', nombre: 'Servicios financieros', detalle: 'Seguros, cambio, cobranza.', icono: 'billetera' },
  { codigo: 'O-PUBLICO', nombre: 'Sector público', detalle: 'Administración pública, policía, fuerzas armadas.', icono: 'escudo' },
  { codigo: 'B-MINERIA', nombre: 'Minería e hidrocarburos', detalle: 'Extracción, cooperativa minera, petróleo.', icono: 'grafico' },
  { codigo: 'D-ENERGIA', nombre: 'Energía, agua y residuos', detalle: 'Electricidad, gas, agua, saneamiento.', icono: 'electronica' },
  { codigo: 'T-HOGAR', nombre: 'Trabajo en casa particular', detalle: 'Empleo doméstico, cuidado de personas.', icono: 'hogar' },
  { codigo: 'Z-OTRO', nombre: 'Otra actividad', detalle: 'Ninguna de las anteriores.', icono: 'lista' },
];

/** Para el `SelectField`, que habla de `valor` y `etiqueta`. */
export const OPCIONES_ACTIVIDAD = ACTIVIDADES.map((actividad) => ({
  valor: actividad.codigo,
  etiqueta: actividad.nombre,
  detalle: actividad.detalle,
}));

export function nombreActividad(codigo: string | null): string | null {
  if (!codigo) return null;
  return ACTIVIDADES.find((actividad) => actividad.codigo === codigo)?.nombre ?? null;
}
