/**
 * Los pagos INICIALES de las compras: el 60 % que el cliente le pagó directo al comercio al comprar.
 * Porte de `MerchantDownPaymentsPanel`, que la web pinta ARRIBA de la cola de comprobantes.
 *
 * Ese dinero entra en la cuenta del comercio, no en la de Atlas, así que sólo él puede decir si
 * llegó. Hasta que existió este panel el comprobante se quedaba en el teléfono del cliente: la app
 * decía «esperando al comercio» y el comercio no veía nada. Confirmarlo es lo que el cliente ve como
 * «pagado» en su app; rechazarlo exige motivo y también se lo enseña.
 *
 * La COLA la lleva `PanelComprobantes` (`usePagosIniciales`): necesita saber cuántos hay para el
 * contador de la pestaña y para decidir si pone los títulos «Pagos iniciales» / «Cuotas»; también
 * pinta el error de la cola y el aviso tras decidir. Aquí quedan las tarjetas y su decisión. Sin
 * tarjeta-cabecera ni «Actualizar» (Pablo, 2026-10-10).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { mensajeDeError } from '@/api/client';
import { merchantCreditService, type PagoInicial } from '@/api/servicios/merchantCreditService';
import { avisoDecisionPagoInicial, cuerpoVerificacion, type AvisoDeDecision } from '@/features/gestion-pos/decisiones';
import { formatBob } from '@/features/gestion-pos/formato';
import { MOTIVOS_PAGO_INICIAL } from '@/features/gestion-pos/motivos';
import type { Recargas } from '@/features/gestion-pos/recargas';
import { lineaDePagoInicial, refCorta } from '@/features/gestion-pos/tarjetas';
import { useCola, type Cola } from '@/features/gestion-pos/use-cola';
import { TarjetaDeComprobante } from './tarjeta-de-comprobante';

/* A nivel de módulo: ver `useImagenDeComprobante` y `useCola` (una función nueva por render repite la petición). */
const leerPagosIniciales = async (partnerId: string) => (await merchantCreditService.listarPagosIniciales(partnerId)).downPayments ?? [];
const imagenDePagoInicial = (socio: string, id: string) => merchantCreditService.pagoInicialImagen(socio, id);

export const ID_PAGOS_INICIALES = 'pagos-iniciales';

export function usePagosIniciales({ partnerId, onCount, recargas }: { partnerId: string; onCount: (total: number) => void; recargas: Recargas }) {
  return useCola<PagoInicial>({
    id: ID_PAGOS_INICIALES,
    partnerId,
    leer: leerPagosIniciales,
    respaldo: 'No fue posible leer los pagos iniciales.',
    onCount,
    recargas,
  });
}

export function ListaDePagosIniciales({
  partnerId,
  cola,
  onDone,
  onAviso,
}: {
  partnerId: string;
  cola: Cola<PagoInicial>;
  onDone: (origen: string) => void;
  /** El aviso tras decidir lo pinta el panel: esta lista se desmonta en cuanto se confirma el último pago. */
  onAviso: (aviso: AvisoDeDecision) => void;
}) {
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function decidir(pago: PagoInicial, verificado: boolean) {
    const cuerpo = cuerpoVerificacion(verificado, motivo);
    if (!cuerpo) return;
    setOcupado(pago.applicationId);
    try {
      await merchantCreditService.verificarPagoInicial(partnerId, pago.applicationId, { ...cuerpo });
      onAviso(avisoDecisionPagoInicial(pago, verificado));
      setRechazando(null);
      setMotivo('');
      await cola.recargar();
      onDone(ID_PAGOS_INICIALES);
    } catch (fallo) {
      onAviso({ tono: 'danger', texto: mensajeDeError(fallo, 'No fue posible registrar la decisión.') });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <View style={styles.lista} testID="pagos-iniciales">
      {cola.filas.map((pago) => (
        <TarjetaDeComprobante
          key={pago.applicationId}
          id={pago.applicationId}
          partnerId={partnerId}
          importe={formatBob(Number(pago.downPaymentAmount))}
          estado="Por confirmar"
          linea={lineaDePagoInicial(pago)}
          referencia={refCorta(pago.applicationCode)}
          tieneImagen={pago.hasProof}
          cargarImagen={imagenDePagoInicial}
          sinImagen="Búsquelo en su cuenta por la referencia antes de confirmar."
          decision={{
            rechazando: rechazando === pago.applicationId,
            motivo,
            motivos: MOTIVOS_PAGO_INICIAL,
            ayuda: 'Por qué se rechaza el pago inicial; el cliente lo lee en su app.',
            hint: 'El cliente verá que su aviso fue rechazado y por qué; podrá avisar de nuevo.',
            ocupado: ocupado === pago.applicationId,
            onAceptar: () => void decidir(pago, true),
            onEmpezarRechazo: () => setRechazando(pago.applicationId),
            onMotivo: setMotivo,
            onConfirmarRechazo: () => void decidir(pago, false),
            onCancelar: () => {
              setRechazando(null);
              setMotivo('');
            },
          }}
          testID={`pago-inicial-${pago.applicationId}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: space.md },
});
