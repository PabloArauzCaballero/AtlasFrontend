/**
 * Los pagos INICIALES de las compras: el 60 % que el cliente le pagó directo al comercio al comprar.
 * Porte de `MerchantDownPaymentsPanel`, que la web pinta ARRIBA de la cola de comprobantes.
 *
 * Ese dinero entra en la cuenta del comercio, no en la de Atlas, así que sólo él puede decir si
 * llegó. Hasta que existió este panel el comprobante se quedaba en el teléfono del cliente: la app
 * decía «esperando al comercio» y el comercio no veía nada. Confirmarlo es lo que el cliente ve como
 * «pagado» en su app; rechazarlo exige motivo y también se lo enseña.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { Badge, Button, Card, CardHeader, EmptyState, SkeletonLista } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { merchantCreditService, type PagoInicial } from '@/api/servicios/merchantCreditService';
import { avisoDecisionPagoInicial, cuerpoVerificacion, type AvisoDeDecision } from '@/features/gestion-pos/decisiones';
import { fechaHora, formatBob } from '@/features/gestion-pos/formato';
import { MOTIVOS_PAGO_INICIAL } from '@/features/gestion-pos/motivos';
import type { Recargas } from '@/features/gestion-pos/recargas';
import { useCola } from '@/features/gestion-pos/use-cola';
import { Aviso } from '@/ui/aviso';
import { ComprobanteImagen } from './comprobante-imagen';
import { DecisionConMotivo } from './decision-con-motivo';
import { ImporteDeclarado, LineaDeReferencia, OrigenDeCaja } from './piezas';

/* A nivel de módulo: ver `ComprobanteImagen` y `useCola` (una función nueva por render repite la petición). */
const leerPagosIniciales = async (partnerId: string) => (await merchantCreditService.listarPagosIniciales(partnerId)).downPayments ?? [];
const imagenDePagoInicial = (socio: string, id: string) => merchantCreditService.pagoInicialImagen(socio, id);

export const ID_PAGOS_INICIALES = 'pagos-iniciales';

export function PanelPagosIniciales({ partnerId, onDone, recargas }: { partnerId: string; onDone: (origen: string) => void; recargas: Recargas }) {
  const cola = useCola<PagoInicial>({
    id: ID_PAGOS_INICIALES,
    partnerId,
    leer: leerPagosIniciales,
    respaldo: 'No fue posible leer los pagos iniciales.',
    recargas,
  });
  const [aviso, setAviso] = useState<AvisoDeDecision | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function decidir(pago: PagoInicial, verificado: boolean) {
    const cuerpo = cuerpoVerificacion(verificado, motivo);
    if (!cuerpo) return;
    setOcupado(pago.applicationId);
    try {
      await merchantCreditService.verificarPagoInicial(partnerId, pago.applicationId, { ...cuerpo });
      setAviso(avisoDecisionPagoInicial(pago, verificado));
      setRechazando(null);
      setMotivo('');
      await cola.recargar();
      onDone(ID_PAGOS_INICIALES);
    } catch (fallo) {
      setAviso({ tono: 'danger', texto: mensajeDeError(fallo, 'No fue posible registrar la decisión.') });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <View style={styles.panel} testID="pagos-iniciales">
      {cola.error ? <Aviso tono="danger">{cola.error}</Aviso> : null}
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}

      <Card>
        <CardHeader
          title="Pagos iniciales de compras"
          detail="El 60 % que sus clientes le pagaron directo al comprar. Compruebe en su cuenta que el dinero entró antes de confirmar."
          icon="billetera"
          divider={false}
        />
        <Button
          label="Actualizar"
          variant="secondary"
          icon="refrescar"
          loading={cola.cargando}
          onPress={() => void cola.recargar()}
          testID="actualizar-pagos-iniciales"
        />
      </Card>

      {cola.cargando && !cola.filas.length ? (
        <SkeletonLista filas={1} alto={160} texto="Cargando…" />
      ) : cola.filas.length === 0 ? (
        <Card>
          <EmptyState
            icon="check"
            title="No hay pagos iniciales esperando"
            detail="Cuando un cliente avise que pagó el inicial de su compra, aparecerá aquí con su comprobante."
          />
        </Card>
      ) : (
        cola.filas.map((pago) => (
          <Card key={pago.applicationId} testID={`pago-inicial-${pago.applicationId}`}>
            <CardHeader
              title={`Compra ${pago.applicationCode}`}
              detail={pago.submittedAt ? `Avisado el ${fechaHora(pago.submittedAt)}` : 'Sin fecha'}
              trailing={<Badge label="PAGO INICIAL POR CONFIRMAR" tone="warning" dot />}
            />
            <OrigenDeCaja origen={pago} />
            <LineaDeReferencia referencia={pago.payerReference} />
            <ImporteDeclarado etiqueta="Importe declarado" importe={formatBob(Number(pago.downPaymentAmount))} nota={pago.currencyCode} />

            {pago.hasProof ? (
              <ComprobanteImagen partnerId={partnerId} id={pago.applicationId} cargar={imagenDePagoInicial} />
            ) : (
              <Aviso tono="warning" titulo="Sin comprobante adjunto">
                El cliente avisó del pago pero no subió ninguna imagen. Búsquelo en su cuenta por la referencia antes de confirmar.
              </Aviso>
            )}

            <DecisionConMotivo
              rechazando={rechazando === pago.applicationId}
              motivo={motivo}
              motivos={MOTIVOS_PAGO_INICIAL}
              ayuda="Por qué se rechaza el pago inicial; el cliente lo lee en su app."
              hint="El cliente verá que su aviso fue rechazado y por qué; podrá avisar de nuevo."
              etiquetaAceptar="Confirmar que recibí el pago"
              etiquetaConfirmarRechazo="Rechazar pago inicial"
              ocupado={ocupado === pago.applicationId}
              onAceptar={() => void decidir(pago, true)}
              onEmpezarRechazo={() => setRechazando(pago.applicationId)}
              onMotivo={setMotivo}
              onConfirmarRechazo={() => void decidir(pago, false)}
              onCancelar={() => {
                setRechazando(null);
                setMotivo('');
              }}
              testID={`pago-inicial-${pago.applicationId}`}
            />
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.base },
});
