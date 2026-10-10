/**
 * Ingreso del comercio. Los textos son los de la pestaña «Comercio afiliado» de `AtlasERPFrontend/app/login`:
 * correo y contraseña, sin PIN (el canal del comercio no tiene segundo factor), y el comercio
 * entra SIEMPRE a Gestión POS.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { AtlasLogo } from '@cliente/ui/brand';
import { IconField } from '@cliente/ui/form-controls';
import { Gap, Screen, ScreenHeader } from '@cliente/ui/layout';
import { AtlasText, Button, IconButton } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { useSession } from '@/session/session';
import { Aviso } from '@/ui/aviso';

export default function Ingresar() {
  const router = useRouter();
  const session = useSession();
  const { aviso } = useLocalSearchParams<{ aviso?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);

  const faltaCorreo = intentado && email.trim() === '' ? 'Escribe el correo del comercio.' : null;
  const faltaClave = intentado && password === '' ? 'Escribe tu contraseña.' : null;

  const enviar = async () => {
    if (submitting) return;
    if (email.trim() === '' || password === '') {
      setIntentado(true);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await session.login({ email: email.trim(), password });
      router.replace('/gestion-pos');
    } catch (caught) {
      setError(mensajeDeError(caught, 'No fue posible iniciar sesión.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      footer={<Button label="Iniciar sesión" icon="adelante" onPress={() => void enviar()} loading={submitting} testID="ingresar-enviar" />}
    >
      <AtlasLogo size={36} style={styles.marca} />
      <ScreenHeader
        eyebrow="Portal del comercio"
        title="Bienvenido nuevamente"
        subtitle="Ingresa tus credenciales para acceder al portal de tu comercio."
      />

      {aviso === 'clave-cambiada' && !error ? (
        <Aviso tono="success">Contraseña cambiada. Cerramos tu sesión: vuelve a entrar con la contraseña nueva.</Aviso>
      ) : null}

      {aviso === 'inactividad' && !error ? (
        <Aviso tono="info" titulo="Cerramos tu sesión">Pasaron 15 minutos sin actividad. Vuelve a entrar para seguir.</Aviso>
      ) : null}

      {error ? (
        <Aviso tono="danger" testID="ingresar-error">
          {error}
        </Aviso>
      ) : null}

      <IconField
        label="Correo del comercio"
        icon="sobre"
        value={email}
        onChangeText={setEmail}
        placeholder="usuario@micomercio.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
        error={faltaCorreo}
        ayuda="El correo con el que te dieron de alta; es tu usuario para entrar. Ej.: nombre@empresa.bo."
        required
        testID="ingresar-correo"
      />
      <IconField
        label="Contraseña"
        icon="candado"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry={!verClave}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => void enviar()}
        error={faltaClave}
        hint="Nunca compartas tu contraseña; el equipo de soporte jamás te la pedirá."
        ayuda="Tu contraseña del ERP; distingue mayúsculas."
        trailing={
          <IconButton
            icon="ojo"
            label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onPress={() => setVerClave((v) => !v)}
            testID="ingresar-ver-clave"
          />
        }
        required
        testID="ingresar-clave"
      />

      <Gap size="xs" />
      <Button
        label="¿Olvidaste tu contraseña?"
        icon="candado"
        variant="ghost"
        onPress={() => router.push({ pathname: '/recuperar', params: email.trim() ? { correo: email.trim() } : {} })}
      />
      <Gap size="base" />
      <AtlasText variant="caption" tone="tertiary">
        El token de refresco viaja en una cookie HttpOnly y las acciones quedan auditadas.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  marca: { marginBottom: space.sm },
});
