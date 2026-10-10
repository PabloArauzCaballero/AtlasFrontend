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
import { ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { Chip } from '@cliente/ui/primitives';
import type { IconName } from '@cliente/ui/icons';

export interface Pestana<T extends string = string> {
  id: T;
  etiqueta: string;
  icono?: IconName;
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

export function BarraDePestanas<T extends string>({ pestanas, activa, onCambiar }: { pestanas: Pestana<T>[]; activa: T; onCambiar: (id: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barra} accessibilityRole="tablist">
      {pestanas.map((p) => (
        <Chip
          key={p.id}
          label={p.etiqueta}
          icon={p.icono}
          count={p.cuenta}
          selected={p.id === activa}
          onPress={() => onCambiar(p.id)}
          accessibilityLabel={typeof p.cuenta === 'number' ? `${p.etiqueta}, ${p.cuenta}` : p.etiqueta}
        />
      ))}
    </ScrollView>
  );
}

/** Un panel: siempre montado, visible sólo si es el activo. */
export function Panel({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return <View style={visible ? styles.panel : styles.oculto}>{children}</View>;
}

const styles = StyleSheet.create({
  barra: { gap: space.sm, paddingVertical: space.xs },
  panel: { gap: space.base },
  oculto: { display: 'none' },
});
