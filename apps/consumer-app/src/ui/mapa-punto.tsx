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
 *
 * ## Por qué el módulo se carga a mano y no con un `import`
 *
 * `expo-maps` **no viaja dentro de Expo Go** —lo dice su propio README— y resuelve su parte nativa
 * al evaluarse el módulo (`requireNativeModule('ExpoMaps')`, `requireNativeView('ExpoGoogleMaps')`),
 * no al montarse el componente. Con un `import` normal eso convierte «el mapa no funciona en Expo
 * Go» en «la app no abre en Expo Go»: expo-router carga todas las rutas, la del domicilio importa
 * este archivo, y el fallo ocurre en el arranque, lejos de la pantalla que lo causa.
 *
 * Cargándolo aquí dentro, el `require` sólo se ejecuta donde el módulo existe. Donde no —Expo Go—,
 * se enseña `SinMapa`, que resuelve lo mismo por GPS: el dato que necesita la pantalla del
 * domicilio son unas coordenadas, y el mapa es una forma de conseguirlas, no la única.
 */
import * as Location from 'expo-location';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { esExpoGo } from '../device/entorno';
import { color, radius, space } from '../theme/tokens';
import { Icon } from './icons';
import { AtlasText, Button } from './primitives';

export type Punto = { lat: number; lng: number };

/** Santa Cruz de la Sierra. Con qué encuadre abre cuando no hay ni GPS ni punto previo. */
const CENTRO_POR_DEFECTO: Punto = { lat: -17.783327, lng: -63.182140 };

type ModuloDeMapas = typeof import('expo-maps');

/**
 * `undefined` es «todavía no se ha intentado» y `null` es «se intentó y aquí no hay mapa». Hacen
 * falta los dos estados: sin ellos, cada render reintentaría un `require` que ya se sabe que falla.
 */
let moduloDeMapas: ModuloDeMapas | null | undefined;

function cargarMapas(): ModuloDeMapas | null {
  if (moduloDeMapas !== undefined) return moduloDeMapas;

  // Tampoco en el navegador: `expo-maps` no tiene componente web. La direccion se muestra en texto.
  if (esExpoGo || Platform.OS === 'web') {
    moduloDeMapas = null;
    return moduloDeMapas;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    moduloDeMapas = require('expo-maps') as ModuloDeMapas;
  } catch {
    /*
      No debería ocurrir en el binario propio, pero un mapa que falta no puede tumbar el alta: el
      domicilio se puede completar por GPS y la persona sigue adelante.
    */
    moduloDeMapas = null;
  }
  return moduloDeMapas;
}

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
  const mapas = cargarMapas();

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
            <AtlasText variant="h3">Señala tu casa</AtlasText>
            <AtlasText variant="caption" tone="secondary">
              {mapas
                ? 'Toca el mapa donde vives. Puedes corregirlo tocando otra vez.'
                : 'Aquí no hay mapa, pero podemos tomar tu ubicación actual.'}
            </AtlasText>
          </View>
        </View>

        <View style={styles.mapa}>
          {mapas ? (
            Platform.OS === 'ios' ? (
              <mapas.AppleMaps.View
                style={StyleSheet.absoluteFill}
                cameraPosition={camara}
                markers={marcadores}
                onMapClick={alTocar}
              />
            ) : (
              <mapas.GoogleMaps.View
                style={StyleSheet.absoluteFill}
                cameraPosition={camara}
                markers={marcadores}
                onMapClick={alTocar}
              />
            )
          ) : (
            <SinMapa onPunto={setPunto} />
          )}
        </View>

        <View style={styles.pie}>
          {/*
            El botón dice si ya hay algo que confirmar en vez de quedarse apagado y mudo: un botón
            deshabilitado sin motivo obliga a adivinar qué falta, y aquí lo que falta es un toque.
          */}
          {/* Las coordenadas en la familia de cifras: son un dato numerico que se compara consigo
              mismo al corregir el punto, y con cifras proporcionales bailan de un toque a otro. */}
          <AtlasText variant={punto ? 'amountMicro' : 'caption'} tone={punto ? 'secondary' : 'tertiary'}>
            {punto
              ? `${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)}`
              : mapas
                ? 'Todavía no has tocado el mapa.'
                : 'Todavía no hay ubicación.'}
          </AtlasText>
          <Button
            label="Usar este punto"
            onPress={() => punto && onElegir(punto)}
            disabled={!punto}
            blockedReason={
              punto ? undefined : mapas ? 'Toca el mapa para señalar dónde vives.' : 'Toma tu ubicación para continuar.'
            }
          />
          <Button label="Cancelar" variant="ghost" onPress={onCancelar} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * El respaldo cuando no hay mapa: el GPS.
 *
 * `expo-location` **sí** viaja dentro de Expo Go, así que este camino funciona exactamente donde
 * falla el otro. Da un punto menos preciso que señalar el tejado de tu casa con el dedo, y por eso
 * es el respaldo y no lo primero; pero deja el alta completa, que es de lo que se trata.
 */
function SinMapa({ onPunto }: { onPunto: (punto: Punto) => void }) {
  const [estado, setEstado] = useState<'listo' | 'buscando' | 'sin-permiso' | 'error'>('listo');

  const usarMiUbicacion = async () => {
    setEstado('buscando');
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (!permiso.granted) {
        setEstado('sin-permiso');
        return;
      }
      const posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onPunto({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  };

  const explicacion =
    estado === 'sin-permiso'
      ? 'No diste permiso de ubicación. Puedes concederlo desde los ajustes del teléfono y volver a intentarlo.'
      : estado === 'error'
        ? 'No se pudo leer el GPS. Comprueba que esté encendido e inténtalo otra vez.'
        : 'Esta versión de prueba no incluye el mapa. Tomamos las coordenadas del GPS del teléfono.';

  return (
    <View style={styles.sinMapa}>
      <Icon name="ubicacion" size={28} tint={color.text.secondary} />
      <AtlasText variant="caption" tone="secondary" style={styles.sinMapaTexto}>
        {explicacion}
      </AtlasText>
      <Button
        label={estado === 'buscando' ? 'Buscando…' : 'Usar mi ubicación actual'}
        variant="secondary"
        onPress={usarMiUbicacion}
        disabled={estado === 'buscando'}
      />
    </View>
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
  cabeceraTexto: { flex: 1, gap: space.xxs },
  /*
    El mapa lleva contorno, como cualquier otra superficie de la app. Sin el, el visor termina en el
    borde exacto donde empieza el navy y la transicion se lee como un recorte, no como un objeto.
  */
  mapa: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    marginHorizontal: space.lg,
  },
  sinMapa: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  sinMapaTexto: { textAlign: 'center' },
  pie: { padding: space.lg, gap: space.md },
});
