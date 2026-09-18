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
import { CheckRow } from '../../src/ui/fields';
import { DateField, IconField, SelectField } from '../../src/ui/form-controls';
import { bitacora } from '../../src/features/bitacora';
import { leerLecturaDelCarnet } from '../../src/features/lectura-del-carnet';
import { Gap, Screen, useScrollToError } from '../../src/ui/layout';
import { StepHeader } from '../../src/ui/step-header';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';

type Gender = 'female' | 'male' | 'other' | 'undisclosed';
/*
 * Solo los idiomas en los que la app EXISTE.
 *
 * Ofrecía quechua y aymara y no hay una sola cadena traducida a ninguno de los dos: elegirlos no
 * cambiaba nada y dejaba en el expediente una preferencia que el producto no puede atender. Ofrecer
 * un idioma es un compromiso de atender en él —también por escrito y en soporte—, no una casilla.
 */
type Language = 'es' | 'en';

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
  const [gender, setGender] = useState<Gender>('undisclosed');
  const [language, setLanguage] = useState<Language>((profile?.preferredLanguage as Language) ?? 'es');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
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
          genderDeclared: gender,
          preferredLanguage: language,
          marketingOptIn,
        }),
      );
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

      <SelectField<Gender>
        label="Género declarado"
        value={gender}
        onChange={setGender}
        ayuda="Lo declaras tú; no se toma del carnet. Sirve para dirigirnos a ti como corresponde y para los informes de inclusión que la ley nos pide, agregados y sin nombres. No cambia tu evaluación."
        opciones={[
          { valor: 'female', etiqueta: 'Femenino', detalle: 'Te reconoces como mujer.' },
          { valor: 'male', etiqueta: 'Masculino', detalle: 'Te reconoces como hombre.' },
          { valor: 'other', etiqueta: 'Otro', detalle: 'Ninguna de las dos anteriores te describe.' },
          { valor: 'undisclosed', etiqueta: 'Prefiero no decirlo', detalle: 'No queda registrado ningún género.' },
        ]}
      />

      <SelectField<Language>
        label="Idioma preferido"
        value={language}
        onChange={setLanguage}
        ayuda="En qué idioma quieres que te escribamos: los avisos de cuotas, los correos y la atención de soporte. Son los dos idiomas en los que existe la app hoy."
        opciones={[
          { valor: 'es', etiqueta: 'Español', detalle: 'Te escribimos en español, como ahora.' },
          { valor: 'en', etiqueta: 'Inglés', detalle: 'Te escribimos en inglés cuando esté disponible.' },
        ]}
      />

      <CheckRow
        label="Quiero recibir novedades y promociones"
        detail="Puedes desactivarlo cuando quieras desde tu perfil."
        ayuda="Marcarlo autoriza que te escribamos sobre comercios nuevos, descuentos y cambios del producto. No marcarlo no afecta a tu crédito ni a tu evaluación: los avisos de tus cuotas y de tus pagos llegan igual, porque esos no son publicidad."
        checked={marketingOptIn}
        onToggle={setMarketingOptIn}
      />

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Lo que confirmes aquí se compara con tu carnet. Si no coincide, lo revisa una persona antes de aprobarte.
      </AtlasText>
    </Screen>
  );
}
