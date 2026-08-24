/**
 * Elegir tu casa en un mapa, tocando.
 *
 * ## Por qué no es «abrir Google Maps y volver con el enlace»
 *
 * Porque eso no existe. La app de Google Maps **no puede devolverle un punto a otra app**: se la
 * puede abrir con un `geo:` o un enlace, pero no hay ningún camino de vuelta —ni callback, ni
 * intent de resultado, ni universal link— por el que el punto que la persona señale allí regrese
 * aquí. Lo que había antes era la consecuencia de esa limitación: un campo donde pegar a mano un
 * enlace copiado desde otra app, con todo lo que eso implica —salir de Atlas, encontrar el botón de
 * compartir, volver, pegar— y un `fetch` al enlace corto para intentar sacarle las coordenadas.
 *
 * El mapa va DENTRO. Se toca el punto y las coordenadas ya están aquí, sin salir ni pegar nada.
 *
 * ## Qué se guarda
 *
 * Las **coordenadas**, no el enlace. Un enlace es una cadena que hay que volver a interpretar cada
 * vez —y que puede dejar de resolverse—; `lat/lng` es el dato. El enlace se genera al vuelo cuando
 * alguien quiere abrirlo, que es la dirección correcta de la dependencia.
 *
 * ## Apple en iOS, Google en Android
 *
 * `expo-maps` expone un componente por plataforma y no hay uno común: en iOS el mapa del sistema, en
 * Android el de Google. Se elige aquí y una sola vez, para que la pantalla del domicilio no tenga
 * que saber en qué teléfono está corriendo.
 */
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { Icon } from './icons';
import { AtlasText, Button } from './primitives';

export type Punto = { lat: number; lng: number };

/** Santa Cruz de la Sierra. Con qué encuadre abre cuando no hay ni GPS ni punto previo. */
const CENTRO_POR_DEFECTO: Punto = { lat: -17.783327, lng: -63.182140 };

/** El enlace se FABRICA desde las coordenadas, no al revés. Ver la nota de arriba. */
export function enlaceDeMaps(punto: Punto): string {
  return `https://www.google.com/maps/search/?api=1&query=${punto.lat},${punto.lng}`;
}

export function MapaPunto({
  visible,
  inicial,
  onCancelar,
  onElegir,
}: {
  visible: boolean;
  /** Dónde abre el mapa: el punto ya elegido, o el GPS, o el centro por defecto. */
  inicial: Punto | null;
  onCancelar: () => void;
  onElegir: (punto: Punto) => void;
}) {
  const arranque = inicial ?? CENTRO_POR_DEFECTO;
  const [punto, setPunto] = useState<Punto | null>(inicial);

  const marcadores = punto ? [{ coordinates: { latitude: punto.lat, longitude: punto.lng }, title: 'Tu casa' }] : [];
  const camara = { coordinates: { latitude: arranque.lat, longitude: arranque.lng }, zoom: 16 };

  /* El evento trae `coordinates` con latitud y longitud opcionales: sin las dos no hay punto. */
  const alTocar = (evento: { coordinates?: { latitude?: number; longitude?: number } }) => {
    const { latitude, longitude } = evento.coordinates ?? {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    setPunto({ lat: latitude, lng: longitude });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancelar}>
      <View style={styles.pantalla}>
        <View style={styles.cabecera}>
          <Pressable onPress={onCancelar} accessibilityRole="button" accessibilityLabel="Cerrar el mapa" hitSlop={12}>
            <Icon name="atras" size={22} tint={color.text.primary} />
          </Pressable>
          <View style={styles.cabeceraTexto}>
            <AtlasText variant="bodyStrong">Señala tu casa</AtlasText>
            <AtlasText variant="caption" tone="secondary">
              Toca el mapa donde vives. Puedes corregirlo tocando otra vez.
            </AtlasText>
          </View>
        </View>

        <View style={styles.mapa}>
          {Platform.OS === 'ios' ? (
            <AppleMaps.View style={StyleSheet.absoluteFill} cameraPosition={camara} markers={marcadores} onMapClick={alTocar} />
          ) : (
            <GoogleMaps.View style={StyleSheet.absoluteFill} cameraPosition={camara} markers={marcadores} onMapClick={alTocar} />
          )}
        </View>

        <View style={styles.pie}>
          {/*
            El botón dice si ya hay algo que confirmar en vez de quedarse apagado y mudo: un botón
            deshabilitado sin motivo obliga a adivinar qué falta, y aquí lo que falta es un toque.
          */}
          <AtlasText variant="caption" tone={punto ? 'secondary' : 'tertiary'}>
            {punto ? `Punto elegido: ${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)}` : 'Todavía no has tocado el mapa.'}
          </AtlasText>
          <Button
            label="Usar este punto"
            onPress={() => punto && onElegir(punto)}
            disabled={!punto}
            blockedReason={punto ? undefined : 'Toca el mapa para señalar dónde vives.'}
          />
          <Button label="Cancelar" variant="ghost" onPress={onCancelar} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.surface.primary },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.huge,
    paddingBottom: space.md,
  },
  cabeceraTexto: { flex: 1, gap: 2 },
  mapa: { flex: 1, overflow: 'hidden', borderRadius: radius.lg, marginHorizontal: space.base },
  pie: { padding: space.lg, gap: space.md },
});
