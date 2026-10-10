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
 *
 * Pablo (2026-10-10): el título de cada tarjeta era el código interno («CRA-b51c9eaa-bde4-…») y los
 * filtros ocupaban media pantalla. Ahora el IMPORTE es el título, el estado y el tipo van en
 * pastillas, y lo demás en UNA línea («9 oct, 14:03 · Casa matriz · Caja 5»), con la referencia corta
 * del código en gris al final. Los filtros van detrás de un botón «Filtros» con el número de filtros
 * puestos, en una hoja; el total es una línea pequeña al lado.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { DateField, SelectField } from '@cliente/ui/form-controls';
import { BottomSheet } from '@cliente/ui/help-sheet';
import { AtlasText, Badge, Button, Card, EmptyState, SkeletonLista } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { merchantCreditService, type FiltroDeHistorial, type HistorialDePos } from '@/api/servicios/merchantCreditService';
import { formatBob } from '@/features/gestion-pos/formato';
import {
  FILTRO_INICIAL,
  aplicarFiltro,
  cuantosFiltros,
  estadoDe,
  fechaDeFiltro,
  hayFiltros as calcularHayFiltros,
  lineaDelMovimiento,
  lineaDelTotal,
  opcionesDeCaja,
  opcionesDeSucursal,
  textoDePagina,
  textoVacioDelHistorial,
  tipoDe,
} from '@/features/gestion-pos/historial';
import { useRegistrarRecarga, type Recargas } from '@/features/gestion-pos/recargas';
import { refCorta } from '@/features/gestion-pos/tarjetas';
import { Aviso } from '@/ui/aviso';
import { CabeceraDeImporte, LineaSecundaria } from './piezas';

export const ID_HISTORIAL = 'historial';

export function PanelHistorial({ partnerId, recargas }: { partnerId: string; recargas: Recargas }) {
  const [filtro, setFiltro] = useState<FiltroDeHistorial>(FILTRO_INICIAL);
  const [datos, setDatos] = useState<HistorialDePos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

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
  const puestos = cuantosFiltros(filtro);
  const total = lineaDelTotal(datos, hayFiltros);

  return (
    <View style={styles.panel}>
      {error ? <Aviso tono="danger">{error}</Aviso> : null}

      <View style={styles.barra}>
        <AtlasText variant="caption" tone="secondary" style={styles.totalTexto} testID="historial-total" accessibilityLabel={total.texto}>
          <AtlasText variant="captionStrong">
            {total.cuenta} {total.operaciones}
          </AtlasText>
          {' · '}
          <AtlasText variant="captionStrong">{total.importe}</AtlasText> confirmados{total.cola}
        </AtlasText>
        <Button
          label={puestos ? `Filtros · ${puestos}` : 'Filtros'}
          variant={puestos ? 'secondary' : 'ghost'}
          icon="filtro"
          disabled={!partnerId}
          onPress={() => setFiltrosAbiertos(true)}
          accessibilityLabel={puestos ? `Filtros, ${puestos} ${puestos === 1 ? 'puesto' : 'puestos'}` : 'Filtros'}
          testID="historial-abrir-filtros"
        />
      </View>

      <BottomSheet visible={filtrosAbiertos} titulo="Filtros" onClose={() => setFiltrosAbiertos(false)}>
        <View style={styles.filtros} testID="historial-filtros">
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
          {hayFiltros ? (
            <Button label="Quitar filtros" variant="ghost" icon="cerrar" onPress={() => setFiltro(FILTRO_INICIAL)} testID="historial-quitar-filtros" />
          ) : null}
        </View>
      </BottomSheet>

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
              <CabeceraDeImporte importe={formatBob(m.amount)} estado={estadoDe(m).texto} tono={estadoDe(m).tono} variante="h3" />
              <View style={styles.detalle}>
                <Badge label={tipoDe(m).texto} tone={tipoDe(m).tono} />
                <View style={styles.linea}>
                  <LineaSecundaria texto={lineaDelMovimiento(m)} referencia={refCorta(m.code)} />
                </View>
              </View>
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
  panel: { gap: space.md },
  barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  totalTexto: { flexShrink: 1 },
  filtros: { gap: space.base, paddingBottom: space.lg },
  lista: { gap: space.sm },
  detalle: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  linea: { flex: 1, paddingTop: space.xxs },
  // La opacidad de la web mientras llega la página nueva: se ve que lo de debajo está por cambiar.
  recargando: { opacity: 0.6 },
  paginas: { gap: space.sm },
  paginasBotones: { flexDirection: 'row', gap: space.sm },
  paginaBoton: { flex: 1 },
});
