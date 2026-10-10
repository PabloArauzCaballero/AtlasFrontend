/**
 * La carga masiva de SUCURSALES desde Excel: de las celdas de la hoja a la fila que se envía.
 *
 * Es el porte de `AtlasERPFrontend/lib/importacionExcel.ts` acotado a lo que usa
 * `ImportarSucursalesModal` (la web lo comparte con todos sus listados; aquí sólo se importan
 * sucursales). Las reglas son las mismas:
 *  - una fila por CAJA; las filas que repiten «Sucursal» son la misma sucursal, con sus datos
 *    básicos tomados de la primera;
 *  - la cabecera de la hoja es la etiqueta del formulario («Sucursal *»), pero al LEER se acepta
 *    también la etiqueta sola y el nombre técnico, para que las plantillas viejas sigan cargando;
 *  - un select admite su código o el nombre que se lee en pantalla; al backend va el código.
 */
import { fechaDeSerieExcel, type HojaExtra } from './excel';

export interface OpcionDeCampo {
  value: string;
  label: string;
}

/** El `ActionField` de la web, con sólo lo que usan los campos de esta importación. */
export interface CampoImportable {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date';
  valueKind?: 'number';
  optional?: boolean;
  required?: boolean;
  options?: OpcionDeCampo[];
  tooltip?: string;
  placeholder?: string;
  defaultValue?: string;
}

export interface LineasSpec {
  name: string;
  clave: string;
  claveLabel: string;
  nombreLinea: string;
  fields: CampoImportable[];
  ejemploClave?: string;
  claveEnPayload?: string;
}

export interface RegistroPreparado {
  numero: number;
  filasHoja: number[];
  etiqueta: string;
  crudo: Record<string, string>;
  payload: Record<string, unknown>;
  errores: string[];
  estado: 'pendiente' | 'creada' | 'fallida';
  detalle?: string;
}

/** Las ciudades del catálogo estático del ERP (`lib/catalogs.ts`, `cityOptions`). */
export const CIUDADES: OpcionDeCampo[] = [
  { label: 'Santa Cruz de la Sierra', value: 'Santa Cruz de la Sierra' },
  { label: 'La Paz', value: 'La Paz' },
  { label: 'El Alto', value: 'El Alto' },
  { label: 'Cochabamba', value: 'Cochabamba' },
  { label: 'Sucre', value: 'Sucre' },
  { label: 'Oruro', value: 'Oruro' },
  { label: 'Potosí', value: 'Potosí' },
  { label: 'Tarija', value: 'Tarija' },
  { label: 'Trinidad', value: 'Trinidad' },
  { label: 'Cobija', value: 'Cobija' },
  { label: 'Montero', value: 'Montero' },
  { label: 'Quillacollo', value: 'Quillacollo' },
  { label: 'Otra', value: 'Otra' },
];

/** Los datos de la sucursal, copiados de `ImportarSucursalesModal` (`CAMPOS`). */
export const CAMPOS_SUCURSAL: CampoImportable[] = [
  {
    name: 'city',
    label: 'Ciudad',
    type: 'select',
    optional: true,
    options: CIUDADES,
    tooltip: 'Ciudad del local. Se elige de la lista de «Valores permitidos»: escrita a mano, «Sta. Cruz» y «Santa Cruz» serían dos plazas.',
  },
  { name: 'address', label: 'Dirección', optional: true, tooltip: 'Dirección del local: calle, zona y referencia.', placeholder: 'Av. Principal #100, Equipetrol' },
  {
    name: 'cantidadCajas',
    label: 'Cantidad de cajas',
    type: 'number',
    valueKind: 'number',
    optional: true,
    tooltip: 'Cuántas cajas o mostradores cobran en el local. Si lo dejas vacío se crea una. Se llaman Caja 1, Caja 2…',
    placeholder: '2',
  },
];

/** Las líneas: una fila por caja (`LINEAS` de la web). */
export const LINEAS_SUCURSAL: LineasSpec = {
  name: 'cajas',
  clave: 'sucursal',
  claveLabel: 'Sucursal',
  claveEnPayload: 'name',
  nombreLinea: 'caja',
  ejemploClave: 'Sucursal Equipetrol',
  fields: [
    { name: 'terminalAlias', label: 'Caja', optional: true, tooltip: 'Nombre corto para reconocer la caja en la lista. Ej.: Caja 1.', placeholder: 'Caja 1' },
    {
      name: 'terminalSerial',
      label: 'Serial de la caja',
      optional: true,
      tooltip: 'Opcional: el número de serie de tu terminal, si quieres que el QR lo use. Vacío = Atlas usa «Cantidad de cajas».',
      placeholder: 'SN-00042',
    },
  ],
};

export const TOPE_FILAS = 500;

/** Sin tildes, sin mayúsculas y sin espacios de sobra. */
export function plano(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function obligatoriosDe(campos: CampoImportable[]): CampoImportable[] {
  return campos.filter((campo) => campo.required && !campo.optional);
}

/** Un ejemplo por columna. El de un select es el NOMBRE de su primera opción, nunca su código. */
export function ejemploDe(field: CampoImportable): string {
  if (field.defaultValue !== undefined && field.defaultValue !== '') return String(field.defaultValue);
  if (field.options?.length) {
    const primera = field.options[0];
    return primera ? primera.label || primera.value : '';
  }
  if (field.type === 'date') return '2026-01-31';
  if (field.type === 'number') return '0';
  return field.placeholder ?? '';
}

function unaOpcion(valor: string, campo: CampoImportable): string | null {
  const opciones = campo.options ?? [];
  const exacto = opciones.find((opcion) => opcion.value === valor);
  if (exacto) return exacto.value;
  const porNombre = opciones.find((opcion) => plano(opcion.label) === plano(valor));
  if (porNombre) return porNombre.value;
  const porCaja = opciones.find((opcion) => plano(opcion.value) === plano(valor));
  if (porCaja) return porCaja.value;
  const porCodigo = opciones.find((opcion) => plano(opcion.label.split('—')[0] ?? '') === plano(valor));
  return porCodigo ? porCodigo.value : null;
}

export function valorDeOpcion(valor: string, campo: CampoImportable): string | null {
  if (!campo.options?.length) return valor;
  return unaOpcion(valor, campo);
}

/** Lo que Excel entrega distinto de lo que el formulario entregaría. */
export function normalizar(valor: string, campo: CampoImportable): string {
  if (campo.options?.length) return valorDeOpcion(valor, campo) ?? valor;
  if (campo.type === 'date' && /^\d{5}(\.\d+)?$/.test(valor)) return fechaDeSerieExcel(Number(valor));
  // Excel escribe los decimales con coma en configuración regional española; el backend pide punto.
  if ((campo.type === 'number' || campo.valueKind === 'number') && /^-?\d+,\d+$/.test(valor)) return valor.replace(',', '.');
  return valor;
}

/** Lo mismo que `formDataToPayload` + `payloadDefinitions` hacen con estos campos en la web. */
export function payloadDeFila(crudo: Record<string, string>, campos: CampoImportable[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const campo of campos) {
    const valor = (crudo[campo.name] ?? '').trim();
    if (valor === '') continue;
    const texto = normalizar(valor, campo).trim();
    if (campo.optional && texto === '') continue;
    payload[campo.name] = campo.valueKind === 'number' ? Number(texto) : texto;
  }
  return payload;
}

export function erroresDeFila(crudo: Record<string, string>, campos: CampoImportable[], obligatorios: CampoImportable[], prefijo = ''): string[] {
  const errores = obligatorios.filter((campo) => !(crudo[campo.name] ?? '').trim()).map((campo) => `${prefijo}Falta «${campo.label}»`);
  for (const campo of campos) {
    const valor = (crudo[campo.name] ?? '').trim();
    if (!valor) continue;
    const normalizado = normalizar(valor, campo);
    if ((campo.type === 'number' || campo.valueKind === 'number') && !Number.isFinite(Number(normalizado))) {
      errores.push(`${prefijo}«${campo.label}» debe ser un número finito`);
    }
    if (!campo.options?.length) continue;
    if (valorDeOpcion(valor, campo) === null) {
      const ejemplos = campo.options.slice(0, 3).map((opcion) => opcion.label).join(', ');
      errores.push(`${prefijo}«${campo.label}» no admite «${valor}» (p. ej.: ${ejemplos})`);
    }
  }
  return errores;
}

/** Un registro por GRUPO de filas: las que repiten la columna clave. Manda la primera de cada grupo. */
export function agrupar(
  filas: Record<string, string>[],
  lineas: LineasSpec,
  campos: CampoImportable[],
  obligatorios: CampoImportable[],
  camposLinea: CampoImportable[],
  obligatoriosLinea: CampoImportable[],
): RegistroPreparado[] {
  const grupos = new Map<string, { numero: number; crudo: Record<string, string> }[]>();
  const sinClave: RegistroPreparado[] = [];

  filas.forEach((crudo, indice) => {
    const numero = indice + 2;
    const clave = (crudo[lineas.clave] ?? '').trim();
    if (!clave) {
      sinClave.push({
        numero,
        filasHoja: [numero],
        etiqueta: '—',
        crudo,
        payload: {},
        errores: [`Falta «${lineas.claveLabel}»: sin ella no se sabe a qué registro pertenece la fila`],
        estado: 'pendiente',
      });
      return;
    }
    const actual = grupos.get(clave) ?? [];
    actual.push({ numero, crudo });
    grupos.set(clave, actual);
  });

  const registros = [...grupos.entries()].map(([clave, miembros]): RegistroPreparado => {
    const primera = miembros[0]!;
    const errores = erroresDeFila(primera.crudo, campos, obligatorios);
    const cuerpo = miembros.map((miembro) => {
      errores.push(...erroresDeFila(miembro.crudo, camposLinea, obligatoriosLinea, `Fila ${miembro.numero}: `));
      return payloadDeFila(miembro.crudo, camposLinea);
    });
    return {
      numero: primera.numero,
      filasHoja: miembros.map((miembro) => miembro.numero),
      etiqueta: clave,
      crudo: primera.crudo,
      payload: {
        ...payloadDeFila(primera.crudo, campos),
        ...(lineas.claveEnPayload ? { [lineas.claveEnPayload]: clave } : {}),
        [lineas.name]: cuerpo,
      },
      errores,
      estado: 'pendiente',
    };
  });

  return [...registros, ...sinClave].sort((a, b) => a.numero - b.numero);
}

/* ───────────────── La plantilla que una persona entiende ───────────────── */

export interface ColumnaPlantilla {
  nombre: string;
  cabecera: string;
  etiqueta: string;
  obligatoria: boolean;
  ayuda: string;
  campo?: CampoImportable;
}

export function columnasPlantilla(campos: CampoImportable[], camposLinea: CampoImportable[] = [], lineas?: Pick<LineasSpec, 'clave' | 'claveLabel'>): ColumnaPlantilla[] {
  const base: Omit<ColumnaPlantilla, 'cabecera'>[] = [];
  if (lineas) {
    base.push({ nombre: lineas.clave, etiqueta: lineas.claveLabel, obligatoria: true, ayuda: 'Las filas que repiten este valor son el mismo registro.' });
  }
  for (const campo of [...campos, ...camposLinea]) {
    base.push({ nombre: campo.name, etiqueta: campo.label, obligatoria: Boolean(campo.required && !campo.optional), ayuda: campo.tooltip ?? '', campo });
  }
  const usadas = new Map<string, number>();
  for (const columna of base) usadas.set(plano(columna.etiqueta), (usadas.get(plano(columna.etiqueta)) ?? 0) + 1);
  return base.map((columna) => {
    const repetida = (usadas.get(plano(columna.etiqueta)) ?? 0) > 1;
    const texto = repetida ? `${columna.etiqueta} (${columna.nombre})` : columna.etiqueta;
    return { ...columna, cabecera: columna.obligatoria ? `${texto} *` : texto };
  });
}

function sinMarca(texto: string): string {
  return plano(texto.replace(/\*/g, ''));
}

/** Las filas con las claves técnicas, sea cual sea el nombre con que vino cada columna. */
export function aClavesTecnicas(
  tabla: { cabeceras: string[]; filas: Record<string, string>[] },
  columnas: ColumnaPlantilla[],
): { cabeceras: string[]; filas: Record<string, string>[] } {
  const indice = new Map<string, string>();
  for (const columna of columnas) {
    for (const alias of [columna.cabecera, columna.etiqueta, columna.nombre]) indice.set(sinMarca(alias), columna.nombre);
  }
  const traducir = (cabecera: string) => indice.get(sinMarca(cabecera)) ?? cabecera;
  return {
    cabeceras: tabla.cabeceras.map(traducir),
    filas: tabla.filas.map((fila) => Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [traducir(clave), valor]))),
  };
}

export function hojasDeAyuda(columnas: ColumnaPlantilla[], ejemplo: (campo: CampoImportable) => string = ejemploDe): HojaExtra[] {
  const instrucciones: string[][] = [
    ['Cómo llenar la hoja «Plantilla»'],
    ['1. Cada fila de la hoja «Plantilla» es un registro. No cambies los títulos de la primera fila.'],
    ['2. Las columnas con asterisco (*) son obligatorias; sin ellas la fila no se crea.'],
    ['3. En las columnas con lista, escribe el nombre tal como aparece en «Valores permitidos».'],
    ['4. Fechas: año-mes-día (2026-01-31). Decimales: con punto o con coma. Varios valores: separados por coma.'],
    ['5. Borra la fila de ejemplo antes de subir el archivo. Antes de crear nada verás qué filas están completas.'],
    [],
    ['Columna', 'Obligatoria', 'Qué poner', 'Ejemplo'],
    ...columnas.map((c) => [c.cabecera.replace(/ \*$/, ''), c.obligatoria ? 'Sí' : 'No', c.ayuda, c.campo ? ejemplo(c.campo) : '']),
  ];
  const conLista = columnas.filter((c) => c.campo?.options?.length);
  const alto = Math.max(0, ...conLista.map((c) => c.campo?.options?.length ?? 0));
  const valores: string[][] = conLista.length
    ? [conLista.map((c) => c.cabecera.replace(/ \*$/, '')), ...Array.from({ length: alto }, (_, fila) => conLista.map((c) => c.campo?.options?.[fila]?.label ?? ''))]
    : [['Esta plantilla no tiene columnas con lista de valores.']];
  return [
    { nombre: 'Instrucciones', filas: instrucciones },
    { nombre: 'Valores permitidos', filas: valores },
  ];
}

/* ───────────────── Lo que hace el modal de la web con estas piezas ───────────────── */

export const COLUMNAS_SUCURSALES = columnasPlantilla(CAMPOS_SUCURSAL, LINEAS_SUCURSAL.fields, LINEAS_SUCURSAL);

/** Las filas de la plantilla: dos con la MISMA clave, para enseñar que una sucursal con dos cajas son dos filas. */
export function filasDeEjemplo(): string[][] {
  const clave = LINEAS_SUCURSAL.ejemploClave ?? 'DOC-001';
  const cabecera = CAMPOS_SUCURSAL.map(ejemploDe);
  const vacia = CAMPOS_SUCURSAL.map(() => '');
  const lineas = LINEAS_SUCURSAL.fields.map(ejemploDe);
  return [
    [clave, ...cabecera, ...lineas],
    [clave, ...vacia, ...lineas],
  ];
}

export const NOMBRE_PLANTILLA = 'plantilla-sucursales.xlsx';

/**
 * De la tabla leída a los registros que se van a crear, o el motivo por el que el archivo no sirve.
 * Es `cargar` del modal de la web sin la pantalla.
 */
export function prepararImportacion(tabla: { cabeceras: string[]; filas: Record<string, string>[] }): { filas: RegistroPreparado[]; error: string } {
  const traducida = aClavesTecnicas(tabla, COLUMNAS_SUCURSALES);
  if (!traducida.filas.length) return { filas: [], error: 'El archivo no trae ninguna fila con datos debajo de las cabeceras.' };
  const obligatorios = obligatoriosDe(CAMPOS_SUCURSAL);
  const obligatoriosLinea = obligatoriosDe(LINEAS_SUCURSAL.fields);
  const exigidas = [LINEAS_SUCURSAL.clave, ...obligatorios.map((campo) => campo.name), ...obligatoriosLinea.map((campo) => campo.name)];
  const faltantes = exigidas
    .filter((nombre) => !traducida.cabeceras.includes(nombre))
    .map((nombre) => COLUMNAS_SUCURSALES.find((c) => c.nombre === nombre)?.etiqueta ?? nombre);
  if (faltantes.length) {
    return { filas: [], error: `Al archivo le faltan columnas obligatorias: ${faltantes.join(', ')}. Descarga la plantilla y vuelve a intentarlo.` };
  }
  return {
    filas: agrupar(traducida.filas.slice(0, TOPE_FILAS), LINEAS_SUCURSAL, CAMPOS_SUCURSAL, obligatorios, LINEAS_SUCURSAL.fields, obligatoriosLinea),
    error: '',
  };
}

/** «N columnas · M obligatorias · hasta 500 filas por archivo», como bajo el botón de la web. */
export function resumenDeColumnas(): string {
  const obligatorias = obligatoriosDe(CAMPOS_SUCURSAL).length + obligatoriosDe(LINEAS_SUCURSAL.fields).length + 1;
  return `${COLUMNAS_SUCURSALES.length} columnas · ${obligatorias} obligatorias · hasta ${TOPE_FILAS} filas por archivo`;
}
