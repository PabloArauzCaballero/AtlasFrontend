/**
 * Las piezas de un chat de soporte: presencia, separador de día, burbuja, aviso del sistema,
 * «escribiendo», inicio de conversación y nota de seguridad.
 *
 * ## Por que existen aparte
 *
 * Los dos chats de soporte —el del cliente y el del comercio (`@cliente/ui/chat-kit`)— tenían cada uno
 * su burbuja copiada a mano, y ya se estaban separando. Ahora se dibujan con las mismas piezas.
 *
 * ## Las decisiones del rediseño (2026-10-22)
 *
 * - **Lo mío en el color de marca, lo del equipo en superficie.** El lado ya lo dice; el color lo dice
 *   a quien mira de reojo. Es el patrón que la persona conoce de cualquier mensajería.
 * - **Grupos.** Hora y estado solo en el último mensaje de cada grupo (`features/chat-hilo.ts`).
 * - **Una cara del otro lado.** La cabecera dice quién responde y si está en línea: quien escribe a
 *   una entidad financiera con un problema necesita saber que hay una persona, no un buzón.
 * - **Empezar es un toque.** El chat vacío ofrece temas frecuentes que rellenan el campo: menos
 *   opciones que pensar y una primera frase ya escrita.
 * - **La seguridad, a la vista y una sola vez.** Nadie de Atlas pide el PIN ni los códigos; se dice al
 *   pie con un candado, sin alarmar.
 */
import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { color, radius, space, stroke } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface } from './motion';
import { AtlasText } from './primitives';

/** Tamaño del avatar del equipo en la cabecera del chat. */
const AVATAR = 40;
/** El punto verde (o ámbar) de presencia sobre el avatar. */
const PUNTO = 12;
/** Ancho máximo de una burbuja, en fracción del hilo. */
const ANCHO_BURBUJA = '82%';
/** Lo secundario dentro de mi burbuja (hora, nota): el mismo blanco, un poco más bajo. */
const OPACIDAD_SECUNDARIA_MIA = 0.85;
/** El aro que separa el punto de presencia del avatar. */
const ARO_DEL_PUNTO = 2;

export type EstadoDePresencia = 'en_linea' | 'reconectando' | 'cerrado';

const TEXTO_DE_PRESENCIA: Record<EstadoDePresencia, string> = {
  en_linea: 'En línea',
  reconectando: 'Reconectando…',
  cerrado: 'Conversación cerrada',
};

const COLOR_DE_PRESENCIA: Record<EstadoDePresencia, string> = {
  en_linea: color.feedback.success,
  reconectando: color.feedback.warning,
  cerrado: color.text.tertiary,
};

/** Quién responde y si está ahí. Va bajo la cabecera de la pantalla. */
export function PresenciaDeSoporte({
  estado,
  titulo = 'Equipo de soporte Atlas',
  detalle = 'Te responde una persona, por lo general en pocos minutos.',
}: {
  estado: EstadoDePresencia;
  titulo?: string;
  detalle?: string;
}) {
  const punto = COLOR_DE_PRESENCIA[estado];
  return (
    <View style={styles.presencia} accessible accessibilityLabel={`${titulo}. ${TEXTO_DE_PRESENCIA[estado]}. ${detalle}`} testID="presencia-de-soporte">
      <View style={styles.avatar}>
        <AtlasText variant="label" style={{ color: color.text.onBrand }}>
          A
        </AtlasText>
        <View style={[styles.punto, { backgroundColor: punto }]} />
      </View>
      <View style={styles.flex}>
        <AtlasText variant="label">{titulo}</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          {TEXTO_DE_PRESENCIA[estado]} · {detalle}
        </AtlasText>
      </View>
    </View>
  );
}

export function SeparadorDeDia({ dia }: { dia: string }) {
  return (
    <View style={styles.dia} accessibilityRole="header">
      <View style={styles.diaPildora}>
        <AtlasText variant="micro" tone="secondary">
          {dia}
        </AtlasText>
      </View>
    </View>
  );
}

/** Una regla de la casa, centrada y sin lado: no es de ninguna de las dos partes. */
export function AvisoDelSistema({ texto }: { texto: string }) {
  return (
    <View style={styles.sistema}>
      <Icon name="escudo" size={14} tint={color.text.secondary} />
      <AtlasText variant="caption" tone="secondary" style={styles.flexTexto}>
        {texto}
      </AtlasText>
    </View>
  );
}

export function BurbujaChat({
  mio,
  primeroDelGrupo = true,
  ultimoDelGrupo = true,
  hora,
  estado,
  nota,
  children,
}: {
  mio: boolean;
  primeroDelGrupo?: boolean;
  ultimoDelGrupo?: boolean;
  /** Sin hora (el asistente) no hay pie salvo que haya estado. */
  hora?: string;
  /** Solo en lo mío: un check enviado, dos leído. */
  estado?: 'enviado' | 'leido';
  /** Una línea aparte bajo el texto (p. ej. «Ocultamos un dato sensible»). */
  nota?: string | null;
  children: React.ReactNode;
}) {
  const tinta = mio ? color.text.onBrand : color.text.primary;
  const tintaSuave = mio ? color.text.onBrand : color.text.secondary;
  return (
    <View style={[mio ? styles.ladoMio : styles.ladoSuyo, primeroDelGrupo ? styles.inicioDeGrupo : null]}>
      <View
        style={[
          styles.burbuja,
          mio ? styles.burbujaMia : styles.burbujaSuya,
          // La cola: la esquina del lado de quien habla se aprieta, solo en el último del grupo.
          ultimoDelGrupo && mio ? styles.colaMia : null,
          ultimoDelGrupo && !mio ? styles.colaSuya : null,
        ]}
        testID={mio ? 'burbuja-mia' : 'burbuja-suya'}
      >
        {typeof children === 'string' ? (
          <AtlasText variant="body" style={{ color: tinta }}>
            {children}
          </AtlasText>
        ) : (
          children
        )}
        {nota ? (
          <AtlasText variant="caption" style={{ color: tintaSuave, opacity: mio ? OPACIDAD_SECUNDARIA_MIA : 1 }}>
            {nota}
          </AtlasText>
        ) : null}
        {ultimoDelGrupo && (hora || estado) ? (
          <View style={styles.pie}>
            <AtlasText variant="micro" style={{ color: tintaSuave, opacity: mio ? OPACIDAD_SECUNDARIA_MIA : 1 }}>
              {hora}
            </AtlasText>
            {mio && estado ? (
              /* Un check = enviado; dos = leído. El texto accesible se queda: el check solo no lo anuncia un lector. */
              <View style={styles.tics} accessible accessibilityLabel={estado === 'leido' ? 'Leído' : 'Enviado'}>
                <Icon name="check" size={13} tint={tinta} />
                {estado === 'leido' ? (
                  <View style={styles.segundoTic}>
                    <Icon name="check" size={13} tint={tinta} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** «Atlas está escribiendo…», con la forma de una burbuja del otro lado. */
export function Escribiendo({ quien = 'Atlas' }: { quien?: string }) {
  return (
    <View style={[styles.ladoSuyo, styles.inicioDeGrupo]} accessibilityLiveRegion="polite" testID="escribiendo">
      <View style={[styles.burbuja, styles.burbujaSuya, styles.colaSuya, styles.escribiendo]}>
        <View style={styles.puntos}>
          <View style={styles.puntito} />
          <View style={styles.puntito} />
          <View style={styles.puntito} />
        </View>
        <AtlasText variant="caption" tone="secondary">
          {quien} está escribiendo…
        </AtlasText>
      </View>
    </View>
  );
}

/**
 * El chat vacío. Dice qué pasa al escribir y ofrece temas frecuentes: tocar uno escribe la primera
 * frase en el campo (no la envía: la persona la completa con su caso).
 */
export function InicioDeChat({
  titulo = '¿En qué te ayudamos?',
  detalle = 'Cuéntanos tu caso como se lo contarías a una persona. Te respondemos por aquí mismo y te avisamos cuando llegue la respuesta.',
  sugerencias,
  onElegir,
}: {
  titulo?: string;
  detalle?: string;
  sugerencias: readonly string[];
  onElegir: (texto: string) => void;
}) {
  return (
    <View style={styles.inicio} testID="inicio-de-chat">
      <View style={styles.inicioIcono}>
        <Icon name="chat" size={26} tint={color.action.primary} />
      </View>
      <AtlasText variant="title" style={styles.centrado}>
        {titulo}
      </AtlasText>
      <AtlasText variant="body" tone="secondary" style={styles.centrado}>
        {detalle}
      </AtlasText>
      {sugerencias.length > 0 ? (
        <View style={styles.sugerencias}>
          <AtlasText variant="micro" tone="tertiary" style={styles.centrado}>
            Temas frecuentes
          </AtlasText>
          {sugerencias.map((texto) => (
            <PressSurface
              key={texto}
              onPress={() => onElegir(texto)}
              accessibilityRole="button"
              accessibilityLabel={`Empezar con: ${texto}`}
              style={styles.sugerencia}
              testID="sugerencia-de-chat"
            >
              <AtlasText variant="body" style={styles.flexTexto}>
                {texto}
              </AtlasText>
              <Icon name="adelante" size={16} tint={color.text.tertiary} />
            </PressSurface>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function NotaDeSeguridad({ texto = 'Nadie de Atlas te pedirá tu PIN ni los códigos que te llegan por SMS o correo.' }: { texto?: string }) {
  return (
    <View style={styles.seguridad}>
      <Icon name="candado" size={12} tint={color.text.tertiary} />
      <AtlasText variant="micro" tone="tertiary" style={styles.flexTexto}>
        {texto}
      </AtlasText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xxs },
  flexTexto: { flexShrink: 1 },
  centrado: { textAlign: 'center' },

  presencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: color.surface.raised,
    borderWidth: stroke.hairline,
    borderColor: color.border.subtle,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    backgroundColor: color.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punto: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: PUNTO,
    height: PUNTO,
    borderRadius: PUNTO / ARO_DEL_PUNTO,
    borderWidth: ARO_DEL_PUNTO,
    borderColor: color.surface.raised,
  },

  dia: { alignItems: 'center', marginVertical: space.sm },
  diaPildora: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.fill.subtle },

  sistema: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '90%',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.feedbackSoft.warning,
    marginVertical: space.xs,
  },

  ladoMio: { alignItems: 'flex-end' },
  ladoSuyo: { alignItems: 'flex-start' },
  inicioDeGrupo: { marginTop: space.sm },
  burbuja: { maxWidth: ANCHO_BURBUJA, borderRadius: radius.xl, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  burbujaMia: { backgroundColor: color.action.primary },
  burbujaSuya: { backgroundColor: color.surface.raised, borderWidth: stroke.hairline, borderColor: color.border.subtle },
  colaMia: { borderBottomRightRadius: radius.xs },
  colaSuya: { borderBottomLeftRadius: radius.xs },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.xs },
  tics: { flexDirection: 'row' },
  segundoTic: { marginLeft: -space.sm },

  escribiendo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  puntos: { flexDirection: 'row', gap: space.xxs },
  puntito: { width: space.xs + space.xxs, height: space.xs + space.xxs, borderRadius: space.xs, backgroundColor: color.text.tertiary },

  inicio: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  inicioIcono: {
    width: space.huge,
    height: space.huge,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accent.soft,
    marginBottom: space.xs,
  },
  sugerencias: { alignSelf: 'stretch', gap: space.sm, marginTop: space.md },
  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface.raised,
    borderWidth: stroke.hairline,
    borderColor: color.border.subtle,
  },

  seguridad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
});
