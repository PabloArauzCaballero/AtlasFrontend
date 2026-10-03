/**
 * El compositor de un chat: clip, campo y enviar en UNA fila, como cualquier chat que la persona ya usa.
 *
 * ## Por qué dejó de ser «campo + dos botones grandes»
 *
 * Antes eran un rótulo («Tu mensaje»), un campo, un botón «Foto» y un «Enviar» apilados, más una frase
 * que repetía por qué «Enviar» estaba apagado. Ocupaba media pantalla con el teclado abierto y empujaba
 * la conversación fuera de la vista: justo lo que se está escribiendo es lo que menos hay que tapar.
 *
 * ## La foto no se envía al elegirla
 *
 * Una foto elegida queda como ADJUNTO PENDIENTE sobre el campo, con su miniatura: se ve qué se va a
 * mandar, se puede quitar y se puede escribir un texto antes de enviar. Enviar en el acto no daba
 * ocasión de ninguna de las tres cosas.
 */
import { Image, StyleSheet, TextInput, View } from 'react-native';
import { color, inputChrome, radius, space, stroke, touch } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface } from './motion';
import { Cargando } from './primitives';

export function CompositorChat({
  texto,
  onChangeText,
  onEnviar,
  onAdjuntar,
  adjuntoUri = null,
  onQuitarAdjunto,
  enviando = false,
  placeholder = 'Escribe un mensaje…',
}: {
  texto: string;
  onChangeText: (valor: string) => void;
  onEnviar: () => void;
  onAdjuntar: () => void;
  /** La foto elegida y todavía sin enviar. */
  adjuntoUri?: string | null;
  onQuitarAdjunto?: () => void;
  enviando?: boolean;
  placeholder?: string;
}) {
  const puedeEnviar = (texto.trim().length > 0 || adjuntoUri !== null) && !enviando;

  return (
    <View style={styles.raiz}>
      {adjuntoUri ? (
        <View style={styles.adjunto} testID="compositor-adjunto">
          <Image source={{ uri: adjuntoUri }} style={styles.miniatura} accessibilityLabel="Foto que vas a enviar" />
          <PressSurface
            onPress={onQuitarAdjunto}
            accessibilityRole="button"
            accessibilityLabel="Quitar la foto"
            hitSlop={8}
            style={styles.quitar}
            testID="compositor-quitar"
          >
            <Icon name="cerrar" size={14} tint={color.text.primary} />
          </PressSurface>
        </View>
      ) : null}

      <View style={styles.fila}>
        <PressSurface
          onPress={onAdjuntar}
          disabled={enviando}
          accessibilityRole="button"
          accessibilityLabel="Adjuntar una foto"
          style={styles.redondo}
          testID="compositor-adjuntar"
        >
          <Icon name="clip" size={22} tint={color.text.secondary} />
        </PressSurface>

        <TextInput
          value={texto}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.text.tertiary}
          multiline
          keyboardAppearance={inputChrome.keyboardAppearance}
          selectionColor={inputChrome.selectionColor}
          cursorColor={inputChrome.cursorColor}
          accessibilityLabel="Tu mensaje"
          style={styles.campo}
          testID="compositor-campo"
        />

        <PressSurface
          onPress={puedeEnviar ? onEnviar : undefined}
          disabled={!puedeEnviar}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: !puedeEnviar, busy: enviando }}
          style={[styles.redondo, puedeEnviar ? styles.enviarActivo : styles.enviarApagado]}
          testID="compositor-enviar"
        >
          {enviando ? <Cargando /> : <Icon name="enviar" size={22} tint={puedeEnviar ? color.text.onBrand : color.text.tertiary} />}
        </PressSurface>
      </View>
    </View>
  );
}

const DIAMETRO = touch.minSize;

const styles = StyleSheet.create({
  raiz: { gap: space.sm },
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  redondo: {
    width: DIAMETRO,
    height: DIAMETRO,
    borderRadius: DIAMETRO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
  },
  enviarActivo: { backgroundColor: color.action.primary },
  enviarApagado: { backgroundColor: color.surface.raised },
  campo: {
    flex: 1,
    minHeight: DIAMETRO,
    maxHeight: 120,
    borderRadius: radius.xl,
    borderWidth: stroke.hairline,
    borderColor: color.border.field,
    backgroundColor: color.surface.sunken,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 2,
    paddingBottom: space.sm + 2,
    color: color.text.primary,
    fontSize: 16,
  },
  adjunto: { alignSelf: 'flex-start' },
  miniatura: { width: 96, height: 96, borderRadius: radius.lg, backgroundColor: color.surface.raised },
  quitar: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raisedStrong,
    borderWidth: stroke.hairline,
    borderColor: color.border.strong,
  },
});
