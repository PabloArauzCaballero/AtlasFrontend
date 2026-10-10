/**
 * Pestaña «Historial». Porte de `MerchantPosHistoryScreen`.
 *
 * Las solicitudes ya respondidas y los pagos ya verificados —iniciales y de cuota— en UNA lista, de
 * lo más reciente a lo más antiguo, con la sucursal y la caja de cada fila («pueden haber dos montos
 * iguales pero de cajas distintas», Pablo, 2026-10-08). Filtros de sucursal, caja y fechas; páginas
 * de 20; el total es del filtro entero, que es lo que se compara al cerrar la caja.
 *
 * La tabla de ocho columnas de la web es aquí una tarjeta por fila: en un teléfono una tabla de
 * 760 px obliga a desplazar de lado para encontrar el importe, que es lo único que se vino a mirar.
 * Cada tarjeta lleva los mismos ocho datos, con el código y el estado arriba.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { DateField, SelectField } from '@cliente/ui/form-controls';
import { AtlasText, Badge, Button, Card, CardHeader, EmptyState, KeyValue, SkeletonLista } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { merchantCreditService, type FiltroDeHistorial, type HistorialDePos } from '@/api/servicios/merchantCreditService';
import { fechaDelHistorial, formatBob } from '@/features/gestion-pos/formato';
import {
  FILTRO_INICIAL,
  aplicarFiltro,
  estadoDe,
  fechaDeFiltro,
  hayFiltros as calcularHayFiltros,
  lineaDelTotal,
  opcionesDeCaja,
  opcionesDeSucursal,
  textoDePagina,
  textoVacioDelHistorial,
  tipoDe,
} from '@/features/gestion-pos/historial';
import { nombreDeCaja } from '@/features/gestion-pos/origen-de-caja';
import { useRegistrarRecarga, type Recargas } from '@/features/gestion-pos/recargas';
import { Aviso } from '@/ui/aviso';

export const ID_HISTORIAL = 'historial';

export function PanelHistorial({ partnerId, recargas }: { partnerId: string; recargas: Recargas }) {
  const [filtro, setFiltro] = useState<FiltroDeHistorial>(FILTRO_INICIAL);
  const [datos, setDatos] = useState<HistorialDePos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    /*
     * Sin expediente la web se queda en «Cargando…» para siempre (su `recargar` sale sin bajar la
     * bandera). Aquí se baja: es exactamente el estado que las otras dos colas de la web corrigieron
     * —«se lee como "el sistema está pensando" cuando no hay nada que pedir»—, y el motivo ya lo
     * dice el aviso de arriba de la pantalla.
     */
    if (!partnerId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      setDatos(await merchantCreditService.historialPos(partnerId, filtro));
    } catch (fallo) {
      setError(mensajeDeError(fallo, 'No fue posible cargar el historial.'));
    } finally {
      setCargando(false);
    }
  }, [partnerId, filtro]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  useRegistrarRecarga(recargas, ID_HISTORIAL, recargar);

  const filtros = datos?.filters ?? null;
  const cambiar = (cambio: Partial<FiltroDeHistorial>) => setFiltro((actual) => aplicarFiltro(actual, cambio, filtros));
  const sucursales = useMemo(() => opcionesDeSucursal(filtros), [filtros]);
  const cajas = useMemo(() => opcionesDeCaja(filtros, filtro.branchId), [filtros, filtro.branchId]);
  const hayFiltros = calcularHayFiltros(filtro);
  const total = lineaDelTotal(datos, hayFiltros);

  return (
    <View style={styles.panel}>
      {error ? <Aviso tono="danger">{error}</Aviso> : null}

      <Card testID="historial-filtros">
        <CardHeader
          title="Historial de la caja"
          detail="Solicitudes respondidas y pagos verificados, de lo más reciente a lo más antiguo, con la sucursal y la caja de cada uno."
          icon="reloj"
        />
        <Button
          label="Actualizar"
          variant="secondary"
          icon="refrescar"
          disabled={!partnerId}
          loading={cargando}
          onPress={() => void recargar()}
          testID="actualizar-historial"
        />
        <SelectField
          label="Sucursal"
          value={filtro.branchId ?? ''}
          opciones={sucursales}
          onChange={(valor) => cambiar({ branchId: valor || undefined })}
          ayuda="Muestra sólo lo que pasó en esa sucursal."
        />
        <SelectField
          label="Caja"
          value={filtro.terminalId ?? ''}
          opciones={cajas}
          onChange={(valor) => cambiar({ terminalId: valor || undefined })}
          ayuda="Muestra sólo lo que pasó en esa caja. Con una sucursal elegida, sólo aparecen sus cajas."
        />
        <DateField
          label="Fecha inicio"
          value={filtro.from ?? ''}
          onChange={(valor) => cambiar({ from: valor || undefined })}
          ayuda="Desde qué día (incluido), en hora de Bolivia."
          placeholder="Sin fecha"
          maximumDate={fechaDeFiltro(filtro.to)}
        />
        <DateField
          label="Fecha fin"
          value={filtro.to ?? ''}
          onChange={(valor) => cambiar({ to: valor || undefined })}
          ayuda="Hasta qué día (incluido), en hora de Bolivia."
          placeholder="Sin fecha"
          minimumDate={fechaDeFiltro(filtro.from)}
        />
      </Card>

      <View style={styles.total} testID="historial-total" accessible accessibilityLabel={total.texto}>
        <AtlasText variant="body" tone="secondary" style={styles.totalTexto}>
          <AtlasText variant="bodyStrong">{total.cuenta}</AtlasText> {total.operaciones} · confirmado{' '}
          <AtlasText variant="bodyStrong">{total.importe}</AtlasText>
          {total.cola}
        </AtlasText>
        {hayFiltros ? (
          <Button label="Quitar filtros" variant="ghost" icon="cerrar" onPress={() => setFiltro(FILTRO_INICIAL)} testID="historial-quitar-filtros" />
        ) : null}
      </View>

      {cargando && !datos ? (
        <SkeletonLista filas={3} alto={120} texto="Cargando…" />
      ) : !datos || datos.items.length === 0 ? (
        <Card>
          <EmptyState icon="lista" title={textoVacioDelHistorial(hayFiltros)} detail="" />
        </Card>
      ) : (
        <View style={[styles.lista, cargando ? styles.recargando : null]} testID="historial-pos">
          {datos.items.map((m) => (
            <Card key={m.id} padding="tight" testID={`historial-${m.id}`}>
              <CardHeader title={m.code} trailing={<Badge label={estadoDe(m).texto} tone={estadoDe(m).tono} dot />} divider={false} />
              <View style={styles.tipo}>
                <Badge label={tipoDe(m).texto} tone={tipoDe(m).tono} />
              </View>
              <KeyValue label="Fecha" value={fechaDelHistorial(m.happenedAt)} />
              <KeyValue label="Sucursal" value={m.branchName ?? '—'} />
              <KeyValue label="Caja" value={nombreDeCaja(m) ?? '—'} tone="brand" />
              <KeyValue label="Importe" value={formatBob(m.amount)} numeric />
              <KeyValue label="Referencia" value={m.reference ?? '—'} />
            </Card>
          ))}
        </View>
      )}

      {datos && datos.pages > 1 ? (
        <View style={styles.paginas} accessibilityLabel="Páginas del historial">
          <AtlasText variant="caption" tone="secondary" align="center" testID="historial-pagina">
            {textoDePagina(datos)}
          </AtlasText>
          <View style={styles.paginasBotones}>
            <Button
              label="Anterior"
              variant="secondary"
              icon="atras"
              disabled={datos.page <= 1 || cargando}
              onPress={() => cambiar({ page: datos.page - 1 })}
              style={styles.paginaBoton}
              testID="historial-anterior"
            />
            <Button
              label="Siguiente"
              variant="secondary"
              icon="adelante"
              disabled={datos.page >= datos.pages || cargando}
              onPress={() => cambiar({ page: datos.page + 1 })}
              style={styles.paginaBoton}
              testID="historial-siguiente"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.base },
  total: { gap: space.sm },
  totalTexto: { flexShrink: 1 },
  lista: { gap: space.sm },
  // La opacidad de la web mientras llega la página nueva: se ve que lo de debajo está por cambiar.
  recargando: { opacity: 0.6 },
  tipo: { flexDirection: 'row' },
  paginas: { gap: space.sm },
  paginasBotones: { flexDirection: 'row', gap: space.sm },
  paginaBoton: { flex: 1 },
});
