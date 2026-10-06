/**
 * Pautas para las fotos de identidad: una pantalla de información, no un desplegable.
 *
 * Pablo (2026-10-06) pidió «Pautas para el documento de identidad» —buena iluminación, evitar los reflejos,
 * enfoque y nitidez— en una pestaña de información con las imágenes a la vista y en máxima calidad. Los consejos
 * ya existían, pero sólo como desplegable sobre la cámara y con fichas pequeñas: se leían de reojo con el visor
 * abierto, justo cuando la persona está intentando encuadrar.
 *
 * ## Por qué la calidad es la máxima
 *
 * Los dibujos son VECTORES (`ui/consejos-foto-dibujos.ts`), no PNG: se pintan a la densidad de la pantalla
 * que los muestre —3x en un teléfono actual— sin pixelarse ni pesar más. Aquí van a todo el ancho de la columna;
 * en un teléfono estrecho cada pareja se apila (bien arriba, mal abajo) para que ninguna ficha baje del tamaño
 * en el que se distingue un reflejo de un renglón.
 *
 * Lo correcto y lo incorrecto no se distinguen sólo por el color: cada ficha lleva su insignia y su rótulo.
 */
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { CONSEJOS, type TipoDeFoto } from '../../src/features/consejos-foto';
import { space } from '../../src/theme/tokens';
import { Ficha } from '../../src/ui/consejos-foto';
import { Screen, ScreenHeader } from '../../src/ui/layout';
import { Appear } from '../../src/ui/motion';
import { AtlasText, Card, Chip, ChipBar } from '../../src/ui/primitives';

/** Por debajo de este ancho de pantalla cada pareja va apilada: lado a lado, una ficha mediría menos de ~150 px. */
const ANCHO_PAREJA = 400;

const PESTANAS: { id: Extract<TipoDeFoto, 'carnet' | 'selfie'>; label: string }[] = [
  { id: 'carnet', label: 'Documento' },
  { id: 'selfie', label: 'Selfie' },
];

export default function PautasDocumento() {
  const [pestana, setPestana] = useState<'carnet' | 'selfie'>('carnet');
  const { width } = useWindowDimensions();
  const apilar = width < ANCHO_PAREJA;
  const contenido = CONSEJOS[pestana];

  return (
    <Screen>
      <ScreenHeader
        title="Pautas para tus fotos"
        subtitle="Así se ve una foto que se valida a la primera, y así una que no."
        onBack="auto"
      />

      <ChipBar>
        {PESTANAS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            selected={pestana === p.id}
            onPress={() => setPestana(p.id)}
            accessibilityLabel={`Pautas para ${p.id === 'carnet' ? 'el documento de identidad' : 'la selfie'}`}
          />
        ))}
      </ChipBar>

      <AtlasText variant="h3">{pestana === 'carnet' ? 'Pautas para el documento de identidad' : 'Pautas para la selfie'}</AtlasText>

      {/* `key` reinicia la entrada escalonada al cambiar de pestaña. */}
      <View key={pestana} style={styles.lista}>
        {contenido.consejos.map((consejo, indice) => (
          <Appear key={consejo.id} index={indice}>
            <Card testID={`pauta-${consejo.id}`}>
              <AtlasText variant="title">{consejo.titulo}</AtlasText>
              <View style={[styles.pareja, apilar && styles.parejaApilada]}>
                <View style={apilar ? undefined : styles.ficha}>
                  <Ficha dibujo={consejo.bien} etiqueta={consejo.bienEtiqueta} correcta />
                </View>
                <View style={apilar ? undefined : styles.ficha}>
                  <Ficha dibujo={consejo.mal} etiqueta={consejo.malEtiqueta} correcta={false} />
                </View>
              </View>
              <AtlasText variant="body" tone="secondary">
                {consejo.texto}
              </AtlasText>
            </Card>
          </Appear>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { gap: space.base },
  pareja: { flexDirection: 'row', gap: space.md },
  parejaApilada: { flexDirection: 'column' },
  ficha: { flex: 1 },
});
