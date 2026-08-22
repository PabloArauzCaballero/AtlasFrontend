/**
 * Geografia de Bolivia: los nueve departamentos y sus ciudades principales.
 *
 * ## Por que existe este archivo
 *
 * El domicilio se pedia con cuatro opciones fijas —Santa Cruz, La Paz, Cochabamba y «Otro»— y la
 * ciudad como texto libre. Eso produce «Santa Cruz de la Sierra», «santa cruz», «SCZ» y «Sta Cruz»
 * como cuatro ciudades distintas en la misma base, y ninguna consulta por zona vuelve a ser fiable.
 * Un dato que se escribe a mano no se puede agrupar despues: se puede limpiar, que es otra cosa y
 * mas cara.
 *
 * ## Por que esta en el bundle y no viene del servidor
 *
 * Porque el catalogo del servidor **esta vacio**: las tablas `catalog.*` de AtlasBackend existen
 * —`context_catalogs`, `catalog_entries`— y no tienen geografia sembrada. Mientras no la tengan,
 * traerse la lista de un endpoint que no la sirve seria peor que esto: una pantalla que depende de
 * la red para dejarte escribir donde vives.
 *
 * **Esto es un puente, no el destino.** La forma esta pensada para que sustituirlo sea cambiar de
 * donde sale la constante y nada mas: `codigo` es lo que viajaria como clave del catalogo, y las
 * pantallas ya no conocen ninguna lista.
 *
 * ## Que se manda al backend
 *
 * El `nombre`, no el `codigo`: `saveAddressPackage` recibe hoy `department` y `city` como texto
 * libre, y cambiar ese contrato es del backend. Lo que se gana igualmente es que ese texto libre
 * solo puede tomar valores de esta lista, que es justo lo que hacia falta para poder agrupar.
 */

export type Ciudad = { codigo: string; nombre: string };
export type Departamento = { codigo: string; nombre: string; ciudades: Ciudad[] };

/**
 * Los nueve departamentos, en el orden en que se nombran en Bolivia —por poblacion, no alfabetico—.
 * Un desplegable ordenado alfabeticamente pone Beni y Chuquisaca antes que Santa Cruz y La Paz, y
 * obliga a recorrer la lista entera a la mayoria de la gente.
 *
 * Las ciudades son las capitales y los municipios con poblacion suficiente para tener comercio; no
 * pretende ser el padron completo de municipios de Bolivia, que tiene mas de trescientos.
 */
export const DEPARTAMENTOS: Departamento[] = [
  {
    codigo: 'SC',
    nombre: 'Santa Cruz',
    ciudades: [
      { codigo: 'SC-SCZ', nombre: 'Santa Cruz de la Sierra' },
      { codigo: 'SC-MON', nombre: 'Montero' },
      { codigo: 'SC-WAR', nombre: 'Warnes' },
      { codigo: 'SC-LGT', nombre: 'La Guardia' },
      { codigo: 'SC-CTO', nombre: 'Cotoca' },
      { codigo: 'SC-POR', nombre: 'Portachuelo' },
      { codigo: 'SC-CAM', nombre: 'Camiri' },
      { codigo: 'SC-SIG', nombre: 'San Ignacio de Velasco' },
      { codigo: 'SC-YAP', nombre: 'Yapacaní' },
      { codigo: 'SC-MIN', nombre: 'Mineros' },
    ],
  },
  {
    codigo: 'LP',
    nombre: 'La Paz',
    ciudades: [
      { codigo: 'LP-LPZ', nombre: 'La Paz' },
      { codigo: 'LP-EAL', nombre: 'El Alto' },
      { codigo: 'LP-VIA', nombre: 'Viacha' },
      { codigo: 'LP-CAR', nombre: 'Caranavi' },
      { codigo: 'LP-ACH', nombre: 'Achocalla' },
      { codigo: 'LP-COR', nombre: 'Coroico' },
      { codigo: 'LP-PAT', nombre: 'Patacamaya' },
    ],
  },
  {
    codigo: 'CB',
    nombre: 'Cochabamba',
    ciudades: [
      { codigo: 'CB-CBB', nombre: 'Cochabamba' },
      { codigo: 'CB-QUI', nombre: 'Quillacollo' },
      { codigo: 'CB-SAC', nombre: 'Sacaba' },
      { codigo: 'CB-COL', nombre: 'Colcapirhua' },
      { codigo: 'CB-TIQ', nombre: 'Tiquipaya' },
      { codigo: 'CB-VIN', nombre: 'Vinto' },
      { codigo: 'CB-PUN', nombre: 'Punata' },
    ],
  },
  {
    codigo: 'PT',
    nombre: 'Potosí',
    ciudades: [
      { codigo: 'PT-PTS', nombre: 'Potosí' },
      { codigo: 'PT-LLA', nombre: 'Llallagua' },
      { codigo: 'PT-UYU', nombre: 'Uyuni' },
      { codigo: 'PT-VIL', nombre: 'Villazón' },
      { codigo: 'PT-TUP', nombre: 'Tupiza' },
    ],
  },
  {
    codigo: 'CH',
    nombre: 'Chuquisaca',
    ciudades: [
      { codigo: 'CH-SUC', nombre: 'Sucre' },
      { codigo: 'CH-MON', nombre: 'Monteagudo' },
      { codigo: 'CH-CAM', nombre: 'Camargo' },
    ],
  },
  {
    codigo: 'OR',
    nombre: 'Oruro',
    ciudades: [
      { codigo: 'OR-ORU', nombre: 'Oruro' },
      { codigo: 'OR-HUA', nombre: 'Huanuni' },
      { codigo: 'OR-CHA', nombre: 'Challapata' },
    ],
  },
  {
    codigo: 'TJ',
    nombre: 'Tarija',
    ciudades: [
      { codigo: 'TJ-TJA', nombre: 'Tarija' },
      { codigo: 'TJ-YAC', nombre: 'Yacuiba' },
      { codigo: 'TJ-BER', nombre: 'Bermejo' },
      { codigo: 'TJ-VIL', nombre: 'Villamontes' },
    ],
  },
  {
    codigo: 'BE',
    nombre: 'Beni',
    ciudades: [
      { codigo: 'BE-TRI', nombre: 'Trinidad' },
      { codigo: 'BE-RIB', nombre: 'Riberalta' },
      { codigo: 'BE-GUA', nombre: 'Guayaramerín' },
      { codigo: 'BE-SBO', nombre: 'San Borja' },
    ],
  },
  {
    codigo: 'PA',
    nombre: 'Pando',
    ciudades: [
      { codigo: 'PA-COB', nombre: 'Cobija' },
      { codigo: 'PA-POR', nombre: 'Porvenir' },
    ],
  },
];

/** Las ciudades de un departamento por su codigo. Vacio si no se ha elegido ninguno todavia. */
export function ciudadesDe(codigoDepartamento: string | null): Ciudad[] {
  if (!codigoDepartamento) return [];
  return DEPARTAMENTOS.find((departamento) => departamento.codigo === codigoDepartamento)?.ciudades ?? [];
}

/** El nombre que se manda al backend, a partir del codigo elegido. */
export function nombreDepartamento(codigo: string | null): string | null {
  return DEPARTAMENTOS.find((departamento) => departamento.codigo === codigo)?.nombre ?? null;
}

export function nombreCiudad(codigoDepartamento: string | null, codigoCiudad: string | null): string | null {
  return ciudadesDe(codigoDepartamento).find((ciudad) => ciudad.codigo === codigoCiudad)?.nombre ?? null;
}
