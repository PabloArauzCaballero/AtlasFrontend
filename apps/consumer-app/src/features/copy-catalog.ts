/**
 * Los textos sueltos de la app que negocio edita en el portal (superficie `copy`), con su valor de fábrica.
 *
 * ## Una sola fuente
 *
 * Cada pantalla pide su texto por CLAVE (`useCopy`), y el valor de fábrica vive aquí. Eso da dos cosas:
 * el texto de respaldo no está repartido por veinte pantallas, y el compilador impide pedir una clave que
 * no existe. El portal recibe estas mismas claves sembradas por una migración del backend; si se añade
 * una aquí hay que sembrarla allí (y si se retira la pieza del portal, la app usa la de aquí).
 *
 * ## Qué entra y qué no
 *
 * Entra el texto que le habla a la persona sobre el producto y que alguien de negocio querría ajustar sin
 * publicar en las tiendas: estados vacíos, avisos, promesas. NO entran los mensajes de error de red, los
 * rótulos de botones que son mecánica de la interfaz ni los textos con datos intercalados.
 *
 * Los textos que dicen lo que el sistema HACE hoy (avisos que llegan, plazos) son promesas: quien los edite
 * en el portal responde de que sigan siendo verdad. `__tests__/textos-verdaderos.test.ts` revisa los de aquí.
 */
import { AVISO_SIN_RECORDATORIOS, AVISOS_QUE_LLEGAN_RESUMEN } from './avisos-copy';
import { AVISO_DEMOSTRACION, AVISO_PLAN_SIMULADO } from './demo-copy';
import { BLOCKER_COPY, LIFECYCLE_COPY, SECTION_LABEL } from './onboarding-map';

export type CopyEntry = {
  /** La pantalla a la que pertenece, para agrupar en el portal. */
  pantalla: string;
  /** Dónde sale exactamente, dicho para quien edita. */
  donde: string;
  /** Encabezado, si el texto lo lleva. */
  titulo?: string;
  texto: string;
};

export const COPY = {
  'inicio.calculando': {
    pantalla: 'Inicio',
    donde: 'Bajo «Tu línea», mientras la política aún no la resuelve',
    texto: 'Todavía estamos calculando tu línea. En cuanto la política la resuelva, aparecerá aquí.',
  },
  'inicio.pagos.vacio': {
    pantalla: 'Inicio',
    donde: 'Tarjeta «Tus pagos», cuando no hay una compra activa',
    texto: 'Cuando tengas una compra activa, aquí aparece tu próxima cuota y el QR bancario del comercio donde pagarla.',
  },
  'pagos.subtitulo': {
    pantalla: 'Pagos',
    donde: 'Bajo el título «Tus pagos»',
    texto: 'Agrupados por el comercio donde compraste.',
  },
  'pagos.vacio': {
    pantalla: 'Pagos',
    donde: 'Cuando todavía no hay cuotas que mostrar',
    titulo: 'Todavía no hay cuotas que mostrar',
    texto: 'Cuando compres con Atlas, aquí verás en qué día te toca cada pago.',
  },
  'escanear.camara': {
    pantalla: 'Escanear',
    donde: 'Antes de pedir el permiso de la cámara',
    titulo: 'Necesitamos tu cámara',
    texto: 'Solo la usamos mientras escaneas. No grabamos video ni guardamos imágenes.',
  },
  'escanear.qr.no_reconocido': {
    pantalla: 'Escanear',
    donde: 'Cuando el QR escaneado no es de Atlas',
    titulo: 'Este QR no es de Atlas',
    texto: 'Pide al comercio el código QR de Atlas que está pegado en la caja. El QR del banco se usa después.',
  },
  'escanear.qr.revocado': {
    pantalla: 'Escanear',
    donde: 'Cuando el QR fue dado de baja',
    titulo: 'QR dado de baja',
    texto: 'Este código fue revocado por seguridad. Pide al comercio el código vigente.',
  },
  'escanear.qr.vencido': {
    pantalla: 'Escanear',
    donde: 'Cuando el QR venció',
    titulo: 'QR vencido',
    texto: 'Este código ya no está activo. Pide al comercio el código vigente.',
  },
  'escanear.qr.sin_conexion': {
    pantalla: 'Escanear',
    donde: 'Cuando el QR se leyó bien pero el servicio no respondió (red caída, redespliegue)',
    titulo: 'Sin conexión',
    texto: 'Leímos el código, pero no pudimos confirmarlo con Atlas. Revisa tu conexión y vuelve a apuntar al QR, o escríbelo a mano.',
  },
  'escanear.qr.sesion': {
    pantalla: 'Escanear',
    donde: 'Cuando la sesión venció mientras se confirmaba el QR',
    titulo: 'Tu sesión venció',
    texto: 'Vuelve a iniciar sesión y escanea el QR otra vez.',
  },
  'avisos.resumen': {
    pantalla: 'Avisos',
    donde: 'Resumen de los avisos que SÍ llegan (Avisos y Preferencias). Dice lo que el sistema envía hoy',
    texto: AVISOS_QUE_LLEGAN_RESUMEN,
  },
  'avisos.sin_recordatorios': {
    pantalla: 'Avisos',
    donde: 'En Preferencias, junto a los avisos de cuota que todavía no se envían',
    texto: AVISO_SIN_RECORDATORIOS,
  },
  'demo.compra': {
    pantalla: 'Pagos',
    donde: 'Cuando se intenta avisar un pago de una compra de demostración',
    texto: AVISO_DEMOSTRACION,
  },
  'demo.plan_simulado': {
    pantalla: 'Compra',
    donde: 'Bajo el plan de pago estimado, al comprar',
    texto: AVISO_PLAN_SIMULADO,
  },
  'cuota.vencida': {
    pantalla: 'Cuota',
    donde: 'En el detalle de una cuota vencida',
    texto: 'Mientras esta cuota siga vencida, tu calificación baja. Págala cuanto antes para que deje de afectarte.',
  },
  'puntaje.tramo_alto': {
    pantalla: 'Perfil',
    donde: 'Bajo el puntaje, cuando está en el tramo más alto',
    texto: 'Estás en el tramo más alto. Mantenerlo depende de seguir pagando a tiempo.',
  },
  'pago.qr_instruccion': {
    pantalla: 'Pagos',
    donde: 'Bajo «Paga con el QR…», al pagar una cuota',
    texto: 'Abre la app de tu banco, escanea este código y paga el monto exacto.',
  },
  'pago.comprobante_falta': {
    pantalla: 'Pagos',
    donde: 'Al avisar un pago sin haber adjuntado el comprobante',
    texto: 'Adjunta el comprobante de tu transferencia antes de avisar.',
  },
  'pago.comprobante_evidencia': {
    pantalla: 'Pagos',
    donde: 'Tras avisar un pago: qué pasa con el comprobante. Dice que te avisamos al confirmarlo',
    texto:
      'Tu comprobante es evidencia, no confirma el pago por sí solo. Lo damos por pagado cuando el comercio confirma que recibió el dinero. Te avisamos apenas ocurra.',
  },
  'pago.ya_pagaste': {
    pantalla: 'Pagos',
    donde: 'Tarjeta «Ya pagaste», donde se adjunta el comprobante',
    titulo: 'Ya pagaste',
    texto: 'Adjunta el comprobante de tu transferencia. Es lo que el comercio mira para confirmarla.',
  },
  'soporte.cabecera': {
    pantalla: 'Soporte',
    donde: 'Cabecera de la tarjeta de búsqueda en Soporte',
    titulo: '¿Con qué te ayudamos?',
    texto: 'Escribe tu duda en tus palabras.',
  },
  'soporte.ninguno': {
    pantalla: 'Soporte',
    donde: 'Última opción de la lista de ayuda: abrir la conversación',
    titulo: 'Ninguno de estos / prefiero contarlo',
    texto: 'Abrimos la conversación y la clasificamos nosotros.',
  },
  'soporte.dato_oculto': {
    pantalla: 'Soporte',
    donde: 'Bajo un mensaje del chat al que se le quitó un dato sensible',
    texto: 'Ocultamos un dato sensible de este mensaje por tu seguridad.',
  },
  'ayuda.hablar': {
    pantalla: 'Ayuda',
    donde: 'Tarjeta «¿Necesitas hablar con alguien?» de Ayuda',
    titulo: '¿Necesitas hablar con alguien?',
    texto: 'Te respondemos por chat y queda registrado en tu caso.',
  },
  'puntaje.mora': {
    pantalla: 'Perfil',
    donde: 'Encabezado del aviso de mora bajo el puntaje',
    texto: 'La mora está bajando tu calificación',
  },
} as const satisfies Record<string, CopyEntry>;

export type CopyKey = keyof typeof COPY;

/**
 * Los textos del alta que NO se piden por clave fija sino por código (la etapa, el bloqueo, el estado de la
 * cuenta): se generan de los mapas de `onboarding-map.ts`, que siguen siendo el valor de fábrica. Se piden con
 * `etiquetaDeSeccion`, `describeBlocker` y `describeLifecycle`, no con `useCopy`.
 */
export const COPY_DEL_ALTA: Record<string, CopyEntry> = {
  ...Object.fromEntries(
    Object.entries(SECTION_LABEL).map(([codigo, etapa]): [string, CopyEntry] => [
      `etapa.${codigo}`,
      {
        pantalla: 'Alta · etapas',
        donde: `Etapa «${etapa.title}» en la lista de pasos y en la cabecera de su pantalla`,
        titulo: etapa.title,
        texto: etapa.detail,
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(BLOCKER_COPY).map(([codigo, bloqueo]): [string, CopyEntry] => [
      `bloqueo.${codigo}`,
      {
        pantalla: 'Alta · revisión',
        donde: `Lo que se dice cuando el servidor reporta el bloqueo ${codigo}`,
        titulo: bloqueo.title,
        texto: bloqueo.detail,
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(LIFECYCLE_COPY).map(([estado, ciclo]): [string, CopyEntry] => [
      `ciclo.${estado}`,
      {
        pantalla: 'Alta · estado de la cuenta',
        donde: `Cabecera del progreso del alta cuando la cuenta está «${estado}»`,
        titulo: ciclo.title,
        texto: ciclo.detail,
      },
    ]),
  ),
};

/** Todos los textos configurables, para sembrar el portal y para las pruebas. */
export const COPY_TODOS: Record<string, CopyEntry> = { ...COPY, ...COPY_DEL_ALTA };
