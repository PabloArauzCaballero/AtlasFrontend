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

/* ------------------------------------------------------------------ zonas */

export type Zona = { codigo: string; nombre: string };

/**
 * Las zonas de cada ciudad.
 *
 * ## Por qué deja de ser texto libre
 *
 * Es el mismo argumento que ya cerró departamento y ciudad, un nivel más abajo: «Equipetrol»,
 * «equipetrol», «Eqipetrol» y «Barrio Equipetrol Norte» son cuatro zonas distintas para una consulta
 * y la misma para una persona. Y aquí duele más que en la ciudad, porque la zona es el nivel al que
 * se decide dónde abrir un comercio, a qué zonas llega la cobranza y qué zonas concentran la mora.
 *
 * ## Qué es una «zona» aquí
 *
 * El DISTRITO municipal, que es la división oficial y la que se puede cruzar con datos del censo y
 * del municipio — más los nombres de uso corriente que la gente dice de verdad al dar su dirección
 * («Equipetrol», «Plan 3000»), porque un catálogo que sólo dice «Distrito 8» obliga a saber en qué
 * distrito vive uno, y casi nadie lo sabe.
 *
 * Santa Cruz de la Sierra tiene quince distritos municipales; La Paz, nueve macrodistritos; El Alto,
 * catorce distritos. Esa es la base, y sobre ella van los nombres corrientes.
 *
 * ## Por qué siempre hay «Otra zona»
 *
 * Porque el catálogo no puede cubrir los barrios de todas las ciudades del país sin volverse
 * inmanejable, y sin escape la persona elegiría una zona vecina cualquiera con tal de continuar: un
 * dato equivocado ensucia más que un «otra» honesto, que además se puede contar y dice qué le falta
 * al catálogo.
 *
 * **Esto es un puente, igual que las ciudades**: el catálogo de verdad se siembra en el backend
 * (`20260823030000-seed-geography-catalog`), y esta lista es lo que la pantalla usa mientras el
 * endpoint que lo sirva no exista. La forma es la misma para que cambiar de origen no toque a nadie.
 */
const ZONAS: Record<string, Zona[]> = {
  'SC-SCZ': [
    { codigo: 'SC-SCZ-CENTRO', nombre: 'Centro (Casco Viejo)' },
    { codigo: 'SC-SCZ-EQUIPETROL', nombre: 'Equipetrol' },
    { codigo: 'SC-SCZ-EQUIPETROL-N', nombre: 'Equipetrol Norte' },
    { codigo: 'SC-SCZ-URUBO', nombre: 'Urubó' },
    { codigo: 'SC-SCZ-SIRARI', nombre: 'Sirari' },
    { codigo: 'SC-SCZ-LAS-PALMAS', nombre: 'Las Palmas' },
    { codigo: 'SC-SCZ-POLANCO', nombre: 'Polanco' },
    { codigo: 'SC-SCZ-HAMACAS', nombre: 'Hamacas' },
    { codigo: 'SC-SCZ-EL-BAJIO', nombre: 'El Bajío' },
    { codigo: 'SC-SCZ-PLAN-3000', nombre: 'Plan 3000 (Distrito 8)' },
    { codigo: 'SC-SCZ-VILLA-1M', nombre: 'Villa 1ro de Mayo (Distrito 7)' },
    { codigo: 'SC-SCZ-PAMPA-ISLA', nombre: 'Pampa de la Isla' },
    { codigo: 'SC-SCZ-LOS-LOTES', nombre: 'Los Lotes' },
    { codigo: 'SC-SCZ-LA-CUCHILLA', nombre: 'La Cuchilla' },
    { codigo: 'SC-SCZ-NUEVO-PALMAR', nombre: 'Nuevo Palmar' },
    { codigo: 'SC-SCZ-SATELITE', nombre: 'Ciudad Satélite' },
    { codigo: 'SC-SCZ-GUARACHI', nombre: 'Guaracachi' },
    { codigo: 'SC-SCZ-NORTE', nombre: 'Zona Norte' },
    { codigo: 'SC-SCZ-SUR', nombre: 'Zona Sur' },
    { codigo: 'SC-SCZ-ESTE', nombre: 'Zona Este' },
    { codigo: 'SC-SCZ-OESTE', nombre: 'Zona Oeste' },
  ],
  'LP-LPZ': [
    { codigo: 'LP-LPZ-CENTRO', nombre: 'Centro' },
    { codigo: 'LP-LPZ-SUR', nombre: 'Zona Sur' },
    { codigo: 'LP-LPZ-CALACOTO', nombre: 'Calacoto' },
    { codigo: 'LP-LPZ-SAN-MIGUEL', nombre: 'San Miguel' },
    { codigo: 'LP-LPZ-OBRAJES', nombre: 'Obrajes' },
    { codigo: 'LP-LPZ-ACHUMANI', nombre: 'Achumani' },
    { codigo: 'LP-LPZ-IRPAVI', nombre: 'Irpavi' },
    { codigo: 'LP-LPZ-SOPOCACHI', nombre: 'Sopocachi' },
    { codigo: 'LP-LPZ-MIRAFLORES', nombre: 'Miraflores' },
    { codigo: 'LP-LPZ-COTAHUMA', nombre: 'Cotahuma' },
    { codigo: 'LP-LPZ-MAX-PAREDES', nombre: 'Max Paredes' },
    { codigo: 'LP-LPZ-PERIFERICA', nombre: 'Periférica' },
    { codigo: 'LP-LPZ-SAN-ANTONIO', nombre: 'San Antonio' },
    { codigo: 'LP-LPZ-MALLASA', nombre: 'Mallasa' },
    { codigo: 'LP-LPZ-EL-TEJAR', nombre: 'El Tejar' },
    { codigo: 'LP-LPZ-VILLA-FATIMA', nombre: 'Villa Fátima' },
  ],
  'LP-EAL': [
    { codigo: 'LP-EAL-CEJA', nombre: 'La Ceja' },
    { codigo: 'LP-EAL-VILLA-DOLORES', nombre: 'Villa Dolores' },
    { codigo: 'LP-EAL-16-JULIO', nombre: '16 de Julio' },
    { codigo: 'LP-EAL-SANTIAGO-II', nombre: 'Santiago II' },
    { codigo: 'LP-EAL-RIO-SECO', nombre: 'Río Seco' },
    { codigo: 'LP-EAL-SENKATA', nombre: 'Senkata' },
    { codigo: 'LP-EAL-VILLA-ADELA', nombre: 'Villa Adela' },
    { codigo: 'LP-EAL-ALTO-LIMA', nombre: 'Alto Lima' },
    { codigo: 'LP-EAL-BALLIVIAN', nombre: 'Villa Ballivián' },
    { codigo: 'LP-EAL-SAN-ROQUE', nombre: 'San Roque' },
  ],
  'CB-CBB': [
    { codigo: 'CB-CBB-CENTRO', nombre: 'Centro' },
    { codigo: 'CB-CBB-CALA-CALA', nombre: 'Cala Cala' },
    { codigo: 'CB-CBB-QUERU-QUERU', nombre: 'Queru Queru' },
    { codigo: 'CB-CBB-RECOLETA', nombre: 'La Recoleta' },
    { codigo: 'CB-CBB-SARCO', nombre: 'Sarco' },
    { codigo: 'CB-CBB-TUPURAYA', nombre: 'Tupuraya' },
    { codigo: 'CB-CBB-MUYURINA', nombre: 'Muyurina' },
    { codigo: 'CB-CBB-TEMPORAL', nombre: 'Temporal' },
    { codigo: 'CB-CBB-VILLA-BUSCH', nombre: 'Villa Busch' },
    { codigo: 'CB-CBB-JAIHUAYCO', nombre: 'Jaihuayco' },
    { codigo: 'CB-CBB-ALALAY', nombre: 'Alalay' },
    { codigo: 'CB-CBB-SUR', nombre: 'Zona Sur' },
  ],
  'CH-SUC': [
    { codigo: 'CH-SUC-CENTRO', nombre: 'Centro histórico' },
    { codigo: 'CH-SUC-RECOLETA', nombre: 'La Recoleta' },
    { codigo: 'CH-SUC-ALTO-DELICIAS', nombre: 'Alto Delicias' },
    { codigo: 'CH-SUC-GARCILAZO', nombre: 'Garcilazo' },
    { codigo: 'CH-SUC-SAN-MATIAS', nombre: 'San Matías' },
    { codigo: 'CH-SUC-LAJASTAMBO', nombre: 'Lajastambo' },
  ],
  'TJ-TJA': [
    { codigo: 'TJ-TJA-CENTRO', nombre: 'Centro' },
    { codigo: 'TJ-TJA-SAN-ROQUE', nombre: 'San Roque' },
    { codigo: 'TJ-TJA-LAS-PANOSAS', nombre: 'Las Panosas' },
    { codigo: 'TJ-TJA-EL-MOLINO', nombre: 'El Molino' },
    { codigo: 'TJ-TJA-AEROPUERTO', nombre: 'Aeropuerto' },
  ],
  'OR-ORU': [
    { codigo: 'OR-ORU-CENTRO', nombre: 'Centro' },
    { codigo: 'OR-ORU-SUR', nombre: 'Zona Sur' },
    { codigo: 'OR-ORU-NORTE', nombre: 'Zona Norte' },
    { codigo: 'OR-ORU-ESTE', nombre: 'Zona Este' },
  ],
  'PT-PTS': [
    { codigo: 'PT-PTS-CENTRO', nombre: 'Centro' },
    { codigo: 'PT-PTS-SAN-CLEMENTE', nombre: 'San Clemente' },
    { codigo: 'PT-PTS-VILLA-COPACABANA', nombre: 'Villa Copacabana' },
    { codigo: 'PT-PTS-PAILAVIRI', nombre: 'Pailaviri' },
  ],
};

/** Se ofrece siempre, en todas las ciudades. Ver la nota de arriba. */
export const OTRA_ZONA: Zona = { codigo: 'OTRA', nombre: 'Otra zona' };

/**
 * Las zonas de una ciudad. Vacío si no hay ciudad elegida todavía; con sólo «Otra zona» si la
 * ciudad aún no tiene catálogo — que es honesto y deja pasar a la persona.
 */
export function zonasDe(codigoCiudad: string | null): Zona[] {
  if (!codigoCiudad) return [];
  return [...(ZONAS[codigoCiudad] ?? []), OTRA_ZONA];
}

export function nombreZona(codigoCiudad: string | null, codigoZona: string | null): string | null {
  if (!codigoZona) return null;
  return zonasDe(codigoCiudad).find((zona) => zona.codigo === codigoZona)?.nombre ?? null;
}
