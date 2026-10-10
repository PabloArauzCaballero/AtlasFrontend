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
 * operación suya vence el martes, no quién es la persona (el porqué, en el ⓘ de «Créditos»).
 *
 * El PDF lo imprime el ícono de la cabecera de la pantalla: esta vista le deja en `pdf` cómo armarlo.
 */
import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, space } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { AtlasText, Card, Divider } from '@cliente/ui/primitives';
import { merchantCreditService, type Cartera, type CreditoDeCartera } from '@/api/servicios/merchantCreditService';
import { portalService } from '@/api/servicios/portalService';
import { documentoCartera } from '@/features/cartera/documentos';
import { ESTADOS, codigoCorto, estadoDeCredito, estadoDeCuota } from '@/features/cartera/estados';
import { bob, cuotasTexto, fechaCorta, tasaCorta, textoDeFallo } from '@/features/cartera/formato';
import type { DocumentoPdf } from '@/features/pdf';
import type { MerchantPartner } from '@/features/use-merchant-partner';
import { Aviso } from '@/ui/aviso';
import { BarraDePestanas, Panel, usePestana } from '@/ui/pestanas';
import { Resumen } from '@/ui/resumen';
import { Cifra, FilaDeCuota, FilaDeDia, Pastilla, Seccion, TextoDePanel } from './piezas';

const VISTAS = ['panel', 'creditos', 'calendario', 'comision'] as const;

type ComisionFacturada = Awaited<ReturnType<typeof portalService.commissions>>;

/* Los textos de los ⓘ: son los de la web (descripciones de panel y avisos «Por qué…» / «Cómo se cobra»). */
const INFO_CREDITOS = [
  'Abra uno para ver su detalle cuota a cuota.',
  'Por qué no ve nombres: su cartera dice qué operación vence y cuándo, no quién la debe. El comercio decide sobre la operación; el expediente del cliente es suyo y no de quien le vendió.',
];
const INFO_COMISION = [
  'Lo que Atlas le cobra por el servicio. Se devenga sólo sobre lo que usted cobra.',
  'Cómo se cobra: la comisión se devenga a medida que sus clientes pagan: un crédito aprobado que aún no cobra no genera comisión, y una venta pagada al 100 % la genera completa. La tasa se pactó en su alta desde el ERP interno de Atlas.',
];
const INFO_FACTURADO = [
  'Devengado y facturado no son el mismo número y no tienen por qué coincidir: lo primero crece con cada cobro suyo, lo segundo sólo cuando Atlas emite el cargo. La diferencia es comisión ya generada que todavía no se le ha facturado.',
];

export function VistaCartera({ partner, vuelta, pdf }: { partner: MerchantPartner; vuelta: number; pdf: MutableRefObject<(() => DocumentoPdf) | null> }) {
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

  useEffect(() => {
    pdf.current = () => documentoCartera(cartera, partner.nombre);
  }, [pdf, cartera, partner.nombre]);

  // Mientras se resuelve el expediente también se está cargando: no hay que decir «no hay cuotas».
  const cargando = cargandoCartera || (!partnerId && partner.cargando);
  const resumen = cartera?.summary;
  const tasa = tasaCorta(resumen?.mdrRatePercent);
  const proximos = useMemo(() => (cartera?.calendar ?? []).slice(0, 30), [cartera]);
  const creditos = cartera?.credits ?? [];
  const avisoDeError = error ?? partner.error;

  return (
    <View style={styles.columna}>
      {avisoDeError ? <Aviso tono="danger">{avisoDeError}</Aviso> : null}

      <Resumen
        testID="resumen-cartera"
        datos={[
          { label: 'Por cobrar', value: cargando ? '…' : bob(resumen?.outstanding) },
          { label: 'Vencido', value: cargando ? '…' : bob(resumen?.overdueAmount), alerta: Number(resumen?.overdueAmount ?? 0) > 0 },
          { label: 'Cobrado', value: cargando ? '…' : bob(resumen?.collected) },
          { label: `Comisión Atlas ${tasa} %`, value: cargando ? '…' : bob(resumen?.commissionAccrued) },
        ]}
      />

      <BarraDePestanas
        activa={vista}
        onCambiar={elegirVista}
        pestanas={[
          { id: 'panel', etiqueta: 'Panel', corta: 'Panel' },
          { id: 'creditos', etiqueta: 'Créditos', corta: 'Créditos' },
          { id: 'calendario', etiqueta: 'Calendario', corta: 'Calendario' },
          { id: 'comision', etiqueta: 'Comisión', corta: 'Comisión' },
        ]}
      />

      <Panel visible={vista === 'panel'}>
        <Seccion titulo="Próximos cobros" info={['Lo que debería entrar en los siguientes días.']} testID="seccion-proximos" />
        <Card padding="tight">
          {cargando || proximos.length === 0 ? (
            <TextoDePanel cargando={cargando} vacio="No hay cuotas pendientes de cobro." />
          ) : (
            proximos.slice(0, 8).map((dia, indice) => <FilaDeDia key={dia.date} dia={dia} primera={indice === 0} />)
          )}
        </Card>
      </Panel>

      <Panel visible={vista === 'creditos'}>
        <Seccion titulo="Créditos pendientes de pago" info={INFO_CREDITOS} testID="seccion-creditos" />
        {cargando || creditos.length === 0 ? (
          <Card>
            <TextoDePanel cargando={cargando} vacio="No hay créditos originados en su comercio." />
          </Card>
        ) : (
          creditos.map((credito) => (
            <TarjetaDeCredito
              key={credito.loanId}
              credito={credito}
              abierto={abierto === credito.loanId}
              onAlternar={() => setAbierto(abierto === credito.loanId ? null : credito.loanId)}
            />
          ))
        )}
      </Panel>

      <Panel visible={vista === 'calendario'}>
        <Seccion titulo="Calendario de cobros" info={['Cuánto debería entrar cada día.']} testID="seccion-calendario" />
        <Card padding="tight">
          {cargando || proximos.length === 0 ? (
            <TextoDePanel cargando={cargando} vacio="No hay cobros programados." />
          ) : (
            proximos.map((dia, indice) => <FilaDeDia key={dia.date} dia={dia} primera={indice === 0} />)
          )}
        </Card>
      </Panel>

      <Panel visible={vista === 'comision'}>
        <Seccion titulo="Comisión por venta" info={INFO_COMISION} testID="seccion-comision" />
        <Card padding="tight">
          <View style={styles.cifras}>
            <Cifra etiqueta="Tasa" valor={`${tasa} %`} />
            <Cifra etiqueta="Cobrado (base)" valor={bob(resumen?.collected)} />
            <Cifra etiqueta="Comisión" valor={bob(resumen?.commissionAccrued)} />
          </View>
        </Card>

        {creditos.length === 0 ? (
          <Card>
            <TextoDePanel cargando={false} vacio="Todavía no hay ventas financiadas en su comercio." />
          </Card>
        ) : (
          <Card padding="tight">
            {creditos.map((credito, indice) => {
              const estado = ESTADOS[estadoDeCredito(credito)];
              return (
                <View key={credito.loanId} style={styles.filaComision}>
                  {indice > 0 ? <Divider /> : null}
                  <View style={styles.filaEntre}>
                    <AtlasText variant="bodyStrong" numberOfLines={1} style={styles.crece}>
                      {bob(credito.commissionAccrued)}
                    </AtlasText>
                    <Pastilla texto={estado.etiqueta} tono={estado.tono} />
                  </View>
                  <AtlasText variant="caption" tone="secondary" numberOfLines={1} accessibilityLabel={`Crédito ${credito.loanCode}`}>
                    {`${codigoCorto(credito.loanCode)} · cobrado ${bob(credito.collected)}`}
                  </AtlasText>
                </View>
              );
            })}
          </Card>
        )}

        {facturado ? (
          <>
            <Seccion titulo="Lo que Atlas ya le facturó" info={INFO_FACTURADO} testID="seccion-facturado" />
            <Card padding="tight" testID="comision-facturada">
              <View style={styles.cifras}>
                <Cifra etiqueta={`Facturado (${Number(facturado.summary?.salesCharged ?? 0)})`} valor={bob(facturado.summary?.chargedTotal)} />
                <Cifra etiqueta="Ya pagado" valor={bob(facturado.summary?.settled)} />
                <Cifra etiqueta="Por pagar" valor={bob(facturado.summary?.owedToAtlas)} tono="warning" />
              </View>
            </Card>
          </>
        ) : null}
      </Panel>
    </View>
  );
}

/**
 * Un crédito como tarjeta (regla 5): arriba lo que falta por cobrar y su estado; debajo una línea con
 * el código corto y las cuotas. Al tocarla se abre en sus cuotas.
 */
function TarjetaDeCredito({ credito, abierto, onAlternar }: { credito: CreditoDeCartera; abierto: boolean; onAlternar: () => void }) {
  const estado = ESTADOS[estadoDeCredito(credito)];
  return (
    <Card padding="tight">
      <Pressable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${credito.loanCode}, por cobrar ${bob(credito.outstanding)}, ${estado.etiqueta}`}
        style={styles.cabeceraCredito}
        testID={`credito-${credito.loanId}`}
      >
        <View style={styles.filaEntre}>
          <AtlasText variant="h3" numberOfLines={1} adjustsFontSizeToFit style={styles.crece}>
            {bob(credito.outstanding)}
          </AtlasText>
          <Pastilla texto={estado.etiqueta} tono={estado.tono} />
        </View>
        <View style={styles.filaEntre}>
          <AtlasText variant="caption" tone="secondary" numberOfLines={1} style={styles.crece}>
            {`Por cobrar · ${codigoCorto(credito.loanCode)} · ${cuotasTexto(credito.installments.length)}`}
          </AtlasText>
          <View style={abierto ? styles.flechaAbierta : undefined}>
            <Icon name="adelante" size={16} tint={color.text.tertiary} />
          </View>
        </View>
      </Pressable>
      {abierto
        ? credito.installments.map((cuota) => {
            const cesta = ESTADOS[estadoDeCuota(cuota)];
            return (
              <FilaDeCuota
                key={cuota.installmentId}
                numero={cuota.installmentNumber}
                vence={fechaCorta(cuota.dueDate)}
                debe={cuota.amountDue}
                pagado={cuota.amountPaid}
                falta={cuota.amountOutstanding}
                estado={cuota.overdue ? { texto: `Mora ${cuota.daysPastDue} d`, tono: 'warning' } : { texto: cesta.etiqueta, tono: cesta.tono }}
              />
            );
          })
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  columna: { gap: space.base },
  crece: { flex: 1 },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cabeceraCredito: { gap: space.xxs, paddingBottom: space.xs },
  flechaAbierta: { transform: [{ rotate: '90deg' }] },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  filaComision: { gap: space.xxs, paddingVertical: space.xs },
});
