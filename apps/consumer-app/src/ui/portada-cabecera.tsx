/**
 * La cabecera de Inicio (Pablo, 2026-10-17): una barra de marca con la campana a la izquierda, el logotipo en el
 * centro y los tres puntos a la derecha, el patrón de la banca móvil que la gente ya usa.
 *
 * - La campana abre Avisos, que salió de la barra de pestañas el 2026-10-12 y desde entonces sólo se alcanzaba
 *   tocando una notificación del sistema. Lleva un punto cuando hay avisos sin leer.
 * - El logotipo abre «Conoce Atlas», que antes era el botón de marca junto al saludo.
 * - Los tres puntos abren un menú corto: los créditos pendientes (Pagos) y el historial de compras.
 */
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as notificationsApi from '../api/endpoints/notifications';
import { color, marca, radius, shadow, space } from '../theme/tokens';
import { AtlasMark } from './brand';
import { BottomSheet } from './help-sheet';
import { Icon, type IconName } from './icons';
import { PressSurface } from './motion';
import { AtlasText, Divider, ListRow } from './primitives';

type OpcionDeMenu = { icono: IconName; titulo: string; detalle: string; ruta: Href; testID: string };

export const OPCIONES_DEL_MENU: OpcionDeMenu[] = [
  {
    icono: 'pagos',
    titulo: 'Mis créditos pendientes',
    detalle: 'Lo que debes, cuota por cuota, y cuándo vence.',
    ruta: '/(app)/(tabs)/pagos',
    testID: 'menu-creditos-pendientes',
  },
  {
    icono: 'reloj',
    titulo: 'Mis compras',
    detalle: 'Todo lo que compraste, también lo ya pagado.',
    ruta: '/(app)/compras',
    testID: 'menu-mis-compras',
  },
  {
    icono: 'chispa',
    titulo: `Conoce ${marca.nombre}`,
    detalle: 'Cómo funciona tu línea, en pocas pantallas.',
    ruta: '/(app)/conoce-atlas',
    testID: 'menu-conoce-atlas',
  },
];

/**
 * Cuántos avisos sin leer hay, consultado cada vez que Inicio vuelve a la vista: al volver de Avisos el punto se
 * apaga. Es una cifra sola, así que no pasa por el limitador de `useAlVolver`. Un fallo deja la campana sin punto.
 */
function useAvisosSinLeer(customerId: string | null): number {
  const [sinLeer, setSinLeer] = useState(0);
  const consultar = useCallback(async () => {
    if (!customerId) return;
    try {
      const { unread } = await notificationsApi.unreadCount(customerId);
      setSinLeer(Number(unread) || 0);
    } catch {
      // Sin red o sin servicio de avisos: la campana sigue funcionando, sólo sin el punto.
    }
  }, [customerId]);
  useFocusEffect(
    useCallback(() => {
      void consultar();
    }, [consultar]),
  );
  return sinLeer;
}

export function PortadaCabecera({ customerId }: { customerId: string | null }) {
  const router = useRouter();
  const sinLeer = useAvisosSinLeer(customerId);
  const [menuAbierto, setMenuAbierto] = useState(false);
  /*
    Se navega cuando la hoja TERMINÓ de cerrarse, no al tocar la opción: en iOS, empujar una pantalla mientras el Modal
    se va deja la pantalla nueva debajo de la hoja que se está yendo.
  */
  const destino = useRef<Href | null>(null);
  const elegir = (ruta: Href) => {
    destino.current = ruta;
    setMenuAbierto(false);
  };
  const alCerrarse = useCallback(() => {
    const ruta = destino.current;
    destino.current = null;
    if (ruta) router.push(ruta);
  }, [router]);

  return (
    <View style={styles.barra} testID="portada-cabecera">
      <PressSurface
        accessibilityRole="button"
        accessibilityLabel={sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
        onPress={() => router.push('/(app)/(tabs)/avisos')}
        hitSlop={8}
        style={styles.boton}
        testID="portada-campana"
      >
        <Icon name="campana" size={26} tint={color.text.onBrand} />
        {sinLeer > 0 ? <View style={styles.punto} testID="portada-campana-punto" /> : null}
      </PressSurface>

      <PressSurface
        accessibilityRole="button"
        accessibilityLabel={`Conoce ${marca.nombre}`}
        onPress={() => router.push('/(app)/conoce-atlas')}
        style={styles.marca}
        testID="inicio-conoce-atlas"
      >
        <AtlasMark size={30} />
        <AtlasText variant="h2" style={styles.palabra}>
          {marca.nombre.toUpperCase()}
        </AtlasText>
      </PressSurface>

      <PressSurface
        accessibilityRole="button"
        accessibilityLabel="Más opciones"
        onPress={() => setMenuAbierto(true)}
        hitSlop={8}
        style={styles.boton}
        testID="portada-mas"
      >
        <Icon name="mas" size={26} tint={color.text.onBrand} />
      </PressSurface>

      <BottomSheet visible={menuAbierto} titulo="Más opciones" cierre="Cerrar" onClose={() => setMenuAbierto(false)} alCerrarse={alCerrarse}>
        <View style={styles.menu}>
          {OPCIONES_DEL_MENU.map((opcion, indice) => (
            <View key={opcion.testID} testID={opcion.testID}>
              {indice > 0 ? <Divider inset /> : null}
              <ListRow icon={opcion.icono} title={opcion.titulo} subtitle={opcion.detalle} onPress={() => elegir(opcion.ruta)} />
            </View>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 76,
    paddingHorizontal: space.sm,
    borderRadius: radius.xxl,
    backgroundColor: color.action.primary,
    ...shadow.card,
  },
  boton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  /* El punto de «sin leer»: pequeño, en el ángulo de la campana y con filo del color de la barra para despegarse. */
  punto: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: color.feedback.danger,
    borderWidth: 2,
    borderColor: color.action.primary,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, paddingHorizontal: space.md },
  // El logotipo va abierto, como en `AtlasLogo`: cinco letras en caja alta son una marca, no un titular.
  palabra: { color: color.text.onBrand, letterSpacing: 2.4 },
  menu: { paddingBottom: space.base },
});
