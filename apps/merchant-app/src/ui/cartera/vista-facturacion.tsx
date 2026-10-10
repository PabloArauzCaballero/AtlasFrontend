/**
 * «Consumo y facturación». Porte de `MerchantBillingScreen.tsx`.
 *
 * Se leen DOS cosas, como en la web, y se juntan aquí y no en el backend a propósito:
 *  - los cobros reales y sus cuotas, de la cartera del comercio (`/merchant-credit/:id/portfolio`), y
 *  - los cargos y facturas que Atlas le emite (`/portal/billing`).
 * Son dos sistemas con dos ciclos de vida (un cobro ocurre cuando el cliente paga; una factura,
 * cuando Atlas la emite) y fundirlos habría creado una tercera verdad. Por eso cada mitad tiene su
 * propio aviso de error: que falle una no esconde la otra.
 *
 * Las tablas de la web son listas de tarjetas; el «Descargar» de cada factura imprime esa factura
 * con sus líneas (`features/cartera/factura-pdf.ts`) y la entrega por la hoja de compartir.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { SelectField } from '@cliente/ui/form-controls';
import { AtlasText, Button, Card, CardHeader, Chip, Divider } from '@cliente/ui/primitives';
import { merchantCreditService, type Cartera, type PagoDeCartera } from '@/api/servicios/merchantCreditService';
import { portalService } from '@/api/servicios/portalService';
import type { ResourceRow } from '@/api/types';
import { documentoFacturacion } from '@/features/cartera/documentos';
import { ESTADOS, codigoCorto, creditosConCuotas, cuadreDeCobros, cuotasPlanas, estadoDeFactura, estadoDelCargo, type Estado } from '@/features/cartera/estados';
import { descargarFactura, facturaDeComercio } from '@/features/cartera/factura-pdf';
import { bob, formatBob, formatDate, textoDeFallo } from '@/features/cartera/formato';
import { useMerchantScope } from '@/features/cartera/use-merchant-scope';
import type { MerchantPartner } from '@/features/use-merchant-partner';
import { Aviso } from '@/ui/aviso';
import { BotonPdf } from '@/ui/boton-pdf';
import { BarraDePestanas, Panel, usePestana } from '@/ui/pestanas';
import { Resumen } from '@/ui/resumen';
import { Dato, OrigenDeCaja, Pastilla, TextoDePanel } from './piezas';

const VISTAS = ['cobros', 'cuotas', 'cargos'] as const;
const FILTROS = ['todas', 'mora', 'pendiente', 'pagado'] as const;

const fechaDe = (valor: unknown) => formatDate(typeof valor === 'string' ? valor : undefined);

/** Cuándo se factura. Pablo (2026-10-08): «que se aclare que sólo se factura cuando el cliente termina de pagar sus cuotas». */
function AvisoDeFacturacion() {
  return (
    <Aviso tono="info" titulo="Se factura cuando el cliente termina de pagar">
      Atlas factura un crédito sólo cuando el cliente terminó de pagar TODAS sus cuotas. Mientras queden cuotas pendientes o en mora no se emite factura por esa venta.
    </Aviso>
  );
}

export function VistaFacturacion({ partner, vuelta }: { partner: MerchantPartner; vuelta: number }) {
  const scope = useMerchantScope();
  const { accountId, ready, recargar: recargarScope } = scope;
  const [vista, elegirVista] = usePestana(VISTAS);
  const [filtro, setFiltro] = useState<Estado | 'todas'>('todas');
  /* Identificador de la factura que se está imprimiendo: es lo que pone su botón en «generando». */
  const [descargando, setDescargando] = useState<string | null>(null);

  /* Los cargos que Atlas emite: comisión de cada venta, publicidad y suscripciones. */
  const [billing, setBilling] = useState<ResourceRow | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  /* Los cobros reales, por el EXPEDIENTE del comercio (que es como los identifica el núcleo). */
  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [carteraError, setCarteraError] = useState<string | null>(null);
  const [cargandoLaCartera, setCargandoCartera] = useState(true);
  const { partnerId } = partner;

  useEffect(() => {
    if (vuelta > 0) recargarScope();
  }, [vuelta, recargarScope]);

  useEffect(() => {
    if (!ready) return;
    let cancelado = false;
    portalService
      .getBilling(accountId)
      .then((leido) => {
        if (cancelado) return;
        setBilling(leido);
        setBillingError(null);
      })
      .catch((fallo: unknown) => {
        if (!cancelado) setBillingError(textoDeFallo(fallo, 'No se pudo cargar la información.'));
      });
    return () => {
      cancelado = true;
    };
  }, [ready, accountId, vuelta]);

  useEffect(() => {
    if (!partnerId) {
      setCargandoCartera(false);
      return;
    }
    let cancelado = false;
    setCargandoCartera(true);
    merchantCreditService
      .cartera(partnerId)
      .then((leida) => {
        if (cancelado) return;
        setCartera(leida);
        setCarteraError(null);
      })
      .catch((fallo: unknown) => {
        if (!cancelado) setCarteraError(textoDeFallo(fallo, 'No fue posible leer sus cobros.'));
      })
      .finally(() => {
        if (!cancelado) setCargandoCartera(false);
      });
    return () => {
      cancelado = true;
    };
  }, [partnerId, vuelta]);

  const cargandoCartera = cargandoLaCartera || (!partnerId && partner.cargando);
  const data = billing ?? {};
  const summary = (data.summary ?? {}) as ResourceRow;
  const invoices = useMemo(() => ((billing?.invoices ?? []) as ResourceRow[]), [billing]);
  const receivables = useMemo(() => ((billing?.receivables ?? []) as ResourceRow[]), [billing]);

  const resumen = cartera?.summary;
  const tasa = resumen?.mdrRatePercent ?? '0';
  const pagos = useMemo(() => cartera?.payments ?? [], [cartera]);
  const cuotas = useMemo(() => cuotasPlanas(cartera?.credits ?? []), [cartera]);
  const creditosVisibles = useMemo(() => creditosConCuotas(cartera?.credits ?? [], filtro), [cartera, filtro]);
  const { comisionDePagos, cobradoSinPago } = cuadreDeCobros(pagos, resumen?.collected);
  /* Sin expediente, la cartera ni se pide: el aviso de la web es SIN_EXPEDIENTE en el bloque de cobros. */
  const errorDeCobros = carteraError ?? (partner.cargando ? null : partner.error);
  const error = scope.error ?? billingError ?? errorDeCobros;

  async function descargarFacturaEmitida(invoiceId: string) {
    setDescargando(invoiceId);
    try {
      const detalle = await portalService.getBillingInvoice(invoiceId, accountId);
      await descargarFactura(facturaDeComercio(detalle));
    } catch (fallo) {
      Alert.alert('No se pudo descargar la factura', textoDeFallo(fallo, 'Vuelve a intentarlo en un momento.'));
    } finally {
      setDescargando(null);
    }
  }

  return (
    <View style={styles.columna}>
      <BotonPdf
        label="Descargar PDF"
        testID="pdf-facturacion"
        disabled={cargandoCartera && !ready}
        documento={() => documentoFacturacion(cartera, receivables, invoices)}
      />

      {/* Cuándo se factura, a la vista desde cualquier pestaña. */}
      <AvisoDeFacturacion />

      {/*
        Con varios negocios, se pregunta con cuál de los suyos sigue. El comercio no elige comercio:
        sólo su usuario, si administra más de uno, elige entre los SUYOS.
      */}
      {scope.requiresSelection ? (
        <Card padding="tight">
          <SelectField
            label="Negocio"
            value={scope.accountId ?? null}
            onChange={scope.setAccountId}
            placeholder="— Elige uno de tus negocios —"
            hint="Administras varios negocios: elige de cuál quieres ver el consumo."
            ayuda="Comercio afiliado sobre el que se opera."
            opciones={scope.accountOptions.map((cuenta) => ({ valor: cuenta.value, etiqueta: cuenta.label }))}
          />
        </Card>
      ) : null}

      {scope.error ? (
        <Aviso tono="danger" titulo="No se pudo determinar tu negocio">
          {scope.error}
        </Aviso>
      ) : null}
      {errorDeCobros ? (
        <Aviso tono="danger" titulo="No se pudieron cargar sus cobros">
          {errorDeCobros}
        </Aviso>
      ) : null}
      {billingError ? (
        <Aviso tono="danger" titulo="No se pudieron cargar los cargos de Atlas">
          {billingError}
        </Aviso>
      ) : null}

      <Resumen
        testID="resumen-facturacion"
        datos={[
          { label: 'Cobrado', value: cargandoCartera ? '…' : bob(resumen?.collected) },
          { label: `Comisión a Atlas (${tasa} %)`, value: cargandoCartera ? '…' : bob(resumen?.commissionAccrued) },
          { label: 'Pendiente', value: cargandoCartera ? '…' : bob(resumen?.pendingAmount) },
          { label: 'En mora', value: cargandoCartera ? '…' : bob(resumen?.overdueAmount), alerta: Number(resumen?.overdueAmount ?? 0) > 0 },
        ]}
      />

      <BarraDePestanas
        activa={vista}
        onCambiar={elegirVista}
        pestanas={[
          { id: 'cobros', etiqueta: 'Cobros recibidos', icono: 'pagos' },
          { id: 'cuotas', etiqueta: 'Estado de sus cuotas', icono: 'lista' },
          { id: 'cargos', etiqueta: 'Cargos de Atlas', icono: 'billetera' },
        ]}
      />

      <Panel visible={vista === 'cobros'}>
        <Card>
          <CardHeader
            title="Cobros recibidos"
            detail="Cada pago de sus clientes, con la comisión que ese pago le devengó a Atlas."
            icon="pagos"
            trailing={partner.nombre ? <Pastilla texto={partner.nombre} /> : null}
          />
          {cargandoCartera || (pagos.length === 0 && cobradoSinPago === 0) ? (
            <TextoDePanel cargando={cargandoCartera} vacio="Todavía no se ha registrado ningún cobro en sus créditos." />
          ) : (
            pagos.map((pago, indice) => <FilaDePago key={pago.paymentId} pago={pago} tasa={tasa} primera={indice === 0} />)
          )}
        </Card>
        {!cargandoCartera && cobradoSinPago > 0 ? (
          <Aviso tono="warning" titulo="Hay cobros sin pago registrado">
            {`${formatBob(cobradoSinPago)} figuran como cobrados en las cuotas pero no tienen un pago anotado detrás, así que no aparecen en esta tabla. Por eso la comisión de arriba (${bob(resumen?.commissionAccrued)}) es mayor que la que suman estas filas (${formatBob(comisionDePagos)}).`}
          </Aviso>
        ) : null}
      </Panel>

      <Panel visible={vista === 'cuotas'}>
        <Card>
          <CardHeader title="Estado de sus cuotas" detail="Rojo en mora, ámbar pendiente y verde pagado." icon="lista" />
          <View style={styles.filtros} accessibilityRole="radiogroup">
            {FILTROS.map((opcion) => (
              <Chip
                key={opcion}
                label={opcion === 'todas' ? 'Todas' : ESTADOS[opcion].etiqueta}
                count={opcion === 'todas' ? cuotas.length : cuotas.filter((cuota) => cuota.estado === opcion).length}
                selected={filtro === opcion}
                onPress={() => setFiltro(opcion)}
              />
            ))}
          </View>
          {cargandoCartera || creditosVisibles.length === 0 ? (
            <TextoDePanel
              cargando={cargandoCartera}
              vacio={cuotas.length === 0 ? 'No hay créditos originados en su comercio.' : 'Ninguna cuota en ese estado.'}
            />
          ) : null}
        </Card>
        {!cargandoCartera
          ? creditosVisibles.map(({ credito, cuotas: delCredito, saldado }) => (
              <Card key={credito.loanId} padding="tight" testID={`credito-${credito.loanId}`}>
                <View style={styles.cabeceraCredito}>
                  <AtlasText variant="title" accessibilityLabel={`Compra ${credito.applicationCode ?? '—'}, crédito ${credito.loanCode}`}>
                    {`Compra ${credito.applicationCode ?? '—'}`}
                    <AtlasText variant="caption" tone="tertiary">{`  ${codigoCorto(credito.loanCode)}`}</AtlasText>
                  </AtlasText>
                  <OrigenDeCaja origen={credito} />
                  <AtlasText variant="caption" tone="secondary">
                    Fecha de origen: <AtlasText variant="captionStrong">{credito.originatedAt ? formatDate(credito.originatedAt) : '—'}</AtlasText>
                  </AtlasText>
                  <AtlasText variant="caption" tone="secondary">
                    Falta <AtlasText variant="captionStrong">{bob(credito.outstanding)}</AtlasText> de {bob(credito.principalAmount)}
                  </AtlasText>
                  <View style={styles.pastillaSuelta}>
                    <Pastilla texto={saldado ? 'Pagado: listo para facturar' : 'Se factura al terminar de pagar'} tono={saldado ? 'success' : 'neutral'} />
                  </View>
                </View>
                {delCredito.map((cuota) => (
                  <View key={cuota.installmentId} style={styles.cuota}>
                    <Divider />
                    <View style={styles.filaEntre}>
                      <AtlasText variant="captionStrong">{`Cuota ${cuota.installmentNumber} · vence ${formatDate(cuota.dueDate)}`}</AtlasText>
                      <Pastilla
                        texto={cuota.estado === 'mora' && cuota.daysPastDue > 0 ? `En mora ${cuota.daysPastDue} d` : ESTADOS[cuota.estado].etiqueta}
                        tono={ESTADOS[cuota.estado].tono}
                      />
                    </View>
                    <Dato etiqueta="Importe" valor={bob(cuota.amountDue)} />
                    <Dato etiqueta="Pagado" valor={bob(cuota.amountPaid)} apagado />
                    <Dato etiqueta="Falta" valor={bob(cuota.amountOutstanding)} fuerte />
                  </View>
                ))}
              </Card>
            ))
          : null}
      </Panel>

      <Panel visible={vista === 'cargos'}>
        {ready && !billingError ? (
          <>
            <Card>
              <CardHeader
                title="Cargos de Atlas"
                detail="Lo que Atlas le factura: la comisión de cada venta, la publicidad y su tarifa."
                icon="billetera"
                trailing={<Pastilla texto={`Tarifa: ${String(summary.planName ?? 'sin tarifa')}`} />}
              />
              {billing === null ? (
                <TextoDePanel cargando vacio="" />
              ) : receivables.length ? (
                receivables.map((receivable, indice) => {
                  const estado = estadoDelCargo(
                    String(receivable.status ?? ''),
                    Number(receivable.amountOpen ?? 0),
                    typeof receivable.dueDate === 'string' ? receivable.dueDate : undefined,
                  );
                  return (
                    <View key={String(receivable.id)} style={styles.fila}>
                      {indice > 0 ? <Divider /> : null}
                      <View style={styles.filaEntre}>
                        <AtlasText variant="title" style={styles.crece} numberOfLines={2}>
                          {String(receivable.sourceType ?? '—')}
                        </AtlasText>
                        <Pastilla texto={ESTADOS[estado].etiqueta} tono={ESTADOS[estado].tono} />
                      </View>
                      <Dato etiqueta="Emitido" valor={fechaDe(receivable.issuedAt)} />
                      <Dato etiqueta="Vencimiento" valor={fechaDe(receivable.dueDate)} />
                      <Dato etiqueta="Original" valor={bob(receivable.amountOriginal)} />
                      <Dato etiqueta="Saldo" valor={bob(receivable.amountOpen)} fuerte />
                    </View>
                  );
                })
              ) : (
                <TextoDePanel cargando={false} vacio="Atlas todavía no le ha emitido ningún cargo." />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Facturas emitidas"
                icon="documento"
                detail={`${String(summary.invoiceCount ?? 0)} factura(s) · ${bob(summary.invoicedTotal)} facturado`}
              />
              {invoices.length ? (
                invoices.map((invoice, indice) => {
                  const estado = estadoDeFactura(invoice);
                  const id = String(invoice.id);
                  return (
                    <View key={id} style={styles.fila}>
                      {indice > 0 ? <Divider /> : null}
                      <View style={styles.filaEntre}>
                        <AtlasText variant="title" style={styles.crece} numberOfLines={1}>
                          {String(invoice.invoiceNumber ?? '—')}
                        </AtlasText>
                        <Pastilla texto={ESTADOS[estado].etiqueta} tono={ESTADOS[estado].tono} />
                      </View>
                      <Dato etiqueta="Fecha" valor={fechaDe(invoice.invoiceDate)} />
                      <Dato etiqueta="Vencimiento" valor={fechaDe(invoice.dueDate)} />
                      <Dato etiqueta="Total" valor={bob(invoice.totalAmount)} fuerte />
                      <Button
                        label="Descargar"
                        icon="descargar"
                        variant="secondary"
                        loading={descargando === id}
                        disabled={descargando !== null && descargando !== id}
                        onPress={() => void descargarFacturaEmitida(id)}
                        testID={`descargar-factura-${id}`}
                      />
                    </View>
                  );
                })
              ) : (
                <TextoDePanel cargando={false} vacio="Este comercio aún no tiene facturas emitidas." />
              )}
            </Card>
          </>
        ) : null}
      </Panel>

      {!ready && !error ? (
        <Aviso tono="info" titulo="Elige un negocio">
          Administras varios negocios: elige de cuál quieres ver los cargos que Atlas le factura.
        </Aviso>
      ) : null}

      <Aviso tono="info" titulo="Cómo se cobra la comisión">
        {`La comisión se devenga sobre lo que usted COBRA, no sobre lo que vende: una cuota impagada no genera comisión, y un pago revertido la devuelve. La tasa vigente es ${tasa} % y se pactó en su alta desde el ERP interno de Atlas.`}
      </Aviso>
    </View>
  );
}

/**
 * Un cobro. Un pago revertido NO es un cobro: se enseña, porque ocurrió, pero apagado y sin
 * comisión. Ocultarlo dejaría un hueco inexplicable en la cuenta.
 */
function FilaDePago({ pago, tasa, primera }: { pago: PagoDeCartera; tasa: string; primera: boolean }) {
  return (
    <View style={[styles.fila, pago.reversed ? styles.revertido : null]} testID={`cobro-${pago.paymentId}`}>
      {primera ? null : <Divider />}
      <View style={styles.filaEntre}>
        <AtlasText variant="title" style={styles.crece}>
          {formatDate(pago.receivedAt)}
        </AtlasText>
        <Pastilla texto={pago.reversed ? 'Revertido' : 'Pagado'} tono={pago.reversed ? 'neutral' : 'success'} />
      </View>
      <Dato etiqueta="Crédito" valor={pago.loanCode} apagado={pago.reversed} />
      <Dato etiqueta="Cuota(s)" valor={pago.installmentNumbers.length ? pago.installmentNumbers.join(', ') : '—'} apagado={pago.reversed} />
      <Dato etiqueta="Medio" valor={pago.paymentMethod} apagado />
      <Dato etiqueta="Importe" valor={bob(pago.amount)} apagado={pago.reversed} />
      <Dato etiqueta={`Comisión (${tasa} %)`} valor={bob(pago.commissionAccrued)} fuerte apagado={pago.reversed} />
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { gap: space.base },
  crece: { flex: 1 },
  fila: { gap: space.xxs, paddingVertical: space.xs },
  revertido: { opacity: 0.6 },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.sm },
  cabeceraCredito: { gap: space.xxs, paddingBottom: space.sm },
  pastillaSuelta: { alignItems: 'flex-start', paddingTop: space.xs },
  cuota: { gap: space.xxs, paddingBottom: space.xs },
});
