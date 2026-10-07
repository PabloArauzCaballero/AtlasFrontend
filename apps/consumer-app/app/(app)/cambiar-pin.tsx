/**
 * Cambiar mi PIN, con la sesión abierta.
 *
 * Hasta el 2026-09-14 la app sólo tenía «recuperar»: quien quería cambiar su PIN por decisión
 * propia —se lo dijo a alguien, lo adivinaron— tenía que cerrar sesión y fingir que lo olvidó. El
 * servidor ya ofrecía el cambio en dos pasos (`/auth/password/change/*`); faltaba la pantalla.
 *
 * Dos pasos y no uno: el PIN actual se comprueba primero y el código llega al correo de la cuenta,
 * así que un teléfono desbloqueado en manos ajenas no basta para cambiar el PIN.
 *
 * ## Por qué el paso 2 dice tanto
 *
 * Con «Paso 2 de 2 · escribe el código que te llegó por correo» la persona no sabía A QUÉ correo ni qué hacer si no
 * llegaba: sin una dirección que mirar, sin reenviar y sin volver atrás, un correo en spam o en una dirección que ya
 * no usa se leía como «la app nunca manda el código». Ahora el paso 2 dice a qué correo salió (enmascarado), cuánto
 * vale el código, permite reenviarlo (con la misma espera de 60 s que el servidor, para no chocar con su 429) y deja
 * ir a Soporte si ese no es su correo.
 *
 * ## Al terminar
 *
 * El servidor revoca TODAS las sesiones, incluida ésta. La pantalla antes decía «las demás sesiones» y dejaba a la
 * persona en una sesión muerta que fallaba en la siguiente pantalla. Ahora lo dice tal cual y la lleva a entrar con
 * su PIN nuevo.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as authApi from '../../src/api/endpoints/auth';
import { describeError } from '../../src/api/errors';
import { SEGUNDOS_ENTRE_ENVIOS, textoDeReenvio } from '../../src/features/cambiar-pin-reenvio';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { CodeField } from '../../src/ui/code-field';
import { PinField } from '../../src/ui/pin-field';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, Card, ErrorState } from '../../src/ui/primitives';

type Step = 'current' | 'confirm' | 'done';

/** Tope de espera del cierre local tras el cambio de PIN: pasado, se va a entrar igual. */
const PLAZO_SALIDA_MS = 3_000;

export default function ChangePin() {
  const router = useRouter();
  const session = useSession();
  const [step, setStep] = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [deliveredTo, setDeliveredTo] = useState<string | null>(null);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState<unknown>(null);
  /** Segundos que faltan para poder pedir otro código. */
  const [espera, setEspera] = useState(0);

  // La cuenta atrás corre mientras haya espera; cada segundo resta uno y se detiene sola en cero.
  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  /** Pide el código (la primera vez y cada reenvío). Cada pedido reemplaza al anterior: el viejo deja de servir. */
  const enviarCodigo = () =>
    run(async () => {
      const challenge = await authApi.requestPinChange(currentPin);
      setChallengeToken(challenge.challengeToken);
      setDeliveredTo(challenge.deliveredTo ?? null);
      setExpiresInMinutes(challenge.expiresInMinutes ?? null);
      setCode('');
      setEspera(SEGUNDOS_ENTRE_ENVIOS);
      setStep('confirm');
    });

  const described = error ? describeError(error) : null;

  if (step === 'done') {
    return (
      <Screen
        footer={
          <Button
            label="Entrar con mi PIN nuevo"
            icon="adelante"
            loading={saliendo}
            disabled={saliendo}
            onPress={async () => {
              // El servidor ya revocó todas las sesiones: se cierra la local y se va a entrar. No «volver al perfil».
              // Sin esperar de más: si el cierre local se atasca, la persona NO se queda mirando un botón girando.
              setSaliendo(true);
              try {
                await Promise.race([
                  session.signOut({ servidorYaRevoco: true }),
                  new Promise((resolve) => setTimeout(resolve, PLAZO_SALIDA_MS)),
                ]);
              } catch {
                // El cierre local sigue su curso; lo que importa es llegar a la pantalla de entrada.
              }
              router.replace('/ingresar');
            }}
          />
        }
      >
        <ScreenHeader
          title="PIN actualizado"
          subtitle="Por seguridad cerramos todas tus sesiones, también ésta. Entra con tu PIN nuevo."
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        step === 'current' ? (
          <Button
            label="Enviarme el código"
            icon="sobre"
            loading={busy}
            disabled={currentPin.length !== 4 || busy}
            blockedReason={firstBlocker([[currentPin.length === 4, 'Escribe tu PIN actual (4 dígitos).']])}
            onPress={enviarCodigo}
          />
        ) : (
          <Button
            label="Guardar mi PIN nuevo"
            loading={busy}
            disabled={code.length !== 6 || newPin.length !== 4 || newPin === currentPin || busy}
            blockedReason={firstBlocker([
              [code.length === 6, 'El código tiene 6 dígitos.'],
              [newPin.length === 4, 'Tu PIN nuevo debe ser de 4 dígitos.'],
              [newPin !== currentPin, 'El PIN nuevo tiene que ser distinto del actual.'],
            ])}
            onPress={() =>
              run(async () => {
                await authApi.confirmPinChange({ challengeToken, code, newPassword: newPin });
                setStep('done');
              })
            }
          />
        )
      }
    >
      <ScreenHeader
        eyebrow={`Paso ${step === 'current' ? 1 : 2} de 2`}
        title="Cambiar mi PIN"
        subtitle={step === 'current' ? 'Primero confirma el PIN que usas hoy.' : 'Escribe el código que te enviamos y tu PIN nuevo.'}
        onBack="auto"
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {step === 'current' ? (
        <PinField
          label="Tu PIN actual"
          value={currentPin}
          onChangeText={setCurrentPin}
          ayuda="Los cuatro dígitos con los que entras hoy a la app. Se piden para confirmar que eres tú quien cambia el PIN y no alguien con tu teléfono desbloqueado."
        />
      ) : (
        <>
          {/* A dónde fue el código: sin esto la persona no sabe dónde buscarlo. */}
          <Card testID="codigo-enviado">
            <AtlasText variant="bodyStrong" testID="codigo-destino">
              {deliveredTo ? `Te enviamos un código de 6 dígitos a ${deliveredTo}` : 'Te enviamos un código de 6 dígitos a tu correo registrado'}
            </AtlasText>
            <AtlasText variant="caption" tone="secondary">
              {`${expiresInMinutes ? `Vence en ${expiresInMinutes} minutos y sólo sirve una vez. ` : 'Sólo sirve una vez. '}Si no lo ves, revisa Spam o Promociones.`}
            </AtlasText>
            <Button
              label={textoDeReenvio(espera)}
              icon="refrescar"
              variant="ghost"
              loading={busy}
              disabled={espera > 0 || busy}
              blockedReason={espera > 0 ? 'Puedes pedir otro código en cuanto termine la espera.' : null}
              onPress={enviarCodigo}
            />
            <Button
              label="Ese no es mi correo"
              icon="ayuda"
              variant="ghost"
              onPress={() => router.push('/(app)/soporte')}
            />
          </Card>

          <CodeField
            label="Código de 6 dígitos"
            value={code}
            onChangeText={setCode}
            ayuda="Los seis dígitos que te acabamos de enviar por correo. Sirven una sola vez y vencen en pocos minutos; si no llegó, revisa la carpeta de spam antes de pedir otro."
          />
          <PinField
            label="Tu PIN nuevo"
            value={newPin}
            onChangeText={setNewPin}
            hint="Cuatro dígitos que recuerdes. Evita 1234, tu año de nacimiento o cuatro iguales."
            ayuda="Cuatro dígitos nuevos con los que vas a entrar y autorizar tus compras desde ahora. El PIN anterior deja de servir en cuanto guardes. El servidor rechaza los fáciles de adivinar, como 1234 o cuatro iguales."
          />
          <Button label="Cambiar el PIN actual" icon="atras" variant="ghost" onPress={() => setStep('current')} />
        </>
      )}

      <Gap size="base" />
      {step === 'current' ? (
        <AtlasText variant="caption" tone="tertiary">
          Te mandaremos un código de un solo uso al correo de tu cuenta. Si no tienes un correo verificado, escríbenos desde Soporte.
        </AtlasText>
      ) : null}
    </Screen>
  );
}
