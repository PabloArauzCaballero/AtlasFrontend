/**
 * «Confirme que es usted»: la contraseña OTRA VEZ antes de cambiar el QR de cobro (hallazgo ERP-03).
 * Es `ReautenticacionDialog` de la web, como hoja.
 *
 * El login del comercio no lleva segundo factor, y con esa sesión se podía cambiar la cuenta a la
 * que le pagan sus clientes. La contraseña vive sólo en el estado de esta hoja mientras está
 * abierta: se manda una vez y se borra al confirmar, al fallar y al cerrar.
 */
import { useEffect, useState } from 'react';
import { Button, AtlasText } from '@cliente/ui/primitives';
import { IconField } from '@cliente/ui/form-controls';
import { ApiError } from '@/api/client';
import { motivoDeRechazo } from '@/features/empresa/qr-de-cobro';
import { reautenticarComercio } from '@/features/empresa/reautenticacion';
import { Aviso } from '@/ui/aviso';
import { Hoja, PieDeHoja } from './hoja';

export function Reautenticacion({ visible, accion, onConfirmada, onCancel }: { visible: boolean; accion: string; onConfirmada: (reauthToken: string) => void; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) return;
    setPassword('');
    setError(null);
  }, [visible]);

  const confirmar = async () => {
    if (!password) {
      setError('Escriba su contraseña.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const prueba = await reautenticarComercio(password);
      setPassword('');
      onConfirmada(prueba.reauthToken);
    } catch (fallo) {
      setPassword('');
      setError(
        fallo instanceof ApiError
          ? motivoDeRechazo(fallo)
          : motivoDeRechazo(fallo instanceof Error ? { message: fallo.message } : null),
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja visible={visible} titulo="Confirme que es usted" descripcion={`Para ${accion} escriba otra vez la contraseña con la que entró.`} onClose={onCancel} testID="dialogo-reautenticacion">
      <AtlasText variant="caption" tone="secondary">
        Es una protección de su dinero: aunque alguien tuviera su sesión abierta, no podría cambiar la cuenta a la que le pagan sus clientes sin saber su contraseña.
      </AtlasText>
      <IconField
        label="Contraseña"
        icon="candado"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        autoComplete="current-password"
        autoFocus
        ayuda="La misma contraseña con la que inicia sesión en el portal. No se guarda: sólo confirma que es usted."
        required
        testID="campo-reautenticacion"
      />
      {error ? (
        <Aviso tono="danger" testID="reautenticacion-error">
          {error}
        </Aviso>
      ) : null}
      <PieDeHoja>
        <Button label="Confirmar" icon="candado" loading={enviando} onPress={() => confirmar()} testID="btn-confirmar-reautenticacion" />
        <Button label="Cancelar" variant="secondary" disabled={enviando} onPress={onCancel} />
      </PieDeHoja>
    </Hoja>
  );
}
