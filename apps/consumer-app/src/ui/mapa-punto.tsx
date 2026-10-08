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
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { esExpoGo } from '../device/entorno';
import { etiquetaDeSitio, RADIO_MISMO_SITIO_M, type SitioFrecuente } from '../features/sitios-frecuentes';
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
  centro = null,
  onCancelar,
  onElegir,
  sitios = [],
}: {
  /**
   * Los sitios que la persona frecuenta, sacados de las posiciones que el telefono ya midio. Se
   * pintan TODOS en el mapa y se pueden tocar en la lista para usar uno como casa.
   */
  sitios?: readonly SitioFrecuente[];
  visible: boolean;
  /** Dónde abre el mapa: el punto ya elegido, o el GPS, o el centro por defecto. */
  inicial: Punto | null;
  /**
   * Dónde está el teléfono AHORA, si dio permiso. Sin punto previo, el mapa abre ahí y lo propone
   * como punto: quien rellena el alta desde su casa sólo tiene que confirmar.
   */
  centro?: Punto | null;
  onCancelar: () => void;
  onElegir: (punto: Punto) => void;
}) {
  /*
    Donde abre el mapa: el punto ya elegido, la posicion actual, y si no hay, el sitio mas visitado —
    que es donde es mas probable que este su casa— y si no, el centro por defecto.
  */
  const sitioPrincipal = sitios[0] ? { lat: sitios[0].lat, lng: sitios[0].lng } : null;
  const arranque = inicial ?? centro ?? sitioPrincipal ?? CENTRO_POR_DEFECTO;
  const [punto, setPunto] = useState<Punto | null>(inicial ?? centro ?? null);
  /*
    El PIN FIJO en el centro (Pablo, 2026-10-08: «que se pueda seleccionar el lugar exacto, no solo el que viene por
    defecto»). Antes el punto sólo cambiaba tocando el mapa, y la cámara se recalculaba en cada render volviendo al
    punto de arranque: el mapa «saltaba» de vuelta y en Apple Maps el toque no siempre llegaba. Ahora la cámara se fija
    al abrir y sólo la mueve la persona; el punto elegido es el CENTRO del mapa, bajo el pin, como en las apps de
    transporte. Tocar el mapa o un sitio frecuente lleva la cámara ahí.
  */
  const [camaraFijada, setCamaraFijada] = useState<Punto>(arranque);
  // El modal vive montado: cada apertura vuelve a partir de lo último elegido o de la posición actual.
  useEffect(() => {
    if (!visible) return;
    setPunto(inicial ?? centro ?? null);
    setCamaraFijada(inicial ?? centro ?? sitioPrincipal ?? CENTRO_POR_DEFECTO);
    // `sitioPrincipal` es derivado de `sitios`: sólo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, inicial, centro]);
  const llevarA = (p: Punto) => {
    setPunto(p);
    setCamaraFijada(p);
  };
  const mapas = cargarMapas();

  const marcadoresDeSitios = sitios.map((sitio, indice) => ({
    id: `sitio-${indice}`,
    coordinates: { latitude: sitio.lat, longitude: sitio.lng },
    title: etiquetaDeSitio(sitio),
  }));
  const circulos = sitios.map((sitio, indice) => ({
    id: `zona-${indice}`,
    center: { latitude: sitio.lat, longitude: sitio.lng },
    radius: RADIO_MISMO_SITIO_M,
    color: '#2BD9A133',
    lineColor: '#2BD9A1',
    lineWidth: 1,
  }));
  // «Tu casa» ya no es un marcador: es el pin fijo del centro, que no se desfasa del punto elegido.
  const marcadores = marcadoresDeSitios;
  // Con varios sitios se aleja la camara para que quepan los que estan cerca del primero.
  const camara = useMemo(
    () => ({ coordinates: { latitude: camaraFijada.lat, longitude: camaraFijada.lng }, zoom: sitios.length > 1 ? 15 : 17 }),
    [camaraFijada, sitios.length],
  );

  /* El evento trae `coordinates` con latitud y longitud opcionales: sin las dos no hay punto. */
  const alTocar = (evento: { coordinates?: { latitude?: number; longitude?: number } }) => {
    const { latitude, longitude } = evento.coordinates ?? {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    llevarA({ lat: latitude, lng: longitude });
  };
  /* Al mover el mapa, el punto es el centro: lo que queda bajo el pin. */
  const alMoverCamara = (evento: { coordinates?: { latitude?: number; longitude?: number } }) => {
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
                ? sitios.length > 0
                  ? 'Mueve el mapa hasta que el pin quede justo sobre tu casa, o toca uno de tus sitios.'
                  : 'Mueve el mapa hasta que el pin quede justo sobre tu casa. Puedes acercarte con dos dedos.'
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
                circles={circulos}
                onMapClick={alTocar}
                onCameraMove={alMoverCamara}
              />
            ) : (
              <mapas.GoogleMaps.View
                style={StyleSheet.absoluteFill}
                cameraPosition={camara}
                markers={marcadores}
                circles={circulos}
                onMapClick={alTocar}
                onCameraMove={alMoverCamara}
              />
            )
          ) : (
            <SinMapa onPunto={setPunto} />
          )}
          {mapas ? (
            // El pin: la punta cae exactamente en el centro del mapa, que es el punto que se guarda.
            <View pointerEvents="none" style={styles.pinFijo} testID="mapa-pin-fijo">
              <Icon name="ubicacion" size={44} tint={color.action.primary} />
              <View style={styles.pinSombra} />
            </View>
          ) : null}
        </View>

        {sitios.length > 0 ? (
          <View style={styles.sitios}>
            <AtlasText variant="label" tone="secondary">
              {sitios.length === 1 ? 'Un sitio que frecuentas' : `${sitios.length} sitios que frecuentas`}
            </AtlasText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sitiosFila}>
              {sitios.map((sitio, indice) => (
                <Pressable
                  key={`${sitio.lat}-${sitio.lng}`}
                  onPress={() => llevarA({ lat: sitio.lat, lng: sitio.lng })}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar como mi casa: ${etiquetaDeSitio(sitio)}`}
                  style={styles.sitio}
                >
                  <Icon name="ubicacion" size={14} tint={color.text.secondary} />
                  <AtlasText variant="caption" tone="secondary">
                    {indice + 1}. {etiquetaDeSitio(sitio)}
                  </AtlasText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

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
  // El icono mide 44: se sube la mitad para que su punta, y no su centro, quede sobre el centro del mapa.
  pinFijo: { position: 'absolute', top: '50%', left: '50%', marginLeft: -22, marginTop: -44, alignItems: 'center' },
  pinSombra: { width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.35)', marginTop: -2 },
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
  sitios: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs },
  sitiosFila: { gap: space.sm },
  sitio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
  },
});
