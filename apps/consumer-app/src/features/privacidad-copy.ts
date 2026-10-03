/**
 * Los textos de la pantalla «Tus datos» (`app/(app)/privacidad.tsx`), de fábrica.
 *
 * Son el respaldo de lo que negocio edita en el portal (superficie `privacy`): se ven sin red, antes
 * de que llegue la respuesta y si alguien despublica una pieza. Los plazos y promesas de aquí
 * (15 días, «no te enviaremos un aviso») describen lo que el sistema hace hoy; quien los edite en el
 * portal responde de que sigan siendo verdad.
 */
export type DerechoCopy = { value: string; label: string; detalle: string };

export type PrivacidadCopy = {
  titulo: string;
  subtitulo: string;
  permisosTitulo: string;
  permisosDetalle: string;
  permisosRetirados: string;
  permisosIgual: string;
  derechosTitulo: string;
  derechosDetalle: string;
  derechosPregunta: string;
  derechosAyuda: string;
  solicitudEnviada: string;
  derechos: DerechoCopy[];
};

export const PRIVACIDAD_DE_FABRICA: PrivacidadCopy = {
  titulo: 'Tus datos',
  subtitulo: 'Que permisos diste, cuales puedes retirar y que puedes pedir sobre tu informacion.',
  permisosTitulo: 'Permisos que diste',
  permisosDetalle:
    'Retirar uno corta su uso de aqui en adelante. Lo que ya se decidio con ese dato se conserva, porque una decision de credito tiene que poder explicarse despues.',
  permisosRetirados: 'Listo. Los permisos que retiraste dejan de usarse desde ahora.',
  permisosIgual: 'Listo. Tus permisos quedan como estaban.',
  derechosTitulo: 'Pedir algo sobre tus datos',
  derechosDetalle:
    'Cada solicitud queda registrada con su fecha con un plazo de resolución de 15 días. Hoy la respuesta no te llega como aviso: vuelve a esta pantalla o escríbenos para saber cómo va.',
  derechosPregunta: 'Que quieres pedir',
  derechosAyuda:
    'Elige qué derecho quieres ejercer sobre tus datos personales. La solicitud queda registrada con su fecha con un plazo de resolución de 15 días. Hoy no te enviamos un aviso cuando cambia de estado, así que escríbenos por soporte si quieres saber cómo va; puedes enviar otra distinta después.',
  solicitudEnviada:
    'Tu solicitud quedó registrada con un plazo de resolución de 15 días. No te enviaremos un aviso cuando cambie: escríbenos por soporte si quieres saber cómo va.',
  derechos: [
    {
      value: 'rectification',
      label: 'Corregir un dato',
      detalle: 'Algo esta mal escrito o desactualizado.',
    },
    {
      value: 'deletion',
      label: 'Borrar mi cuenta',
      detalle: 'Se revisa: hay datos que la ley obliga a conservar.',
    },
  ],
};
