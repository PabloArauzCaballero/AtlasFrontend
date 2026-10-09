/**
 * Confirma tus datos: la segunda mitad de la fase de identidad.
 *
 * Desde el 2026-09-18 el nombre y la fecha de nacimiento ya no se piden al crear la cuenta: llegan
 * AQUI, despues del carnet, para que lo que la persona confirma se pueda cruzar con lo que el
 * documento dice. Si el motor devolvio una lectura utilizable del carnet (`extracted`), los campos
 * llegan prellenados y cada correccion queda anotada en la bitacora como `ocr_*`; si no, se
 * escriben a mano con los codigos de siempre.
 *
 * El backend guarda cada cambio como una VERSION de perfil, no como una sobrescritura. Por eso la
 * pantalla puede enviar solo lo que cambio: el guardado parcial es parte del contrato.
 */
import { type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { DateField, IconField } from '../../src/ui/form-controls';
import { bitacora } from '../../src/features/bitacora';
import { borrarLecturaDelCarnet, leerLecturaDelCarnet } from '../../src/features/lectura-del-carnet';
import { Gap, Screen, useScrollToError } from '../../src/ui/layout';
import { StepHeader } from '../../src/ui/step-header';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';

export default function PersonalData() {
  const router = useRouter();
  const session = useSession();
  const profile = session.me?.profile;

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  /* Si los campos vienen del carnet. Cambia el codigo de bitacora: corregir lo leido es una señal. */
  const [prellenado, setPrellenado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void leerLecturaDelCarnet().then((lectura) => {
      if (!vivo || !lectura) return;
      if (lectura.firstNames && !profile?.firstName) setFirstName(lectura.firstNames);
      if (lectura.lastNames && !profile?.lastName) setLastName(lectura.lastNames);
      if (lectura.dateOfBirth && !profile?.birthDate) setBirthDate(lectura.dateOfBirth);
      setPrellenado(Boolean(lectura.firstNames || lectura.lastNames || lectura.dateOfBirth));
    });
    return () => {
      vivo = false;
    };
  }, [profile?.birthDate, profile?.firstName, profile?.lastName]);
  /*
    Volver a este paso enseña lo ya confirmado (pedido de Pablo, 2026-09-28). `session.me` puede
    llegar sin perfil; la fuente es lo que el servidor tiene guardado. No pisa lo tecleado ahora.
  */
  useEffect(() => {
    if (!session.customerId) return;
    let vivo = true;
    void onboardingApi
      .getAnswers(session.customerId)
      .then(({ personalData }) => {
        if (!vivo || !personalData) return;
        if (personalData.firstName) setFirstName((actual) => actual || personalData.firstName!);
        if (personalData.lastName) setLastName((actual) => actual || personalData.lastName!);
        if (personalData.birthDate) setBirthDate((actual) => actual || personalData.birthDate!);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [session.customerId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    if (!session.customerId) return;
    setBusy(true);
    setError(null);
    try {
      await bitacora.medirEnvio(() =>
        onboardingApi.updateProfile(session.customerId!, {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          birthDate: birthDate || undefined,
        }),
      );
      // Lo que prometía `lectura-del-carnet.ts` y no hacía nadie (APP-08): confirmado, ya no hace falta.
      await borrarLecturaDelCarnet();
      await session.refresh();
      router.replace('/(onboarding)/progreso');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;

  // El fallo se pinta arriba y el boton esta abajo: hay que llevar la vista hasta el.

  const scroll = useRef<ScrollView>(null);

  useScrollToError(error, scroll);

  return (
    <Screen
      scrollRef={scroll}
      footer={
        <Button
          label="Confirmar mis datos"
          bitacora="confirmar_datos"
          onPress={save}
          loading={busy}
          disabled={busy || !firstName.trim() || !lastName.trim() || !birthDate}
          blockedReason={!firstName.trim() ? 'Falta tu nombre.' : !lastName.trim() ? 'Falta tu apellido.' : !birthDate ? 'Falta tu fecha de nacimiento.' : null}
        />
      }
    >
      <StepHeader
        code="personal_data"
        title={prellenado ? 'Confirma tus datos' : 'Tus datos'}
        subtitle={prellenado ? 'Los leímos de tu carnet. Corrige lo que no coincida.' : 'Tal como figuran en tu carnet.'}
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <IconField
        icon="perfil"
        bitacora={prellenado ? 'ocr_nombres' : 'nombres'}
        label="Nombre"
        value={firstName}
        onChangeText={setFirstName}
        autoComplete="given-name"
        ayuda="Tu nombre tal como figura en tu carnet de identidad, sin apodos. Es el que aparece en tu contrato y el que se compara con el documento."
      />
      <IconField
        icon="perfil"
        bitacora={prellenado ? 'ocr_apellidos' : 'apellidos'}
        label="Apellido"
        value={lastName}
        onChangeText={setLastName}
        autoComplete="family-name"
        ayuda="Tus apellidos completos como están en el carnet. Si no coinciden con el documento, la verificación se detiene y la revisa una persona."
      />

      <DateField
        label="Fecha de nacimiento"
        value={birthDate}
        onChange={setBirthDate}
        minimumDate={new Date(new Date().getFullYear() - 100, 0, 1)}
        maximumDate={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate())}
        initialDate={new Date(new Date().getFullYear() - 25, 0, 1)}
        hint="Debes tener al menos 18 años."
        ayuda="El día que naciste, el mismo que figura en tu carnet. Con menos de 18 años no se puede firmar un crédito en Bolivia."
        required
      />

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Lo que confirmes aquí se compara con tu carnet. Si no coincide, lo revisa una persona antes de aprobarte.
      </AtlasText>
    </Screen>
  );
}
