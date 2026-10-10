/**
 * El pie de cada tarjeta de las colas: aceptar, o rechazar CON motivo.
 *
 * En la web son dos botones que, al pulsar «Rechazar», se convierten en un selector de motivo más
 * «Confirmar rechazo» / «Cancelar», dentro de la misma tarjeta. Aquí igual —en su sitio y no en una
 * hoja—: el cajero tiene que ver QUÉ está rechazando (el importe, la caja, la foto del comprobante)
 * mientras elige por qué, y una hoja se lo taparía.
 *
 * «Confirmar rechazo» no responde hasta que hay motivo, como en la web: rechazar lo que el motor
 * aprobó, o el pago que el cliente dice haber hecho, tiene que quedar explicado.
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
  etiquetaConfirmarRechazo = 'Confirmar rechazo',
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
          <Button
            label={etiquetaConfirmarRechazo}
            variant="destructive"
            icon="cerrar"
            disabled={!motivo}
            loading={ocupado}
            onPress={onConfirmarRechazo}
            testID={`${testID}-confirmar-rechazo`}
          />
          <Button label="Cancelar" variant="secondary" icon={null} onPress={onCancelar} testID={`${testID}-cancelar`} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.botones}>
      <Button label={etiquetaAceptar} icon="check" loading={ocupado} onPress={onAceptar} testID={`${testID}-aceptar`} />
      <Button label="Rechazar" variant="secondary" icon="cerrar" onPress={onEmpezarRechazo} testID={`${testID}-rechazar`} />
    </View>
  );
}

const styles = StyleSheet.create({
  // El fondo hundido de la web (`bg-slate-50`): el selector y sus botones se leen como UN paso aparte.
  rechazo: { gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface.sunken },
  botones: { gap: space.sm },
});
