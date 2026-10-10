/**
 * «Mi cartera»: qué le deben al comercio, quién y cuándo. Porte de `MerchantPortfolioScreen.tsx`.
 *
 * Cuatro vistas sobre UNA lectura (`/merchant-credit/:id/portfolio`), porque responden con los
 * mismos datos: el panel resume, los créditos abren el detalle cuota a cuota, el calendario dice qué
 * entra cada día y la comisión dice lo que Atlas devenga. Tres consultas separadas se habrían
 * desincronizado en cuanto una cambiara su forma de contar.
 *
 * Al lado, un SEGUNDO libro: lo que el ERP ya le FACTURÓ por comisión (`/portal/commissions`). Falla
 * aparte —que no cargue no puede esconder la cartera— y por eso su error se traga en silencio,
 * igual que en la web.
 *
 * No aparece la identidad de ningún cliente: el comercio necesita saber que la cuota 3 de una
 * operación suya vence el martes, no quién es la persona.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, space } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { AtlasText, Card, CardHeader, Divider, SectionHeader } from '@cliente/ui/primitives';
import { merchantCreditService, type Cartera, type CreditoDeCartera } from '@/api/servicios/merchantCreditService';
import { portalService } from '@/api/servicios/portalService';
import { documentoCartera } from '@/features/cartera/documentos';
import { bob, fechaCorta, textoDeFallo } from '@/features/cartera/formato';
import type { MerchantPartner } from '@/features/use-merchant-partner';
import { Aviso } from '@/ui/aviso';
import { BotonPdf } from '@/ui/boton-pdf';
import { BarraDePestanas, Panel, usePestana } from '@/ui/pestanas';
import { Resumen } from '@/ui/resumen';
import { Cifra, Dato, Pastilla, TextoDePanel } from './piezas';

const VISTAS = ['panel', 'creditos', 'calendario', 'comision'] as const;

type ComisionFacturada = Awaited<ReturnType<typeof portalService.commissions>>;

export function VistaCartera({ partner, vuelta }: { partner: MerchantPartner; vuelta: number }) {
  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [facturado, setFacturado] = useState<ComisionFacturada | null>(null);
  const [cargandoCartera, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, elegirVista] = usePestana(VISTAS);
  const [abierto, setAbierto] = useState<string | null>(null);
  const { partnerId } = partner;

  useEffect(() => {
    if (!partnerId) {
      // Sin expediente no hay cartera que pedir: el aviso lo pone `partner.error` (SIN_EXPEDIENTE).
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    (async () => {
      try {
        const leida = await merchantCreditService.cartera(partnerId);
        const libro = await portalService.commissions().catch(() => null);
        if (cancelado) return;
        setCartera(leida);
        setFacturado(libro);
        setError(null);
      } catch (fallo) {
        if (!cancelado) setError(textoDeFallo(fallo, 'No fue posible leer su cartera.'));
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [partnerId, vuelta]);

  // Mientras se resuelve el expediente también se está cargando: no hay que decir «no hay cuotas».
  const cargando = cargandoCartera || (!partnerId && partner.cargando);
  const resumen = cartera?.summary;
  const proximos = useMemo(() => (cartera?.calendar ?? []).slice(0, 30), [cartera]);
  const creditos = cartera?.credits ?? [];
  const avisoDeError = error ?? partner.error;

  return (
    <View style={styles.columna}>
      <BotonPdf
        label="Descargar PDF"
        testID="pdf-cartera"
        disabled={cargando || !cartera}
        documento={() => documentoCartera(cartera, partner.nombre)}
      />

      {avisoDeError ? <Aviso tono="danger">{avisoDeError}</Aviso> : null}

      <Resumen
        testID="resumen-cartera"
        datos={[
          { label: 'Por cobrar', value: cargando ? '…' : bob(resumen?.outstanding) },
          { label: 'Vencido', value: cargando ? '…' : bob(resumen?.overdueAmount), alerta: Number(resumen?.overdueAmount ?? 0) > 0 },
          { label: 'Cobrado', value: cargando ? '…' : bob(resumen?.collected) },
          { label: `Comisión a Atlas (${resumen?.mdrRatePercent ?? '0'} %)`, value: cargando ? '…' : bob(resumen?.commissionAccrued) },
        ]}
      />

      <BarraDePestanas
        activa={vista}
        onCambiar={elegirVista}
        pestanas={[
          { id: 'panel', etiqueta: 'Panel', icono: 'cuadricula' },
          { id: 'creditos', etiqueta: 'Créditos', icono: 'documento' },
          { id: 'calendario', etiqueta: 'Calendario', icono: 'reloj' },
          { id: 'comision', etiqueta: 'Comisión', icono: 'grafico' },
        ]}
      />

      <Panel visible={vista === 'panel'}>
        <Card>
          <CardHeader title="Los próximos cobros" detail="Lo que debería entrar en los siguientes días." icon="reloj" />
          {cargando || proximos.length === 0 ? (
            <TextoDePanel cargando={cargando} vacio="No hay cuotas pendientes de cobro." />
          ) : (
            proximos.slice(0, 8).map((dia, indice) => (
              <View key={dia.date}>
                {indice > 0 ? <Divider inset /> : null}
                <View style={styles.filaDia}>
                  <Icon name={dia.overdue ? 'alerta' : 'reloj'} size={17} tint={dia.overdue ? color.feedback.warning : color.text.tertiary} />
                  <View style={styles.crece}>
                    <AtlasText variant="title">{fechaCorta(dia.date)}</AtlasText>
                    {dia.overdue ? <Pastilla texto="Vencido" tono="warning" /> : null}
                  </View>
                  <View style={styles.derecha}>
                    <AtlasText variant="bodyStrong">{bob(dia.amount)}</AtlasText>
                    <AtlasText variant="micro" tone="tertiary">{`${dia.installments} cuota(s)`}</AtlasText>
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>
      </Panel>

      <Panel visible={vista === 'creditos'}>
        <Card>
          <CardHeader title="Créditos pendientes de pago" detail="Abra uno para ver su detalle cuota a cuota." icon="documento" />
          {cargando || creditos.length === 0 ? (
            <TextoDePanel cargando={cargando} vacio="No hay créditos originados en su comercio." />
          ) : (
            creditos.map((credito, indice) => (
              <View key={credito.loanId}>
                {indice > 0 ? <Divider /> : null}
                <FilaDeCredito credito={credito} abierto={abierto === credito.loanId} onAlternar={() => setAbierto(abierto === credito.loanId ? null : credito.loanId)} />
              </View>
            ))
          )}
        </Card>
      </Panel>

      <Panel visible={vista === 'calendario'}>
        <SectionHeader title="Calendario de cobros" detail="Cuánto debería entrar cada día." />
        {cargando || proximos.length === 0 ? (
          <Card>
            <TextoDePanel cargando={cargando} vacio="No hay cobros programados." />
          </Card>
        ) : (
          <View style={styles.rejilla}>
            {proximos.map((dia) => (
              <Card key={dia.date} tone={dia.overdue ? 'warning' : 'default'} padding="tight" style={styles.celda}>
                <View style={styles.filaEntre}>
                  <AtlasText variant="captionStrong">{fechaCorta(dia.date)}</AtlasText>
                  {dia.overdue ? <Pastilla texto="Vencido" tono="warning" /> : null}
                </View>
                <AtlasText variant="h3" numberOfLines={1} adjustsFontSizeToFit>
                  {bob(dia.amount)}
                </AtlasText>
                <AtlasText variant="caption" tone="tertiary">{`${dia.installments} cuota(s)`}</AtlasText>
              </Card>
            ))}
          </View>
        )}
      </Panel>

      <Panel visible={vista === 'comision'}>
        <Card>
          <CardHeader
            title="Comisión por venta"
            detail="Lo que Atlas le cobra por el servicio. Se devenga sólo sobre lo que usted cobra."
            icon="grafico"
          />
          <View style={styles.cifras}>
            <Cifra etiqueta="Tasa de comisión" valor={`${resumen?.mdrRatePercent ?? '0'} %`} nota="Sobre cada venta financiada" />
            <Cifra etiqueta="Cobrado (base)" valor={bob(resumen?.collected)} nota="Lo que sus clientes ya pagaron" />
            <Cifra etiqueta="Comisión a Atlas" valor={bob(resumen?.commissionAccrued)} nota="Devengada sobre lo cobrado" />
          </View>
        </Card>

        {creditos.length === 0 ? (
          <Card>
            <TextoDePanel cargando={false} vacio="Todavía no hay ventas financiadas en su comercio." />
          </Card>
        ) : (
          <Card padding="tight">
            {creditos.map((credito, indice) => (
              <View key={credito.loanId} style={styles.filaComision}>
                {indice > 0 ? <Divider /> : null}
                <View style={styles.filaEntre}>
                  <AtlasText variant="title" numberOfLines={1} style={styles.crece}>
                    {credito.loanCode}
                  </AtlasText>
                  <Pastilla texto={credito.status} tono={Number(credito.outstanding) === 0 ? 'success' : 'neutral'} />
                </View>
                <Dato etiqueta="Cobrado" valor={bob(credito.collected)} />
                <Dato etiqueta={`Comisión (${resumen?.mdrRatePercent ?? '0'} %)`} valor={bob(credito.commissionAccrued)} fuerte />
              </View>
            ))}
          </Card>
        )}

        <Aviso tono="info" titulo="Cómo se cobra">
          La comisión se devenga a medida que sus clientes pagan: un crédito aprobado que aún no cobra no genera comisión, y una venta pagada al 100 % la genera completa. La tasa se pactó en su alta desde el ERP interno de Atlas.
        </Aviso>

        {facturado ? (
          <Card testID="comision-facturada">
            <AtlasText variant="micro" tone="tertiary">
              LO QUE ATLAS YA LE FACTURÓ
            </AtlasText>
            <View style={styles.cifras}>
              <Cifra
                etiqueta={`Facturado (${Number(facturado.summary?.salesCharged ?? 0)} ventas)`}
                valor={bob(facturado.summary?.chargedTotal)}
              />
              <Cifra etiqueta="Ya pagado por usted" valor={bob(facturado.summary?.settled)} />
              <Cifra etiqueta="Pendiente de pago a Atlas" valor={bob(facturado.summary?.owedToAtlas)} tono="warning" />
            </View>
            <AtlasText variant="caption" tone="tertiary">
              Devengado y facturado no son el mismo número y no tienen por qué coincidir: lo primero crece con cada cobro suyo, lo segundo sólo cuando Atlas emite el cargo. La diferencia es comisión ya generada que todavía no se le ha facturado.
            </AtlasText>
          </Card>
        ) : null}
      </Panel>

      <Aviso tono="info" titulo="Por qué no ve nombres">
        Su cartera dice qué operación vence y cuándo, no quién la debe. El comercio decide sobre la operación; el expediente del cliente es suyo y no de quien le vendió.
      </Aviso>
    </View>
  );
}

/** Un crédito plegado (código, cuotas, estado, por cobrar) que se abre en sus cuotas. */
function FilaDeCredito({ credito, abierto, onAlternar }: { credito: CreditoDeCartera; abierto: boolean; onAlternar: () => void }) {
  return (
    <View>
      <Pressable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${credito.loanCode}, por cobrar ${bob(credito.outstanding)}`}
        style={styles.filaCredito}
        testID={`credito-${credito.loanId}`}
      >
        <View style={styles.crece}>
          <AtlasText variant="title" numberOfLines={1}>
            {credito.loanCode}
          </AtlasText>
          <AtlasText variant="caption" tone="secondary">{`${credito.installments.length} cuotas · ${credito.status}`}</AtlasText>
        </View>
        <View style={styles.derecha}>
          <AtlasText variant="micro" tone="tertiary">
            POR COBRAR
          </AtlasText>
          <AtlasText variant="bodyStrong">{bob(credito.outstanding)}</AtlasText>
        </View>
        <View style={abierto ? styles.flechaAbierta : undefined}>
          <Icon name="adelante" size={18} tint={color.text.tertiary} />
        </View>
      </Pressable>
      {abierto
        ? credito.installments.map((cuota) => (
            <View key={cuota.installmentId} style={styles.cuota}>
              <View style={styles.filaEntre}>
                <AtlasText variant="captionStrong">{`Cuota ${cuota.installmentNumber} · vence ${fechaCorta(cuota.dueDate)}`}</AtlasText>
                <Pastilla
                  texto={cuota.overdue ? `Mora ${cuota.daysPastDue}d` : cuota.status}
                  tono={cuota.overdue ? 'warning' : Number(cuota.amountOutstanding) === 0 ? 'success' : 'neutral'}
                />
              </View>
              <Dato etiqueta="Debe" valor={bob(cuota.amountDue)} />
              <Dato etiqueta="Pagado" valor={bob(cuota.amountPaid)} apagado />
              <Dato etiqueta="Falta" valor={bob(cuota.amountOutstanding)} fuerte />
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { gap: space.base },
  crece: { flex: 1, gap: space.xxs },
  derecha: { alignItems: 'flex-end', gap: space.xxs },
  filaDia: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  filaCredito: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  flechaAbierta: { transform: [{ rotate: '90deg' }] },
  cuota: { gap: space.xxs, paddingVertical: space.sm, paddingLeft: space.md, borderLeftWidth: 2, borderLeftColor: color.border.subtle, marginBottom: space.sm },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  celda: { flexBasis: '47%', flexGrow: 1, gap: space.xs },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingVertical: space.sm },
  filaComision: { gap: space.xxs, paddingVertical: space.xs },
});
