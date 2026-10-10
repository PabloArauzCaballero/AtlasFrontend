/**
 * Las pestañas DENTRO de una sección (Solicitudes · Comprobantes, Estado · Ficha · QR · Sucursales…).
 *
 * Es el `TabbedPanels` del portal web con las piezas de la app del cliente: una fila de `Chip` con
 * su contador, desplazable si no cabe. La pestaña abierta viaja en el parámetro `tab` de la ruta
 * (`usePestana`), igual que `?tab=` en la web: así un enlace, un tutorial o un aviso aterrizan en la
 * pestaña correcta y no en la primera.
 *
 * Los paneles se montan TODOS y se esconden los que no están activos (`keepMounted` de la web):
 * cambiar de pestaña no vuelve a pedir los datos ni pierde lo escrito en un formulario a medias.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, radius, shadow, space } from '@cliente/theme/tokens';
import { AtlasText } from '@cliente/ui/primitives';
import type { IconName } from '@cliente/ui/icons';

export interface Pestana<T extends string = string> {
  id: T;
  etiqueta: string;
  icono?: IconName;
  /** La etiqueta que se ve en el selector: una o dos palabras. `etiqueta` queda para lectores de pantalla. */
  corta?: string;
  /** El contador de la web (pendientes por pestaña). Sin número no se pinta. */
  cuenta?: number;
}

/** La pestaña activa leída de `?tab=`; una desconocida cae en la primera. */
export function usePestana<T extends string>(validas: readonly T[], porDefecto: T = validas[0] as T): [T, (id: T) => void] {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const activa = (validas as readonly string[]).includes(tab ?? '') ? (tab as T) : porDefecto;
  const elegir = useCallback((id: T) => router.setParams({ tab: id }), [router]);
  return [activa, elegir];
}

/**
 * Selector segmentado, como el de iOS: TODAS las opciones entran en el ancho, con el mismo tamaño,
 * y la elegida se ve como una pieza levantada sobre el carril. Reemplaza a la fila de chips que se
 * cortaba por la derecha («Comprobantes por verif…») y obligaba a deslizar para descubrir pestañas
 * (Pablo, 2026-10-10: «mucho más claros»). Por eso cada pestaña lleva una etiqueta CORTA; el contador
 * va pegado a ella en una pastilla, y sólo se pinta si hay algo pendiente.
 */
export function BarraDePestanas<T extends string>({ pestanas, activa, onCambiar }: { pestanas: Pestana<T>[]; activa: T; onCambiar: (id: T) => void }) {
  return (
    <View style={styles.carril} accessibilityRole="tablist">
      {pestanas.map((p) => {
        const elegida = p.id === activa;
        const texto = p.corta ?? p.etiqueta;
        return (
          <Pressable
            key={p.id}
            onPress={() => onCambiar(p.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: elegida }}
            accessibilityLabel={typeof p.cuenta === 'number' ? `${p.etiqueta}, ${p.cuenta}` : p.etiqueta}
            style={[styles.segmento, elegida && styles.segmentoElegido]}
            hitSlop={4}
            testID={`pestana-${p.id}`}
          >
            <AtlasText variant="caption" tone={elegida ? 'primary' : 'secondary'} numberOfLines={1} style={elegida ? styles.textoElegido : undefined}>
              {texto}
            </AtlasText>
            {p.cuenta ? (
              <View style={[styles.cuenta, elegida && styles.cuentaElegida]}>
                <AtlasText variant="micro" tone={elegida ? 'onBrand' : 'secondary'}>
                  {p.cuenta > 99 ? '99+' : String(p.cuenta)}
                </AtlasText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Un panel: siempre montado, visible sólo si es el activo. */
export function Panel({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return <View style={visible ? styles.panel : styles.oculto}>{children}</View>;
}

const styles = StyleSheet.create({
  carril: {
    flexDirection: 'row',
    backgroundColor: color.fill.subtle,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segmento: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm + 1,
  },
  segmentoElegido: { backgroundColor: color.surface.raised, ...shadow.card },
  textoElegido: { fontWeight: '600' },
  cuenta: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.fill.base,
  },
  cuentaElegida: { backgroundColor: color.action.primary },
  panel: { gap: space.base },
  oculto: { display: 'none' },
});
