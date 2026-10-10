/**
 * Un mensaje de la conversación con soporte.
 *
 * El dibujo es el de la burbuja de la app del cliente (`consumer-app/app/(app)/soporte/[channelId].tsx`),
 * que no se puede importar porque vive dentro de una ruta: mismo radio, misma cola apretada del lado
 * de quien habla, mismo doble tic. Lo que dice es el de la web (`MerchantSupportScreen`): lo propio es
 * lo del `PARTNER_USER`, el aviso de dato oculto y «Enviado» / «Leído».
 *
 * El del sistema va centrado y sin lado: no es de ninguna de las dos partes, es una regla de la casa.
 * La web no pinta adjuntos en el chat del comercio, y aquí tampoco.
 */
import { StyleSheet, View } from 'react-native';
import { color, radius, space } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { AtlasText, Card } from '@cliente/ui/primitives';
import type { MensajeDeSoporte } from '@/api/servicios/supportService';
import { horaDelMensaje } from '@/features/soporte/chat';

export function Burbuja({ mensaje, leido }: { mensaje: MensajeDeSoporte; leido: boolean }) {
  const mio = mensaje.senderActorType === 'PARTNER_USER';
  const delSistema = mensaje.senderActorType === 'SYSTEM' || mensaje.visibility === 'SYSTEM';

  if (delSistema) {
    return (
      <Card tone="warning" padding="tight" style={styles.sistema}>
        <AtlasText variant="caption" tone="secondary">
          {mensaje.body}
        </AtlasText>
      </Card>
    );
  }

  return (
    <View style={mio ? styles.ladoMio : styles.ladoSuyo}>
      <View style={[styles.burbuja, mio ? styles.burbujaMia : styles.burbujaSuya]}>
        <AtlasText variant="body">{mensaje.body}</AtlasText>
        {mensaje.redacted ? (
          <AtlasText variant="caption" tone="secondary">
            Ocultamos un dato sensible por seguridad.
          </AtlasText>
        ) : null}
        <View style={styles.pie}>
          <AtlasText variant="caption" tone="secondary">
            {horaDelMensaje(mensaje.createdAt)}
          </AtlasText>
          {mio ? (
            // Un check = enviado; dos = leído. El texto se queda: el color solo no lo lee quien no lo distingue.
            <View style={styles.tics} accessibilityLabel={leido ? 'Leído' : 'Enviado'}>
              <View style={styles.fila}>
                <Icon name="check" size={14} tint={leido ? color.action.primary : color.text.secondary} />
                {leido ? (
                  <View style={styles.segundoTic}>
                    <Icon name="check" size={14} tint={color.action.primary} />
                  </View>
                ) : null}
              </View>
              <AtlasText variant="caption" tone={leido ? 'brand' : 'secondary'}>
                {leido ? 'Leído' : 'Enviado'}
              </AtlasText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sistema: { alignSelf: 'center', maxWidth: '85%' },
  ladoMio: { alignItems: 'flex-end' },
  ladoSuyo: { alignItems: 'flex-start' },
  burbuja: { maxWidth: '85%', borderRadius: radius.lg, padding: space.sm, gap: space.xs },
  burbujaMia: { backgroundColor: color.surface.raisedStrong, borderBottomRightRadius: radius.xs },
  burbujaSuya: { backgroundColor: color.surface.raised, borderBottomLeftRadius: radius.xs },
  pie: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs },
  tics: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fila: { flexDirection: 'row' },
  segundoTic: { marginLeft: -8 },
});
