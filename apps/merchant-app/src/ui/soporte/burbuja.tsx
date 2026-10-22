/**
 * Un mensaje de la conversación con soporte del comercio.
 *
 * Se dibuja con las piezas del chat de la app del cliente (`@cliente/ui/chat-kit`): misma burbuja, mismo
 * agrupado, mismo doble tic. Lo que dice es el de la web (`MerchantSupportScreen`): lo propio es lo del
 * `PARTNER_USER`, el aviso de dato oculto y «Enviado» / «Leído».
 *
 * El del sistema va centrado y sin lado: no es de ninguna de las dos partes, es una regla de la casa.
 * La web no pinta adjuntos en el chat del comercio, y aquí tampoco.
 */
import { AvisoDelSistema, BurbujaChat } from '@cliente/ui/chat-kit';
import type { MensajeDeSoporte } from '@/api/servicios/supportService';
import { horaDelMensaje } from '@/features/soporte/chat';

export function Burbuja({
  mensaje,
  leido,
  primeroDelGrupo = true,
  ultimoDelGrupo = true,
}: {
  mensaje: MensajeDeSoporte;
  leido: boolean;
  primeroDelGrupo?: boolean;
  ultimoDelGrupo?: boolean;
}) {
  const mio = mensaje.senderActorType === 'PARTNER_USER';
  const delSistema = mensaje.senderActorType === 'SYSTEM' || mensaje.visibility === 'SYSTEM';

  if (delSistema) return <AvisoDelSistema texto={mensaje.body ?? ''} />;

  return (
    <BurbujaChat
      mio={mio}
      primeroDelGrupo={primeroDelGrupo}
      ultimoDelGrupo={ultimoDelGrupo}
      hora={horaDelMensaje(mensaje.createdAt)}
      estado={mio ? (leido ? 'leido' : 'enviado') : undefined}
      nota={mensaje.redacted ? 'Ocultamos un dato sensible por seguridad.' : null}
    >
      {mensaje.body ?? ''}
    </BurbujaChat>
  );
}
