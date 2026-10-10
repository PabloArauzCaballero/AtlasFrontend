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
 * Las tablas de la web son listas de tarjetas; el ícono de descarga de cada factura imprime esa
 * factura con sus líneas (`features/cartera/factura-pdf.ts`) y la entrega por la hoja de compartir.
 * El PDF de toda la vista lo imprime el ícono de la cabecera de la pantalla, que lee `pdf`.
 */
import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { color, space } from '@cliente/theme/tokens';
import { SelectField } from '@cliente/ui/form-controls';
import { AtlasText, Card, Chip, IconButton } from '@cliente/ui/primitives';
import { merchantCreditService, type Cartera, type PagoDeCartera } from '@/api/servicios/merchantCreditService';
import { portalService } from '@/api/servicios/portalService';
import type { ResourceRow } from '@/api/types';
import { documentoFacturacion } from '@/features/cartera/documentos';
import { ESTADOS, codigoCorto, creditosConCuotas, cuadreDeCobros, cuotasPlanas, conceptoDeCargo, estadoDeCredito, estadoDeFactura, estadoDelCargo, medioDePago, textoDeOrigen, type Estado } from '@/features/cartera/estados';
import { descargarFactura, facturaDeComercio } from '@/features/cartera/factura-pdf';
import { bob, formatBob, formatDate, tasaCorta, textoDeFallo } from '@/features/cartera/formato';
import { useMerchantScope } from '@/features/cartera/use-merchant-scope';
import type { DocumentoPdf } from '@/features/pdf';
import type { MerchantPartner } from '@/features/use-merchant-partner';
import { Aviso } from '@/ui/aviso';
import { BarraDePestanas, Panel, usePestana } from '@/ui/pestanas';
import { Resumen } from '@/ui/resumen';
import { Dato, FilaDeCuota, Pastilla, Seccion, TextoDePanel } from './piezas';

const VISTAS = ['cobros', 'cuotas', 'cargos'] as const;
const FILTROS = ['todas', 'mora', 'pendiente', 'pagado'] as const;

const fechaDe = (valor: unknown) => formatDate(typeof valor === 'string' ? valor : undefined);

/*
 * Los textos de los ⓘ. Son los de la web: las descripciones de cada panel y los avisos «Se factura
 * cuando el cliente termina de pagar» (Pablo, 2026-10-08: «que se aclare que sólo se factura cuando el
 * cliente termina de pagar sus cuotas») y «Cómo se cobra la comisión», que eran tarjetas a la vista.
 */
const SE_FACTURA =
  'Se factura cuando el cliente termina de pagar: Atlas factura un crédito sólo cuando el cliente terminó de pagar TODAS sus cuotas. Mientras queden cuotas pendientes o en mora no se emite factura por esa venta.';
const infoCobros = (tasa: string) => [
  'Cada pago de sus clientes, con la comisión que ese pago le devengó a Atlas.',
  `Cómo se cobra la comisión: se devenga sobre lo que usted COBRA, no sobre lo que vende: una cuota impagada no genera comisión, y un pago revertido la devuelve. La tasa vigente es ${tasa} % y se pactó en su alta desde el ERP interno de Atlas.`,
];
const INFO_CUOTAS = ['Rojo en mora, ámbar pendiente y verde pagado.', SE_FACTURA];
const INFO_CARGOS = ['Lo que Atlas le factura: la comisión de cada venta, la publicidad y su tarifa.', SE_FACTURA];

export function VistaFacturacion({ partner, vuelta, pdf }: { partner: MerchantPartner; vuelta: number; pdf: MutableRefObject<(() => DocumentoPdf) | null> }) {
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
  const tasa = tasaCorta(resumen?.mdrRatePercent);
  const pagos = useMemo(() => cartera?.payments ?? [], [cartera]);
  const cuotas = useMemo(() => cuotasPlanas(cartera?.credits ?? []), [cartera]);
  const creditosVisibles = useMemo(() => creditosConCuotas(cartera?.credits ?? [], filtro), [cartera, filtro]);
  const { comisionDePagos, cobradoSinPago } = cuadreDeCobros(pagos, resumen?.collected);
  /* Sin expediente, la cartera ni se pide: el aviso de la web es SIN_EXPEDIENTE en el bloque de cobros. */
  const errorDeCobros = carteraError ?? (partner.cargando ? null : partner.error);
  const error = scope.error ?? billingError ?? errorDeCobros;

  useEffect(() => {
    pdf.current = () => documentoFacturacion(cartera, receivables, invoices);
  }, [pdf, cartera, receivables, invoices]);

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
      {/*
        Con varios negocios, se pregunta con cuál de los suyos sigue. El comercio no elige comercio:
        sólo su usuario, si administra más de uno, elige entre los SUYOS. Con uno solo no se pinta.
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
      {!ready && !error ? (
        <Aviso tono="info" titulo="Elige un negocio">
          Administras varios negocios: elige de cuál quieres ver los cargos que Atlas le factura.
        </Aviso>
      ) : null}

      <Resumen
        testID="resumen-facturacion"
        datos={[
          { label: 'Cobrado', value: cargandoCartera ? '…' : bob(resumen?.collected) },
          { label: `Comisión Atlas ${tasa} %`, value: cargandoCartera ? '…' : bob(resumen?.commissionAccrued) },
          { label: 'Pendiente', value: cargandoCartera ? '…' : bob(resumen?.pendingAmount) },
          { label: 'En mora', value: cargandoCartera ? '…' : bob(resumen?.overdueAmount), alerta: Number(resumen?.overdueAmount ?? 0) > 0 },
        ]}
      />

      <BarraDePestanas
        activa={vista}
        onCambiar={elegirVista}
        pestanas={[
          { id: 'cobros', etiqueta: 'Cobros recibidos', corta: 'Cobros' },
          { id: 'cuotas', etiqueta: 'Estado de sus cuotas', corta: 'Cuotas' },
          { id: 'cargos', etiqueta: 'Cargos de Atlas', corta: 'Cargos' },
        ]}
      />

      <Panel visible={vista === 'cobros'}>
        <Seccion titulo="Cobros recibidos" info={infoCobros(tasa)} testID="seccion-cobros" />
        {cargandoCartera || (pagos.length === 0 && cobradoSinPago === 0) ? (
          <Card>
            <TextoDePanel cargando={cargandoCartera} vacio="Todavía no se ha registrado ningún cobro en sus créditos." />
          </Card>
        ) : (
          pagos.map((pago) => <TarjetaDePago key={pago.paymentId} pago={pago} tasa={tasa} />)
        )}
        {!cargandoCartera && cobradoSinPago > 0 ? (
          <Aviso tono="warning" titulo="Hay cobros sin pago registrado">
            {`${formatBob(cobradoSinPago)} figuran como cobrados en las cuotas pero no tienen un pago anotado detrás, así que no aparecen en esta lista. Por eso la comisión de arriba (${bob(resumen?.commissionAccrued)}) es mayor que la que suman estos cobros (${formatBob(comisionDePagos)}).`}
          </Aviso>
        ) : null}
      </Panel>

      <Panel visible={vista === 'cuotas'}>
        <Seccion titulo="Estado de sus cuotas" info={INFO_CUOTAS} testID="seccion-cuotas" />
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
          <Card>
            <TextoDePanel
              cargando={cargandoCartera}
              vacio={cuotas.length === 0 ? 'No hay créditos originados en su comercio.' : 'Ninguna cuota en ese estado.'}
            />
          </Card>
        ) : (
          creditosVisibles.map(({ credito, cuotas: delCredito, saldado }) => {
            /* Saldado = «listo para facturar»; si no, en mora o pendiente según sus cuotas. */
            const cesta = saldado ? null : ESTADOS[estadoDeCredito(credito)];
            return (
              <Card key={credito.loanId} padding="tight" testID={`credito-${credito.loanId}`}>
                <View style={styles.cabecera} accessible accessibilityLabel={`Compra ${credito.applicationCode ?? '—'}, crédito ${credito.loanCode}, falta ${bob(credito.outstanding)} de ${bob(credito.principalAmount)}`}>
                  <View style={styles.filaEntre}>
                    <AtlasText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={styles.crece}>
                      {bob(credito.outstanding)}
                      <AtlasText variant="caption" tone="tertiary">{`  de ${bob(credito.principalAmount)}`}</AtlasText>
                    </AtlasText>
                    {cesta ? <Pastilla texto={cesta.etiqueta} tono={cesta.tono} /> : <Pastilla texto="Listo para facturar" tono="success" />}
                  </View>
                  <AtlasText variant="caption" tone="secondary" numberOfLines={2}>
                    {`Compra ${credito.applicationCode ?? '—'} · ${textoDeOrigen(credito)} · ${credito.originatedAt ? formatDate(credito.originatedAt) : '—'}`}
                  </AtlasText>
                  <AtlasText variant="micro" tone="tertiary">
                    {codigoCorto(credito.loanCode)}
                  </AtlasText>
                </View>
                {delCredito.map((cuota) => (
                  <FilaDeCuota
                    key={cuota.installmentId}
                    numero={cuota.installmentNumber}
                    vence={formatDate(cuota.dueDate)}
                    debe={cuota.amountDue}
                    pagado={cuota.amountPaid}
                    falta={cuota.amountOutstanding}
                    estado={{
                      texto: cuota.estado === 'mora' && cuota.daysPastDue > 0 ? `En mora ${cuota.daysPastDue} d` : ESTADOS[cuota.estado].etiqueta,
                      tono: ESTADOS[cuota.estado].tono,
                    }}
                  />
                ))}
              </Card>
            );
          })
        )}
      </Panel>

      <Panel visible={vista === 'cargos'}>
        {ready && !billingError ? (
          <>
            <Seccion titulo="Cargos de Atlas" info={INFO_CARGOS} detalle={`Tarifa: ${String(summary.planName ?? 'sin tarifa')}`} testID="seccion-cargos" />
            {billing === null ? (
              <Card>
                <TextoDePanel cargando vacio="" />
              </Card>
            ) : receivables.length ? (
              receivables.map((receivable) => {
                const estado = ESTADOS[
                  estadoDelCargo(
                    String(receivable.status ?? ''),
                    Number(receivable.amountOpen ?? 0),
                    typeof receivable.dueDate === 'string' ? receivable.dueDate : undefined,
                  )
                ];
                return (
                  <Card key={String(receivable.id)} padding="tight">
                    <View style={styles.cabecera}>
                      <View style={styles.filaEntre}>
                        <AtlasText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={styles.crece}>
                          {bob(receivable.amountOpen)}
                          <AtlasText variant="caption" tone="tertiary">{`  de ${bob(receivable.amountOriginal)}`}</AtlasText>
                        </AtlasText>
                        <Pastilla texto={estado.etiqueta} tono={estado.tono} />
                      </View>
                      <AtlasText variant="caption" tone="secondary" numberOfLines={2}>
                        {`${conceptoDeCargo(receivable.sourceType)} · emitido ${fechaDe(receivable.issuedAt)} · vence ${fechaDe(receivable.dueDate)}`}
                      </AtlasText>
                    </View>
                  </Card>
                );
              })
            ) : (
              <Card>
                <TextoDePanel cargando={false} vacio="Atlas todavía no le ha emitido ningún cargo." />
              </Card>
            )}

            <Seccion
              titulo="Facturas emitidas"
              detalle={`${String(summary.invoiceCount ?? 0)} · ${bob(summary.invoicedTotal)}`}
              testID="seccion-facturas"
            />
            {invoices.length ? (
              invoices.map((invoice) => {
                const estado = ESTADOS[estadoDeFactura(invoice)];
                const id = String(invoice.id);
                const numero = String(invoice.invoiceNumber ?? '—');
                return (
                  <Card key={id} padding="tight">
                    <View style={styles.filaEntre}>
                      <View style={[styles.cabecera, styles.crece]}>
                        <View style={styles.filaEntre}>
                          <AtlasText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={styles.crece}>
                            {bob(invoice.totalAmount)}
                          </AtlasText>
                          <Pastilla texto={estado.etiqueta} tono={estado.tono} />
                        </View>
                        <AtlasText variant="caption" tone="secondary" numberOfLines={2}>
                          {`Nº ${numero} · ${fechaDe(invoice.invoiceDate)} · vence ${fechaDe(invoice.dueDate)}`}
                        </AtlasText>
                      </View>
                      {descargando === id ? (
                        <ActivityIndicator color={color.text.secondary} style={styles.descarga} />
                      ) : (
                        <IconButton
                          icon="descargar"
                          label={`Descargar factura ${numero}`}
                          onPress={() => (descargando === null ? void descargarFacturaEmitida(id) : undefined)}
                          testID={`descargar-factura-${id}`}
                          style={styles.descarga}
                        />
                      )}
                    </View>
                  </Card>
                );
              })
            ) : (
              <Card>
                <TextoDePanel cargando={false} vacio="Este comercio aún no tiene facturas emitidas." />
              </Card>
            )}
          </>
        ) : null}
      </Panel>
    </View>
  );
}

/**
 * Un cobro como tarjeta (regla 5): el importe arriba con su estado, debajo la fecha, el crédito, las
 * cuotas y el medio en una línea, y la comisión que devengó. Un pago revertido NO es un cobro: se
 * enseña, porque ocurrió, pero apagado y sin comisión. Ocultarlo dejaría un hueco inexplicable.
 */
function TarjetaDePago({ pago, tasa }: { pago: PagoDeCartera; tasa: string }) {
  const cuotas = pago.installmentNumbers.length ? `cuota ${pago.installmentNumbers.join(', ')}` : 'sin cuota';
  return (
    <Card padding="tight" style={pago.reversed ? styles.revertido : undefined} testID={`cobro-${pago.paymentId}`}>
      <View style={styles.cabecera}>
        <View style={styles.filaEntre}>
          <AtlasText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={styles.crece}>
            {bob(pago.amount)}
          </AtlasText>
          <Pastilla texto={pago.reversed ? 'Revertido' : 'Pagado'} tono={pago.reversed ? 'neutral' : 'success'} />
        </View>
        <AtlasText variant="caption" tone="secondary" numberOfLines={2} accessibilityLabel={`Crédito ${pago.loanCode}`}>
          {`${formatDate(pago.receivedAt)} · ${codigoCorto(pago.loanCode)} · ${cuotas} · ${medioDePago(pago.paymentMethod)}`}
        </AtlasText>
        <Dato etiqueta={`Comisión ${tasa} %`} valor={bob(pago.commissionAccrued)} fuerte apagado={pago.reversed} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  columna: { gap: space.base },
  crece: { flex: 1 },
  cabecera: { gap: space.xxs },
  revertido: { opacity: 0.6 },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  descarga: { marginLeft: space.sm },
});
