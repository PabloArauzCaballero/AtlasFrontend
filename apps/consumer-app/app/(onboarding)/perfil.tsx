/**
 * Datos personales.
 *
 * El backend guarda cada cambio como una VERSION de perfil, no como una sobrescritura. Por eso la
 * pantalla puede enviar solo lo que cambio: el guardado parcial es parte del contrato.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { CheckRow, Field, OptionGroup } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';

type Gender = 'female' | 'male' | 'other' | 'undisclosed';
type Language = 'es' | 'en' | 'qu' | 'ay';

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

  return (
    <Screen footer={<Button label="Guardar" onPress={save} loading={busy} disabled={busy} />}>
      <ScreenHeader title="Tus datos" subtitle="Asi te identificamos en tu expediente." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <Field label="Nombre" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
      <Field label="Apellido" value={lastName} onChangeText={setLastName} autoComplete="family-name" />

      <OptionGroup<Gender>
        label="Genero declarado"
        value={gender}
        onChange={setGender}
        options={[
          { value: 'female', label: 'Femenino' },
          { value: 'male', label: 'Masculino' },
          { value: 'other', label: 'Otro' },
          { value: 'undisclosed', label: 'Prefiero no decirlo' },
        ]}
      />

      <OptionGroup<Language>
        label="Idioma preferido"
        value={language}
        onChange={setLanguage}
        options={[
          { value: 'es', label: 'Espanol' },
          { value: 'qu', label: 'Quechua' },
          { value: 'ay', label: 'Aymara' },
          { value: 'en', label: 'Ingles' },
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
        Tu fecha de nacimiento se registro al crear la cuenta y no puede modificarse desde aqui.
      </AtlasText>
    </Screen>
  );
}
