/**
 * Los tipos de la bitacora del alta, y la LISTA BLANCA de lo que se puede anotar.
 *
 * ## Que es la bitacora
 *
 * El registro de COMO se hizo el alta, no de QUE se escribio: en que pantalla estaba la persona,
 * donde toco, cuanto tardo en cada campo, cuantas veces corrigio, si pego algo, si la app se fue a
 * segundo plano mientras fotografiaba el carnet. Es la materia prima con la que el motor distingue a
 * una persona de un guion, y la ve el analista cuando un caso llega a la cola humana.
 *
 * ## Por que una lista blanca y no «todo lo que pase»
 *
 * Porque el nombre de un control es lo unico que viaja de el, y si se anotara cualquier cosa que se
 * toque acabaria viajando el texto de un boton con el nombre de un comercio, o un campo llamado como
 * el dato que contiene. Lo que no esta en estas listas NO se registra: un componente sin codigo es
 * un componente mudo, y añadirle uno es una decision que se lee aqui.
 *
 * Ninguno de los codigos puede contener `agenda`, `contact`, `phonebook` ni `rawcontacts`: el
 * servidor rechaza el lote entero (`RAW_CONTACTS_NOT_ALLOWED`) si el cuerpo los contiene, y con
 * razon —la telemetria no es sitio para la agenda de nadie—. `tipos.test.ts` lo comprueba.
 */

export const PANTALLAS = [
  'bienvenida',
  'registro',
  'verificar-contacto',
  'progreso',
  'identidad',
  'verificacion',
  'confirmar-datos',
  'perfil',
  'domicilio',
  'economia',
  'referencias',
  'permisos',
  'habitos',
  'revision',
  'ingresar',
] as const;

export type Pantalla = (typeof PANTALLAS)[number];

export const CONTROLES = [
  'crear_cuenta',
  'continuar',
  'siguiente',
  'atras',
  'enviar_codigo',
  'confirmar_codigo',
  'verificar_despues',
  'abrir_camara',
  'tomar_foto',
  'usar_carnet_de_prueba',
  'cancelar',
  'confirmar_datos',
  'guardar',
  'permitir',
  'ahora_no',
  'elegir_opcion',
  'subir_extracto',
  'subir_qr',
  'subir_factura',
  'grabar_audio',
  'omitir',
  'enviar_solicitud',
] as const;

export type Control = (typeof CONTROLES)[number];

export const CAMPOS = [
  'telefono',
  'correo',
  'pin',
  'pin_confirmacion',
  'codigo_verificacion',
  'documento_numero',
  'documento_vencimiento',
  'documento_emitido_en',
  'ocr_nombres',
  'ocr_apellidos',
  'ocr_numero',
  'ocr_nacimiento',
  'nombres',
  'apellidos',
  'nacimiento',
  'ingreso',
  'gastos',
  'ocupacion',
  'negocio',
  'direccion',
  'zona',
  'referencia_nombre',
  'referencia_telefono',
  'habito_respuesta',
  'cuota_maxima',
] as const;

export type Campo = (typeof CAMPOS)[number];

/**
 * Campos en los que PEGAR es lo esperado y no dice nada de la persona.
 *
 * iOS y Android rellenan el codigo de verificacion de golpe desde el SMS o el correo, y un PIN de
 * cuatro digitos nunca se pega. Contar eso como «pegado» convertiria la comodidad del sistema en una
 * bandera contra quien la usa.
 */
export const CAMPOS_SIN_DETECCION_DE_PEGADO: ReadonlySet<Campo> = new Set<Campo>([
  'codigo_verificacion',
  'pin',
  'pin_confirmacion',
]);

/**
 * Los campos cuyo pegado SI es una señal de identidad: son los que una persona sabe de memoria y un
 * suplantador tiene apuntados. El servidor calcula `ci_copy_paste_detected` sobre estos.
 */
export const CAMPOS_DE_IDENTIDAD: ReadonlySet<Campo> = new Set<Campo>([
  'documento_numero',
  'ocr_nombres',
  'ocr_apellidos',
  'ocr_numero',
  'ocr_nacimiento',
  'nombres',
  'apellidos',
  'nacimiento',
]);

export type Captura = 'carnet_frente' | 'carnet_reverso' | 'selfie' | 'liveness';

export type Permiso = 'camara' | 'ubicacion' | 'ubicacion_siempre' | 'contactos' | 'microfono' | 'notificaciones';

/**
 * Un evento interno. `t` son milisegundos MONOTONICOS desde el arranque de la bitacora (ver
 * `reloj.ts`); la marca de tiempo real se calcula al traducir, no al registrar.
 */
export type EventoBitacora =
  | { tipo: 'flujo'; accion: 'inicio' | 'reanudado' | 'segundo_plano' | 'primer_plano' | 'cola_recortada' | 'lote_rechazado'; t: number; detalle?: string }
  | { tipo: 'pantalla'; accion: 'entra' | 'sale' | 'atras'; pantalla: Pantalla; t: number; desdeEntradaMs?: number }
  | {
      tipo: 'toque';
      pantalla: Pantalla;
      control: Control;
      /** Posicion dentro del control, 0-1. */
      rx: number;
      ry: number;
      /** Posicion dentro de la pantalla, 0-1. */
      sx: number;
      sy: number;
      viewport: [number, number];
      t: number;
    }
  | {
      tipo: 'campo';
      pantalla: Pantalla;
      campo: Campo;
      accion: 'foco' | 'desenfoque' | 'cambio' | 'pegado' | 'correccion' | 'completo';
      duracionMs?: number;
      correcciones?: number;
      t: number;
    }
  | { tipo: 'validacion'; pantalla: Pantalla; campo?: Campo; codigo: string; t: number }
  | { tipo: 'envio'; pantalla: Pantalla; resultado: 'ok' | 'error'; codigo?: string; latenciaMs: number; t: number }
  | { tipo: 'permiso'; permiso: Permiso; decision: 'concedido' | 'denegado' | 'omitido'; t: number }
  | { tipo: 'captura'; que: Captura; accion: 'abre' | 'toma' | 'repite' | 'cancela' | 'segundo_plano'; t: number };

/** Un evento ya en la cola: con identificador propio para poder confirmarlo o reponerlo. */
export type EventoEnCola = { id: number; evento: EventoBitacora };

/** Palabras que el servidor no admite en el cuerpo de un lote. */
export const PALABRAS_PROHIBIDAS = ['rawcontacts', 'contactlist', 'phonebook', 'agenda'] as const;

/** Normaliza como lo hace el servidor: minusculas y solo letras y numeros. */
export function normalizarComoElServidor(texto: string): string {
  return texto.toLowerCase().replace(/[^a-z0-9]/g, '');
}
