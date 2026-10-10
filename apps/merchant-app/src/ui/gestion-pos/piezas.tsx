/**
 * Piezas que repiten las tarjetas de Gestión POS, hechas con lo de la app del cliente.
 *
 * Pablo (2026-10-10): las tarjetas tienen que ser «mucho más claras». Una jerarquía fija para las
 * tres colas y el historial:
 *
 *  - `CabeceraDeImporte`: el IMPORTE grande a la izquierda —es lo que se vino a mirar— y el estado en
 *    español a la derecha.
 *  - `LineaSecundaria`: UNA línea con lo demás (cuotas o referencia · fecha · caja) y, en gris al
 *    final, la referencia corta del código. Antes el título de la tarjeta era el código entero y la
 *    caja, la referencia y el importe iban en tres bloques apilados.
 *  - `TituloDeSeccion`: un título pequeño con su ⓘ, donde fue a parar la frase de las tarjetas
 *    «Por qué…» que cerraban cada pestaña.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { BotonInfo, InfoSheet } from '@cliente/ui/help-sheet';
import { AtlasText, Badge } from '@cliente/ui/primitives';
import type { Tono } from '@/features/gestion-pos/historial';

export function CabeceraDeImporte({ importe, estado, tono, variante = 'h2' }: { importe: string; estado: string; tono: Tono; variante?: 'h2' | 'h3' }) {
  return (
    <View style={styles.cabecera}>
      <AtlasText variant={variante} numberOfLines={1} adjustsFontSizeToFit style={styles.importe}>
        {importe}
      </AtlasText>
      <Badge label={estado} tone={tono} dot />
    </View>
  );
}

export function LineaSecundaria({ texto, referencia, testID }: { texto: string; referencia?: string; testID?: string }) {
  return (
    <AtlasText variant="caption" tone="secondary" numberOfLines={2} {...(testID ? { testID } : {})}>
      {texto}
      {referencia ? <AtlasText variant="caption" tone="tertiary">{`${texto ? ' · ' : ''}#${referencia}`}</AtlasText> : null}
    </AtlasText>
  );
}

export function TituloDeSeccion({ titulo, info, testID }: { titulo: string; info?: string; testID?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <View style={styles.seccion} {...(testID ? { testID } : {})}>
      <AtlasText variant="captionStrong" tone="secondary">
        {titulo}
      </AtlasText>
      {info ? (
        <>
          <BotonInfo etiqueta={titulo} onPress={() => setAbierta(true)} {...(testID ? { testID: `${testID}-info` } : {})} />
          <InfoSheet visible={abierta} titulo={titulo} onClose={() => setAbierta(false)}>
            <AtlasText variant="body" tone="secondary">
              {info}
            </AtlasText>
          </InfoSheet>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  importe: { flexShrink: 1 },
  seccion: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
});
