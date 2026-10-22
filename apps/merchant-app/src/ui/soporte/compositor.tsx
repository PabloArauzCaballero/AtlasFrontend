/**
 * El campo y el botón de enviar del chat de soporte del comercio.
 *
 * Es el `CompositorChat` de la app del cliente SIN el clip: allí la persona puede mandar una foto,
 * y el chat del comercio en la web no admite adjuntos (sólo «Tu mensaje» y «Enviar»). Un clip que no
 * hace nada, o que hace algo que la web no hace, rompe la primera regla de esta app.
 */
import { CompositorChat } from '@cliente/ui/compositor-chat';

export function Compositor({
  texto,
  onChangeText,
  onEnviar,
  enviando = false,
  deshabilitado = false,
}: {
  texto: string;
  onChangeText: (valor: string) => void;
  onEnviar: () => void;
  enviando?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <CompositorChat
      texto={texto}
      onChangeText={onChangeText}
      onEnviar={onEnviar}
      enviando={enviando}
      deshabilitado={deshabilitado}
      placeholder={deshabilitado ? 'La conversación está cerrada' : 'Escribe aquí…'}
      accessibilityHint="Tu respuesta o aclaración para el equipo de soporte."
    />
  );
}
