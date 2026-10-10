/**
 * Las guías del portal del comercio. Copia LITERAL de `AtlasERPFrontend/components/tutorial/guias/guias-portal.ts`
 * (y de los tipos que usa, `tutorial-types.ts`).
 *
 * Estas las lee gente que NO trabaja en Atlas: el dueño de una tienda o quien lleva su
 * administración. Se tutea, se evitan las siglas y no se menciona ningún endpoint. Si la web cambia
 * un texto, se cambia aquí: la prueba `__tests__/soporte/tutoriales.test.ts` cuenta las secciones
 * para que una guía no se quede a medias sin que nadie lo note.
 *
 * Las claves son las rutas de la WEB a propósito: son el identificador de cada guía en las dos caras
 * y lo que `docs/fidelidad/soporte.md` cita. Lo que cambia en el teléfono es cómo se ENSEÑAN (en
 * `src/ui/soporte/centro-de-tutoriales.tsx`).
 */

export interface GuideSection {
  title: string;
  body: string;
  /** Aparte destacado: la trampa, el atajo o la consecuencia. */
  tip?: string;
}

/** «¿Qué estoy viendo aquí?» de una vista concreta. */
export interface ScreenGuide {
  /** Antetítulo: el módulo al que pertenece la vista. */
  eyebrow: string;
  title: string;
  /** Una frase, sin jerga: qué es esta pantalla. */
  intro: string;
  sections: readonly GuideSection[];
  /** Recorrido interactivo asociado, si lo hay. */
  tutorialId?: string;
}

export const GUIAS_PORTAL: Readonly<Record<string, ScreenGuide>> = {
  '/portal-comercio/gestion-pos': {
    eyebrow: 'Portal del comercio',
    title: 'Gestión POS',
    intro: 'Lo que pasa en tu caja: las compras que te piden con el QR y los pagos que te avisan haber hecho.',
    sections: [
      {
        title: 'Son dos momentos de la misma venta',
        body: 'En «Solicitudes de compra» el cliente te pide una compra a crédito y tú aceptas o rechazas. En «Comprobantes por verificar» ese mismo cliente, más adelante, te avisa que transfirió una cuota y tú confirmas que la viste entrar. Antes eran dos pantallas distintas y había que adivinar en cuál estaba lo que tenías delante.',
        tip: 'El número junto a cada pestaña dice cuántos esperan: no hace falta entrar para saber si hay algo.',
      },
      {
        title: 'Cómo llega una solicitud aquí',
        body: 'El cliente escanea el QR de tu local, pide un importe y el motor de decisión resuelve si lo aprueba y en cuántas cuotas. Sólo llegan aquí las que aprobó: las que no, ni las ves.',
      },
      {
        title: 'Sólo puedes aceptar o rechazar',
        body: 'No hay ningún campo editable, y esa ausencia es la función de la pantalla. El importe y el calendario los fijó el motor con el historial del cliente delante; cambiarlos desde el mostrador sería rehacer esa decisión sin el dato que la sostiene.',
      },
      {
        title: 'No ves quién es el cliente',
        body: 'A propósito. Decides sobre la operación: importe, plazo, que el motor la aprobó. Enseñarte su expediente convertiría cada compra en una consulta de historial crediticio que esa persona no autorizó.',
      },
      {
        title: 'Por qué el pago lo confirmas tú',
        body: 'El cliente transfiere al QR bancario de tu comercio, así que ese dinero entra en tu cuenta y no en la de Atlas. Nadie más puede mirar tu extracto: por eso la cuota se salda cuando tú dices que llegó.',
      },
      {
        title: 'Un comprobante no es un pago',
        body: 'Es evidencia de que alguien hizo una transferencia, no de que tú la recibiste. Comprueba el importe y la referencia contra tu extracto antes de confirmar; al confirmar, la cuota queda pagada de verdad.',
      },
      {
        title: 'Rechazar exige un motivo, en las dos pestañas',
        body: 'Rechazar una compra o un comprobante sin decir por qué deja al cliente sabiendo sólo que le dijiste que no. El motivo es lo que le permite corregirlo, y lo que después distingue un problema tuyo de uno suyo.',
      },
      {
        title: 'Confirmar dos veces no cobra dos veces',
        body: 'Cada aviso lleva su propio código y ese código es lo que impide el doble cobro. Si dudas de si ya lo confirmaste, míralo: lo confirmado desaparece de la lista.',
      },
    ],
    tutorialId: 'portal-primeros-pasos',
  },

  '/portal-comercio/cartera': {
    eyebrow: 'Portal del comercio',
    title: 'Mi cartera',
    intro: 'Qué te deben, con su detalle cuota a cuota, y qué debería entrar cada día.',
    sections: [
      {
        title: 'Tres vistas de lo mismo',
        body: 'El panel resume, «Créditos» abre cada operación cuota a cuota y «Calendario» dice cuánto entra cada día. Salen de la misma lectura, así que las tres cuentan igual: si el panel dice Bs 4.000 por cobrar, el calendario suma Bs 4.000.',
      },
      {
        title: 'Lo vencido va aparte',
        body: 'Una cuota vencida sigue siendo cobrable, pero no es lo mismo que una que aún no llega. Por eso el vencido tiene su propia cifra y sus días de mora: es lo que decide a quién llamar hoy.',
      },
      {
        title: 'No verás nombres',
        body: 'Tu cartera dice qué operación vence y cuándo, no quién la debe. Tú decides sobre la operación; el expediente del cliente es suyo y no de quien le vendió.',
      },
      {
        title: 'Los comprobantes cuentan aparte',
        body: 'El contador de comprobantes es lo que espera tu confirmación, no dinero cobrado. Hasta que verificas, esa cuota sigue en «por cobrar».',
      },
    ],
    tutorialId: 'portal-cartera',
  },

  '/portal-comercio/facturacion': {
    eyebrow: 'Portal del comercio',
    title: 'Consumo y facturación',
    intro: 'Lo que Atlas te ha facturado y lo que queda pendiente de pago.',
    sections: [
      {
        title: 'Facturas y saldos son cosas distintas',
        body: 'La lista de facturas es lo que se emitió; el saldo abierto es lo que todavía no se ha pagado. Una factura pagada sigue apareciendo en el historial.',
      },
      {
        title: 'El estado de cada factura',
        body: 'Emitida significa que hay que pagarla; vencida, que pasó su fecha. Pagada desaparece del saldo pero no del listado.',
      },
      {
        title: 'Si ya pagaste y sigue abierta',
        body: 'El pago se registra cuando se concilia, y eso puede tardar. Si pasan varios días, avisa con el número de factura a mano.',
      },
    ],
  },

  '/portal-comercio/expediente': {
    eyebrow: 'Portal del comercio',
    title: 'Mi empresa',
    intro: 'Los datos de tu negocio, dónde opera, con qué cobra y el QR que escanean tus clientes.',
    sections: [
      {
        title: 'Cuatro pestañas, una sola empresa',
        body: '«Estado del expediente» dice qué falta para que Atlas te apruebe; «Ficha comercial» son tus datos; «Mi QR de cobro» es el código con el que te pagan las cuotas; «Sucursales» son tus locales con las cajas de cada uno. Las cuatro hablan siempre del mismo negocio: si administras varios, el que elijas arriba vale para todas.',
      },
      {
        title: 'Se abre una vez y se completa por partes',
        body: 'No hay que terminarlo de una sentada. Se abre el expediente, y a partir de ahí se van sumando sucursales, QR y terminales cuando los tengas a mano.',
      },
      {
        title: 'Qué puedes corregir y qué no',
        body: 'El nombre comercial, el rubro y el teléfono los cambias cuando quieras, incluso con el negocio ya aprobado: son datos que se mueven con el negocio vivo. La razón social, el NIT y la matrícula no, porque son contra lo que Atlas verificó que tu empresa es tu empresa.',
        tip: 'El rubro describe tu negocio en tu ficha; tenlo al día para que Atlas sepa a qué te dedicas.',
      },
      {
        title: 'El QR de cada caja está en la tabla, sin abrir nada',
        body: 'En «Sucursales», cada fila enseña el código de todas sus cajas. Ese es el QR que hay que imprimir y dejar en el mostrador: es lo que tu cliente apunta con el teléfono para pedir su compra en cuotas. Desde ahí mismo registras una caja nueva o suspendes una que ya no debe cobrar.',
        tip: 'De un vistazo se ve qué local tiene caja y cuál no. Un local sin caja no puede venderte a crédito, aunque esté activo.',
      },
      {
        title: 'Dos QR distintos, y conviene no confundirlos',
        body: 'El de «Mi QR de cobro» lo pones tú: es la imagen del QR de tu banco, y es a esa cuenta a la que tu cliente transfiere las cuotas. Los de «Sucursales» los genera Atlas, uno por caja, y sirven para que el cliente pida la compra en ese mostrador. Uno cobra, el otro identifica dónde estás.',
      },
      {
        title: 'El QR lleva el código de la caja, no tu nombre',
        body: 'Dentro del cuadro no va el nombre de tu negocio: va el código de esa caja, y el nombre lo pone Atlas cuando el teléfono lo consulta. Es lo que impide que alguien imprima un QR con tu nombre y cobre por ti.',
      },
      {
        title: 'Un terminal suspendido ya no sirve para pedir compras',
        body: 'Si pierdes un equipo o cierras una caja, cámbiale el estado: desde ese momento el cliente ya no puede pedir una compra con el QR de esa caja, aunque el cartel siga pegado en la pared.',
      },
      {
        title: 'De la sucursal cuelga todo lo demás',
        body: 'El QR y los terminales pertenecen a un local, no a la empresa. Es lo que permite responder «¿en qué sucursal se hizo este cobro?», que es la primera pregunta de cualquier reclamo.',
        tip: 'Registra primero las sucursales; si no, no habrá dónde colgar el QR.',
      },
      {
        title: 'El QR se guarda como imagen, no como número',
        body: 'Se conserva el archivo y su huella digital, no el número que alguien transcribió. Un QR dice a qué cuenta va el dinero: si algún día se discute, la imagen es la prueba y el número tecleado no lo es.',
      },
      {
        title: 'Un QR no se edita: se reemplaza',
        body: 'El anterior se conserva marcado. Si un cobro salió mal hay que poder reconstruir contra qué QR se cobró ese día, y sobrescribirlo destruye justo eso.',
      },
      {
        title: 'Al enviar, pasa a revisión',
        body: 'Deja de ser tuyo para editar y lo revisa Atlas. Repasa los datos antes: una corrección después es un caso, no un cambio.',
      },
    ],
  },

  '/portal-comercio/soporte': {
    eyebrow: 'Portal del comercio',
    title: 'Soporte y tutoriales',
    intro: 'Habla con Atlas cuando algo no sale, o repasa cómo se hace antes de intentarlo.',
    sections: [
      {
        title: 'Están juntos porque son la misma pregunta',
        body: 'Escribir a soporte y buscar un tutorial se hacen en el mismo momento: cuando no sabes cómo seguir. Tenerlos en dos sitios distintos del menú obligaba a decidir de antemano si lo tuyo era una duda o un problema, que es justo lo que todavía no sabes.',
      },
      {
        title: 'Un caso deja constancia; una conversación, no siempre',
        body: '«Abrir un caso» te da un número al que volver y que alguien tiene que resolver. «Hablar con soporte» es el chat, para lo que se arregla en dos frases. Si lo tuyo afecta a dinero —un cobro, una factura, una cuota— abre caso.',
      },
      {
        title: 'El motivo decide quién te atiende',
        body: 'Lo que eliges al abrir el caso no es una etiqueta: encamina el caso a quien sabe de ese tema. Elegir «otros» por ir rápido suele ser el camino más lento.',
      },
      {
        title: 'Los tutoriales recorren la aplicación de verdad',
        body: 'No son vídeos: te llevan por las pantallas reales, señalando dónde pulsar. Puedes dejar uno a medias y retomarlo donde lo dejaste, y repetir cualquiera las veces que quieras.',
        tip: 'Y en cada pantalla, el botón junto al título explica esa pantalla concreta sin salir de ella.',
      },
    ],
    tutorialId: 'portal-primeros-pasos',
  },

  '/portal-comercio/cuenta': {
    eyebrow: 'Portal del comercio',
    title: 'Mi cuenta',
    intro: 'La seguridad de tu acceso al portal.',
    sections: [
      {
        title: 'Cambia la contraseña si sospechas de ella',
        body: 'Al cambiarla se cierran las demás sesiones abiertas con la anterior, que es justo lo que quieres si alguien más la conocía.',
      },
      {
        title: 'Una persona, un acceso',
        body: 'Si alguien más de tu equipo necesita entrar, pide su propio usuario a tu ejecutivo de cuenta en lugar de compartir el tuyo. Así se sabe quién hizo cada operación, que es lo que te protege a ti si algo sale mal.',
      },
    ],
  },
};
