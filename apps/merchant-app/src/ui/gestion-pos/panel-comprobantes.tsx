/**
 * Pestaña «Comprobantes por verificar». Porte de `MerchantPaymentProofsScreen` en modo `embedded`,
 * con los pagos iniciales arriba (`MerchantDownPaymentsPanel`), como la web.
 *
 * El cliente paga al QR bancario del comercio, así que ese dinero entra en SU cuenta y no en la de
 * Atlas. Es el único que puede mirar su extracto y decir si llegó: por eso la cuota no se da por
 * pagada hasta que él lo confirma, y por eso confirmarlo es lo que registra el pago de verdad.
 *
 * Rechazar exige motivo. Quien queda sin su pago reconocido tiene derecho a saber por qué, y sin
 * motivo no hay forma de distinguir un error del cliente de uno del comercio.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { Badge, Button, Card, CardHeader, EmptyState, SkeletonLista } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { merchantCreditService, type ComprobanteDePago } from '@/api/servicios/merchantCreditService';
import { avisoDecisionComprobante, cuerpoVerificacion, type AvisoDeDecision } from '@/features/gestion-pos/decisiones';
import { documentoDeComprobantes } from '@/features/gestion-pos/documentos';
import { fechaHora, formatBob } from '@/features/gestion-pos/formato';
import { MOTIVOS_COMPROBANTE } from '@/features/gestion-pos/motivos';
import type { Recargas } from '@/features/gestion-pos/recargas';
import { useCola } from '@/features/gestion-pos/use-cola';
import { Aviso } from '@/ui/aviso';
import { BotonPdf } from '@/ui/boton-pdf';
import { ComprobanteImagen } from './comprobante-imagen';
import { DecisionConMotivo } from './decision-con-motivo';
import { PanelPagosIniciales } from './panel-pagos-iniciales';
import { ImporteDeclarado, LineaDeReferencia, OrigenDeCaja } from './piezas';

/* A nivel de módulo: una función nueva por render haría que la cola (o la imagen) se pidiera sin parar. */
const leerComprobantes = async (partnerId: string) => (await merchantCreditService.listarComprobantes(partnerId)).claims ?? [];
const imagenDeCuota = (socio: string, id: string) => merchantCreditService.comprobanteImagen(socio, id);

export const ID_COMPROBANTES = 'comprobantes';

export function PanelComprobantes({
  partnerId,
  nombre,
  onCount,
  onDone,
  recargas,
}: {
  partnerId: string;
  nombre: string;
  /** Sólo los comprobantes de CUOTA, como en la web: los pagos iniciales no suman al contador. */
  onCount: (total: number) => void;
  onDone: (origen: string) => void;
  recargas: Recargas;
}) {
  const cola = useCola<ComprobanteDePago>({
    id: ID_COMPROBANTES,
    partnerId,
    leer: leerComprobantes,
    respaldo: 'No fue posible leer los comprobantes.',
    onCount,
    recargas,
  });
  const [aviso, setAviso] = useState<AvisoDeDecision | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function decidir(comprobante: ComprobanteDePago, verificado: boolean) {
    const cuerpo = cuerpoVerificacion(verificado, motivo);
    if (!cuerpo) return;
    setOcupado(comprobante.claimId);
    try {
      await merchantCreditService.verificarComprobante(partnerId, comprobante.claimId, { ...cuerpo });
      setAviso(avisoDecisionComprobante(comprobante, verificado));
      setRechazando(null);
      setMotivo('');
      await cola.recargar();
      onDone(ID_COMPROBANTES);
    } catch (fallo) {
      setAviso({ tono: 'danger', texto: mensajeDeError(fallo, 'No fue posible registrar la decisión.') });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <View style={styles.panel}>
      {cola.error ? <Aviso tono="danger">{cola.error}</Aviso> : null}
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}

      {partnerId ? <PanelPagosIniciales partnerId={partnerId} onDone={onDone} recargas={recargas} /> : null}

      <Card testID="comprobantes-cola">
        <CardHeader
          title="Esperando su confirmación"
          detail="Compruebe en su extracto que el dinero entró antes de confirmar."
          icon="documento"
          divider={false}
        />
        <View style={styles.acciones}>
          <BotonPdf
            label="Descargar PDF"
            testID="pdf-comprobantes"
            disabled={cola.cargando || !cola.filas.length}
            documento={() => documentoDeComprobantes(cola.filas, nombre)}
          />
          <Button
            label="Actualizar"
            variant="secondary"
            icon="refrescar"
            disabled={!partnerId}
            loading={cola.cargando}
            onPress={() => void cola.recargar()}
            testID="actualizar-comprobantes"
          />
        </View>
      </Card>

      {cola.cargando && !cola.filas.length ? (
        <SkeletonLista filas={2} alto={160} texto="Cargando…" />
      ) : cola.filas.length === 0 ? (
        <Card>
          <EmptyState
            icon="check"
            title="No hay comprobantes esperando"
            detail="Cuando un cliente avise que transfirió, aparecerá aquí con su comprobante."
          />
        </Card>
      ) : (
        cola.filas.map((comprobante) => (
          <Card key={comprobante.claimId} testID={`comprobante-${comprobante.claimId}`}>
            <CardHeader
              title={comprobante.claimCode}
              detail={`Avisado el ${fechaHora(comprobante.submittedAt)}`}
              trailing={<Badge label="POR VERIFICAR" tone="warning" dot />}
            />
            {/* La caja de la compra de este crédito: dos cuotas iguales pueden ser de cajas distintas. */}
            <OrigenDeCaja origen={comprobante} />
            <LineaDeReferencia referencia={comprobante.payerReference} />
            <ImporteDeclarado etiqueta="Importe declarado" importe={formatBob(Number(comprobante.claimedAmount))} nota={comprobante.currencyCode} />

            {comprobante.proofEvidenceId ? (
              <ComprobanteImagen partnerId={partnerId} id={comprobante.claimId} cargar={imagenDeCuota} />
            ) : (
              <Aviso tono="warning" titulo="Sin comprobante adjunto">
                El cliente avisó del pago pero no subió ninguna imagen. Búsquelo en su extracto por la referencia antes de confirmar.
              </Aviso>
            )}

            <DecisionConMotivo
              rechazando={rechazando === comprobante.claimId}
              motivo={motivo}
              motivos={MOTIVOS_COMPROBANTE}
              ayuda="Por qué se rechaza el comprobante; el cliente lo lee."
              hint="El cliente verá que su aviso fue rechazado; el motivo es lo que le permite corregirlo."
              etiquetaAceptar="Verificar y dar por pagado"
              ocupado={ocupado === comprobante.claimId}
              onAceptar={() => void decidir(comprobante, true)}
              onEmpezarRechazo={() => setRechazando(comprobante.claimId)}
              onMotivo={setMotivo}
              onConfirmarRechazo={() => void decidir(comprobante, false)}
              onCancelar={() => {
                setRechazando(null);
                setMotivo('');
              }}
              testID={`comprobante-${comprobante.claimId}`}
            />
          </Card>
        ))
      )}

      <Aviso tono="info" titulo="Por qué lo confirma usted">
        El cliente transfiere al QR bancario de su comercio, así que ese dinero entra en su cuenta y no en la de Atlas. Un comprobante es evidencia de que alguien hizo una transferencia, no de que usted la recibió: por eso la cuota se salda cuando usted lo ve en su extracto.
      </Aviso>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.base },
  acciones: { gap: space.sm },
});
