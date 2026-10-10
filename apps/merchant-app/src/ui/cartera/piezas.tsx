/**
 * Piezas pequeñas que comparten «Mi cartera» y «Consumo y facturación», hechas con las primitivas de
 * la app del cliente.
 *
 * La web pinta tablas (`<table>` con seis columnas y `min-w-[560px]`) que en un teléfono obligan a
 * desplazar de lado. Aquí cada fila de la tabla es una TARJETA o una fila de lista con las mismas
 * columnas: se pierde la alineación en columnas y se gana poder leer una cuota entera sin mover el dedo.
 *
 * Pablo (2026-10-10, sobre capturas de TestFlight): nada de tarjetas-cabecera con título y párrafo ni
 * de tarjetas «Por qué…» al final. Cada sección lleva un título corto y, si de verdad hace falta
 * explicar algo para operar, un ⓘ a su lado que abre el texto de la web en una hoja (`Seccion`).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, space } from '@cliente/theme/tokens';
import { BotonInfo, InfoSheet } from '@cliente/ui/help-sheet';
import { Icon } from '@cliente/ui/icons';
import { AtlasText, Badge, Cargando, Divider, type BadgeTone } from '@cliente/ui/primitives';
import { bob, cuotasTexto, fechaCorta } from '@/features/cartera/formato';

/** El «Cargando…» y el «no hay nada» de los paneles de la web: una línea centrada y discreta. */
export function TextoDePanel({ cargando, vacio, testID }: { cargando: boolean; vacio: string; testID?: string }) {
  if (cargando) return <Cargando texto="Cargando…" />;
  return (
    <AtlasText variant="caption" tone="secondary" align="center" style={styles.vacio} testID={testID}>
      {vacio}
    </AtlasText>
  );
}

/** El `StatusPill` de la web. */
export function Pastilla({ texto, tono = 'neutral' }: { texto: string; tono?: BadgeTone }) {
  return <Badge label={texto} tone={tono} />;
}

/**
 * El título de una sección con su ⓘ. Reemplaza al `CardHeader` con descripción de cada panel: el
 * título queda a la vista y el párrafo, detrás del ⓘ (`info`, uno o varios párrafos).
 * `detalle` es una cifra corta a la derecha («Tarifa: Básica», «2 facturas · Bs 40,00»).
 */
export function Seccion({ titulo, info, detalle, testID }: { titulo: string; info?: string[]; detalle?: string; testID?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <View style={styles.seccion} testID={testID}>
      <AtlasText variant="title" numberOfLines={1} style={styles.seccionTitulo}>
        {titulo}
      </AtlasText>
      {info?.length ? <BotonInfo etiqueta={titulo} onPress={() => setAbierta(true)} testID={testID ? `${testID}-info` : undefined} /> : null}
      <View style={styles.crece} />
      {detalle ? (
        <AtlasText variant="caption" tone="secondary" numberOfLines={1} style={styles.seccionDetalle}>
          {detalle}
        </AtlasText>
      ) : null}
      {info?.length ? (
        <InfoSheet visible={abierta} titulo={titulo} onClose={() => setAbierta(false)}>
          {info.map((parrafo) => (
            <AtlasText key={parrafo} variant="body" tone="secondary">
              {parrafo}
            </AtlasText>
          ))}
        </InfoSheet>
      ) : null}
    </View>
  );
}

/** Una cifra con su etiqueta encima: las casillas de «Comisión por venta». */
export function Cifra({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: 'warning' }) {
  return (
    <View style={styles.cifra} accessible accessibilityLabel={`${etiqueta}: ${valor}`}>
      <AtlasText variant="caption" tone="secondary" numberOfLines={1}>
        {etiqueta}
      </AtlasText>
      <AtlasText variant="h3" tone={tono ?? 'primary'} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </AtlasText>
    </View>
  );
}

/**
 * Una fila «etiqueta · valor» compacta, para las columnas de una tabla web convertida en tarjeta.
 * `fuerte` es la columna que la web pinta en negrita (lo que falta, el total).
 */
export function Dato({ etiqueta, valor, fuerte = false, apagado = false }: { etiqueta: string; valor: string; fuerte?: boolean; apagado?: boolean }) {
  return (
    <View style={styles.dato}>
      <AtlasText variant="caption" tone="secondary">
        {etiqueta}
      </AtlasText>
      <AtlasText variant={fuerte ? 'captionStrong' : 'caption'} tone={apagado ? 'tertiary' : 'primary'} align="right" style={styles.datoValor}>
        {valor}
      </AtlasText>
    </View>
  );
}

/**
 * Un día de cobro en una línea: «dom 08 nov — Bs 240,00 · 1 cuota». Antes eran tarjetas de dos
 * columnas con la fecha, el importe y las cuotas apilados; para treinta días eran quince pantallas.
 */
export function FilaDeDia({ dia, primera }: { dia: { date: string; amount: unknown; installments: number; overdue: boolean }; primera: boolean }) {
  const fecha = fechaCorta(dia.date);
  return (
    <View>
      {primera ? null : <Divider />}
      <View
        style={styles.filaDia}
        accessible
        accessibilityLabel={`${fecha}${dia.overdue ? ', vencido' : ''}: ${bob(dia.amount)}, ${cuotasTexto(dia.installments)}`}
        testID={`dia-${dia.date}`}
      >
        {dia.overdue ? <Icon name="alerta" size={15} tint={color.feedback.warning} /> : null}
        <AtlasText variant="captionStrong" tone={dia.overdue ? 'warning' : 'primary'}>
          {fecha}
        </AtlasText>
        <View style={styles.crece} />
        <AtlasText variant="bodyStrong" numberOfLines={1}>
          {bob(dia.amount)}
        </AtlasText>
        <AtlasText variant="caption" tone="tertiary" numberOfLines={1}>
          {`· ${cuotasTexto(dia.installments)}`}
        </AtlasText>
      </View>
    </View>
  );
}

/**
 * Una cuota en dos líneas: «Cuota 2 · vence vie 09 oct» con su pastilla, y debajo lo que se debe,
 * lo pagado y lo que falta. Son las columnas de la tabla de la web, sin una fila por cifra.
 */
export function FilaDeCuota({
  numero,
  vence,
  debe,
  pagado,
  falta,
  estado,
}: {
  numero: number;
  vence: string;
  debe: unknown;
  pagado: unknown;
  falta: unknown;
  estado: { texto: string; tono: BadgeTone };
}) {
  return (
    <View style={styles.cuota}>
      <Divider />
      <View style={styles.filaEntre}>
        <AtlasText variant="captionStrong">{`Cuota ${numero} · vence ${vence}`}</AtlasText>
        <Pastilla texto={estado.texto} tono={estado.tono} />
      </View>
      <AtlasText variant="caption" tone="secondary">
        {`Debe ${bob(debe)} · Pagado ${bob(pagado)} · `}
        <AtlasText variant="captionStrong">{`Falta ${bob(falta)}`}</AtlasText>
      </AtlasText>
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: { paddingVertical: space.lg },
  crece: { flex: 1 },
  seccion: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingTop: space.xs },
  seccionTitulo: { flexShrink: 1 },
  seccionDetalle: { flexShrink: 1 },
  cifra: { flex: 1, minWidth: '30%', gap: space.xxs },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xxs },
  datoValor: { flexShrink: 1 },
  filaDia: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.md },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cuota: { gap: space.xxs, paddingBottom: space.sm },
});
