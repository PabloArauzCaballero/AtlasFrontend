/**
 * Datos personales.
 *
 * El backend guarda cada cambio como una VERSION de perfil, no como una sobrescritura. Por eso la
 * pantalla puede enviar solo lo que cambio: el guardado parcial es parte del contrato.
 */
import { type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { CheckRow } from '../../src/ui/fields';
import { IconField, SelectField } from '../../src/ui/form-controls';
import { Gap, Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
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
      await onboardingApi.updateProfile(session.customerId, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        genderDeclared: gender,
        preferredLanguage: language,
        marketingOptIn,
      });
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
    <Screen scrollRef={scroll} footer={<Button label="Guardar" onPress={save} loading={busy} disabled={busy} />}>
      <ScreenHeader title="Tus datos" subtitle="Así te identificamos en tu expediente." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <IconField icon="perfil" label="Nombre" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
      <IconField icon="perfil" label="Apellido" value={lastName} onChangeText={setLastName} autoComplete="family-name" />

      <SelectField<Gender>
        label="Genero declarado"
        value={gender}
        onChange={setGender}
        opciones={[
          { valor: 'female', etiqueta: 'Femenino' },
          { valor: 'male', etiqueta: 'Masculino' },
          { valor: 'other', etiqueta: 'Otro' },
          { valor: 'undisclosed', etiqueta: 'Prefiero no decirlo' },
        ]}
      />

      <SelectField<Language>
        label="Idioma preferido"
        value={language}
        onChange={setLanguage}
        opciones={[
          { valor: 'es', etiqueta: 'Español' },
          { valor: 'en', etiqueta: 'Inglés' },
        ]}
      />

      <CheckRow
        label="Quiero recibir novedades y promociones"
        detail="Puedes desactivarlo cuando quieras desde tu perfil."
        checked={marketingOptIn}
        onToggle={setMarketingOptIn}
      />

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Tu fecha de nacimiento se registro al crear la cuenta y no puede modificarse desde aquí.
      </AtlasText>
    </Screen>
  );
}
