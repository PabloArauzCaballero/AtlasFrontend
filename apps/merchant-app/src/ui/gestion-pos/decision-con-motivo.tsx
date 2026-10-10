/**
 * El pie de cada tarjeta de las colas: aceptar, o rechazar CON motivo.
 *
 * En la web son dos botones que, al pulsar «Rechazar», se convierten en un selector de motivo más
 * «Confirmar rechazo» / «Cancelar», dentro de la misma tarjeta. Aquí igual: el paso de rechazo se
 * queda en la tarjeta, junto a lo que se rechaza (el importe, la caja, el comprobante); sólo la LISTA
 * de motivos sube en la hoja del `SelectField` y se va en cuanto se elige uno.
 *
 * «Confirmar rechazo» no responde hasta que hay motivo, como en la web: rechazar lo que el motor
 * aprobó, o el pago que el cliente dice haber hecho, tiene que quedar explicado.
 *
 * Los dos botones van en UNA fila y del mismo ancho (Pablo, 2026-10-10): «Rechazar» secundario a la
 * izquierda y la acción principal a la derecha, que es donde cae el pulgar. Apilados a lo ancho, dos
 * botones por tarjeta hacían de cada solicitud un bloque de media pantalla. A medio ancho caben unos
 * 100 px de rótulo: por eso van sin ícono y con una palabra («Confirmar» y no «Verificar y dar por
 * pagado»; «Rechazar» y no «Confirmar rechazo», que ya se lee junto al motivo elegido).
 */
import { StyleSheet, View } from 'react-native';
import { color, radius, space } from '@cliente/theme/tokens';
import { SelectField, type OpcionSelect } from '@cliente/ui/form-controls';
import { Button } from '@cliente/ui/primitives';
import { ELIJA_EL_MOTIVO } from '@/features/gestion-pos/motivos';

export function DecisionConMotivo({
  rechazando,
  motivo,
  motivos,
  ayuda,
  hint,
  etiquetaAceptar,
  etiquetaConfirmarRechazo = 'Rechazar',
  ocupado,
  onAceptar,
  onEmpezarRechazo,
  onMotivo,
  onConfirmarRechazo,
  onCancelar,
  testID,
}: {
  rechazando: boolean;
  motivo: string;
  motivos: OpcionSelect[];
  /** El `tooltip` del campo en la web: aquí abre en la hoja del ⓘ. */
  ayuda: string;
  hint: string;
  etiquetaAceptar: string;
  etiquetaConfirmarRechazo?: string;
  ocupado: boolean;
  onAceptar: () => void;
  onEmpezarRechazo: () => void;
  onMotivo: (valor: string) => void;
  onConfirmarRechazo: () => void;
  onCancelar: () => void;
  testID: string;
}) {
  if (rechazando) {
    return (
      <View style={styles.rechazo} testID={`${testID}-rechazo`}>
        <SelectField
          label="Motivo del rechazo"
          value={motivo || null}
          opciones={motivos}
          onChange={onMotivo}
          placeholder={ELIJA_EL_MOTIVO}
          hint={hint}
          ayuda={ayuda}
          required
          buscable={false}
        />
        <View style={styles.botones}>
          <Button label="Cancelar" variant="secondary" icon={null} onPress={onCancelar} style={styles.boton} testID={`${testID}-cancelar`} />
          <Button
            label={etiquetaConfirmarRechazo}
            variant="destructive"
            icon={null}
            disabled={!motivo}
            loading={ocupado}
            onPress={onConfirmarRechazo}
            style={styles.boton}
            testID={`${testID}-confirmar-rechazo`}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.botones}>
      <Button label="Rechazar" variant="secondary" icon={null} onPress={onEmpezarRechazo} style={styles.boton} testID={`${testID}-rechazar`} />
      <Button label={etiquetaAceptar} icon={null} loading={ocupado} onPress={onAceptar} style={styles.boton} testID={`${testID}-aceptar`} />
    </View>
  );
}

const styles = StyleSheet.create({
  // El fondo hundido de la web (`bg-slate-50`): el selector y sus botones se leen como UN paso aparte.
  rechazo: { gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface.sunken },
  botones: { flexDirection: 'row', gap: space.sm },
  boton: { flex: 1 },
});
