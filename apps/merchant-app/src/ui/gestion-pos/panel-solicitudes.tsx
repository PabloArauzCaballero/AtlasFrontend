/**
 * Pestaña «Solicitudes de compra». Porte de `MerchantRequestsScreen` en su modo `embedded` (el único
 * en que la monta Gestión POS): sin cabecera propia y con el expediente ya resuelto por la pantalla.
 *
 * Lo que el cliente pidió en el mostrador, esperando el sí o el no del comercio. El cliente escanea
 * el QR del local, pide un importe, y el motor de decisión resuelve si lo aprueba y con qué esquema de
 * pagos. Aquí NO hay ningún campo editable, y esa ausencia es la función de la pantalla: el comercio
 * acepta o rechaza, nada más. Poder retocar el importe o el calendario sería deshacer desde el
 * mostrador la decisión que sostiene el riesgo de la operación.
 *
 * Tampoco se muestra quién es el cliente. El comercio decide si quiere la operación —importe, plazo,
 * que el motor la aprobó—, no sobre la persona.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { Badge, Button, Card, CardHeader, EmptyState, SkeletonLista } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { merchantCreditService, type SolicitudDeCompra } from '@/api/servicios/merchantCreditService';
import { avisoDecisionSolicitud, cuerpoDecisionSolicitud, type AvisoDeDecision } from '@/features/gestion-pos/decisiones';
import { documentoDeSolicitudes } from '@/features/gestion-pos/documentos';
import { fechaHora, formatBob } from '@/features/gestion-pos/formato';
import { MOTIVOS_SOLICITUD } from '@/features/gestion-pos/motivos';
import type { Recargas } from '@/features/gestion-pos/recargas';
import { useCola } from '@/features/gestion-pos/use-cola';
import { Aviso } from '@/ui/aviso';
import { BotonPdf } from '@/ui/boton-pdf';
import { DecisionConMotivo } from './decision-con-motivo';
import { ImporteDeclarado, OrigenDeCaja } from './piezas';

/* A nivel de módulo: una función nueva por render haría que la cola se pidiera sin parar. */
const leerSolicitudes = async (partnerId: string) => (await merchantCreditService.listar(partnerId)).applications ?? [];

export const ID_SOLICITUDES = 'solicitudes';

export function PanelSolicitudes({
  partnerId,
  nombre,
  onCount,
  onDone,
  recargas,
}: {
  partnerId: string;
  nombre: string;
  onCount: (total: number) => void;
  /** Tras decidir: la fila pasa al Historial, así que las otras pestañas se recargan. */
  onDone: (origen: string) => void;
  recargas: Recargas;
}) {
  const cola = useCola<SolicitudDeCompra>({
    id: ID_SOLICITUDES,
    partnerId,
    leer: leerSolicitudes,
    respaldo: 'No fue posible leer las solicitudes.',
    onCount,
    recargas,
  });
  const [aviso, setAviso] = useState<AvisoDeDecision | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function decidir(solicitud: SolicitudDeCompra, aceptada: boolean) {
    const cuerpo = cuerpoDecisionSolicitud(aceptada, motivo);
    if (!cuerpo) return;
    setOcupado(solicitud.applicationId);
    try {
      await merchantCreditService.decidir(partnerId, solicitud.applicationId, { ...cuerpo });
      setAviso(avisoDecisionSolicitud(solicitud, aceptada));
      setRechazando(null);
      setMotivo('');
      await cola.recargar();
      onDone(ID_SOLICITUDES);
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

      <Card testID="solicitudes-cola">
        <CardHeader
          title="Esperando su respuesta"
          detail="Sólo puede aceptar o rechazar. No hay ningún campo que se pueda modificar."
          icon="lista"
          divider={false}
        />
        <View style={styles.acciones}>
          <BotonPdf
            label="Descargar PDF"
            testID="pdf-solicitudes"
            disabled={cola.cargando || !cola.filas.length}
            documento={() => documentoDeSolicitudes(cola.filas, nombre)}
          />
          <Button
            label="Actualizar"
            variant="secondary"
            icon="refrescar"
            disabled={!partnerId}
            loading={cola.cargando}
            onPress={() => void cola.recargar()}
            testID="actualizar-solicitudes"
          />
        </View>
      </Card>

      {cola.cargando && !cola.filas.length ? (
        <SkeletonLista filas={2} alto={160} texto="Cargando…" />
      ) : cola.filas.length === 0 ? (
        <Card>
          <EmptyState
            icon="check"
            title="No hay nada esperando"
            detail="Cuando un cliente escanee el QR y el motor apruebe su compra, aparecerá aquí."
          />
        </Card>
      ) : (
        cola.filas.map((solicitud) => (
          <Card key={solicitud.applicationId} testID={`solicitud-${solicitud.applicationId}`}>
            <CardHeader
              title={solicitud.applicationCode}
              detail={`Pedida el ${fechaHora(solicitud.submittedAt)} · aprobada por el motor`}
              trailing={<Badge label={solicitud.businessAcceptance ?? 'PENDIENTE'} tone="warning" dot />}
            />
            {/* A qué sucursal y caja corresponde: dos compras del mismo importe pueden venir de cajas distintas. */}
            <OrigenDeCaja origen={solicitud} />
            <ImporteDeclarado
              etiqueta="Importe"
              importe={formatBob(Number(solicitud.requestedAmount))}
              nota={`${solicitud.requestedTermMonths} meses · ${solicitud.currencyCode}`}
            />
            <DecisionConMotivo
              rechazando={rechazando === solicitud.applicationId}
              motivo={motivo}
              motivos={MOTIVOS_SOLICITUD}
              ayuda="Motivo codificado del rechazo; queda explicado para auditoría."
              hint="Rechazar algo que el motor aprobó tiene que quedar explicado."
              etiquetaAceptar="Aceptar"
              ocupado={ocupado === solicitud.applicationId}
              onAceptar={() => void decidir(solicitud, true)}
              onEmpezarRechazo={() => setRechazando(solicitud.applicationId)}
              onMotivo={setMotivo}
              onConfirmarRechazo={() => void decidir(solicitud, false)}
              onCancelar={() => {
                setRechazando(null);
                setMotivo('');
              }}
              testID={`solicitud-${solicitud.applicationId}`}
            />
          </Card>
        ))
      )}

      <Aviso tono="info" titulo="Por qué no puede editar nada">
        El importe y el calendario de cuotas los decidió el motor al aprobar la solicitud, con el historial del cliente delante. Cambiarlos aquí sería rehacer esa decisión desde el mostrador.
      </Aviso>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.base },
  acciones: { gap: space.sm },
});
