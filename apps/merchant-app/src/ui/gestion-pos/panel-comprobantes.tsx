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
 *
 * Pablo (2026-10-10): sin las dos tarjetas-cabecera («Pagos iniciales de compras», «Esperando su
 * confirmación», con su «Descargar PDF» y sus «Actualizar») ni el «Por qué lo confirma usted» del
 * final. Las dos colas son UNA lista; los títulos «Pagos iniciales» y «Cuotas» sólo aparecen cuando
 * hay de las dos (con una sola, el título no distingue nada), y la frase del «Por qué…» va en su ⓘ.
 * Si no hay nada, un solo vacío para las dos.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { Card, EmptyState, SkeletonLista } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { merchantCreditService, type ComprobanteDePago } from '@/api/servicios/merchantCreditService';
import { avisoDecisionComprobante, cuerpoVerificacion, type AvisoDeDecision } from '@/features/gestion-pos/decisiones';
import { formatBob } from '@/features/gestion-pos/formato';
import { MOTIVOS_COMPROBANTE } from '@/features/gestion-pos/motivos';
import type { Recargas } from '@/features/gestion-pos/recargas';
import { lineaDeComprobante, refCorta } from '@/features/gestion-pos/tarjetas';
import { useCola } from '@/features/gestion-pos/use-cola';
import { Aviso } from '@/ui/aviso';
import { ListaDePagosIniciales, usePagosIniciales } from './panel-pagos-iniciales';
import { TituloDeSeccion } from './piezas';
import { TarjetaDeComprobante } from './tarjeta-de-comprobante';

/* A nivel de módulo: una función nueva por render haría que la cola (o la imagen) se pidiera sin parar. */
const leerComprobantes = async (partnerId: string) => (await merchantCreditService.listarComprobantes(partnerId)).claims ?? [];
const imagenDeCuota = (socio: string, id: string) => merchantCreditService.comprobanteImagen(socio, id);

export const ID_COMPROBANTES = 'comprobantes';

/** El texto del «Por qué lo confirma usted» de la web, ahora detrás del ⓘ de cada título. */
const POR_QUE_LO_CONFIRMA =
  'El cliente transfiere al QR bancario de su comercio, así que ese dinero entra en su cuenta y no en la de Atlas. Un comprobante es evidencia de que alguien hizo una transferencia, no de que usted la recibió: por eso la cuota se salda cuando usted lo ve en su extracto.';
const POR_QUE_EL_INICIAL =
  'El 60 % que sus clientes le pagaron directo al comprar. Compruebe en su cuenta que el dinero entró antes de confirmar.';

export function PanelComprobantes({
  partnerId,
  onCount,
  onCountIniciales,
  onFilas,
  onDone,
  recargas,
}: {
  partnerId: string;
  /** Los comprobantes de CUOTA (los que la web cuenta). */
  onCount: (total: number) => void;
  /** Los pagos iniciales: la pantalla los SUMA al contador de la pestaña (la web no; ver `pendientesDeComprobantes`). */
  onCountIniciales: (total: number) => void;
  /** Las filas de cuota, para el PDF de la cabecera (el de la web es sólo de cuotas). */
  onFilas: (filas: ComprobanteDePago[]) => void;
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
  const iniciales = usePagosIniciales({ partnerId, onCount: onCountIniciales, recargas });
  const [aviso, setAviso] = useState<AvisoDeDecision | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { filas } = cola;
  useEffect(() => onFilas(filas), [filas, onFilas]);

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

  const hayIniciales = iniciales.filas.length > 0;
  const hayCuotas = filas.length > 0;
  const conTitulos = hayIniciales && hayCuotas;
  // «Cargando…» sólo la primera vez y sólo si no hay NADA que enseñar: lo que ya estaba se sigue viendo mientras recarga.
  const cargandoTodo = (cola.cargando || iniciales.cargando) && !hayCuotas && !hayIniciales;

  return (
    <View style={styles.panel}>
      {cola.error ? <Aviso tono="danger">{cola.error}</Aviso> : null}
      {iniciales.error ? <Aviso tono="danger">{iniciales.error}</Aviso> : null}
      {/* Uno para las dos colas: el de la última decisión, aunque su lista se haya quedado vacía. */}
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}

      {cargandoTodo ? (
        <SkeletonLista filas={2} alto={160} texto="Cargando…" />
      ) : !hayCuotas && !hayIniciales ? (
        <Card testID="comprobantes-vacio">
          <EmptyState icon="check" title="No hay comprobantes esperando" detail="Aquí llegan los pagos que sus clientes avisen." />
        </Card>
      ) : (
        <>
          {hayIniciales ? (
            <View style={styles.seccion}>
              {conTitulos ? <TituloDeSeccion titulo="Pagos iniciales" info={POR_QUE_EL_INICIAL} testID="titulo-pagos-iniciales" /> : null}
              <ListaDePagosIniciales partnerId={partnerId} cola={iniciales} onDone={onDone} onAviso={setAviso} />
            </View>
          ) : null}

          {hayCuotas ? (
            <View style={styles.seccion} testID="comprobantes-cola">
              {conTitulos ? <TituloDeSeccion titulo="Cuotas" info={POR_QUE_LO_CONFIRMA} testID="titulo-cuotas" /> : null}
              {filas.map((comprobante) => (
                <TarjetaDeComprobante
                  key={comprobante.claimId}
                  id={comprobante.claimId}
                  partnerId={partnerId}
                  importe={formatBob(Number(comprobante.claimedAmount))}
                  estado="Por verificar"
                  linea={lineaDeComprobante(comprobante)}
                  referencia={refCorta(comprobante.claimCode)}
                  tieneImagen={Boolean(comprobante.proofEvidenceId)}
                  cargarImagen={imagenDeCuota}
                  sinImagen="Búsquelo en su extracto por la referencia antes de confirmar."
                  decision={{
                    rechazando: rechazando === comprobante.claimId,
                    motivo,
                    motivos: MOTIVOS_COMPROBANTE,
                    ayuda: 'Por qué se rechaza el comprobante; el cliente lo lee.',
                    hint: 'El cliente verá que su aviso fue rechazado; el motivo es lo que le permite corregirlo.',
                    ocupado: ocupado === comprobante.claimId,
                    onAceptar: () => void decidir(comprobante, true),
                    onEmpezarRechazo: () => setRechazando(comprobante.claimId),
                    onMotivo: setMotivo,
                    onConfirmarRechazo: () => void decidir(comprobante, false),
                    onCancelar: () => {
                      setRechazando(null);
                      setMotivo('');
                    },
                  }}
                  testID={`comprobante-${comprobante.claimId}`}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.md },
  seccion: { gap: space.md },
});
