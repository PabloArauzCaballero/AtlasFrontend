/**
 * Editar mis datos.
 *
 * ## Lo que estaba mal
 *
 * No habia forma de cambiar nada. El endpoint de actualizacion existia desde el onboarding, pero se
 * cerraba al quedar la cuenta `active`: un apellido mal escrito se quedaba mal para siempre y la
 * unica salida era soporte. Terminar el alta no es dejar de ser una persona con datos que cambian.
 *
 * ## Por que hay campos bloqueados y no ocultos
 *
 * Nombre, apellido y fecha de nacimiento se contrastaron contra el carnet. Dejar que el titular los
 * reescriba despues convertiria una verificacion en una declaracion — y es justo el hueco por el que
 * se cuela una suplantacion: verificar con un documento propio y luego cambiar el nombre.
 *
 * Se muestran igual, con candado y con el motivo. Esconderlos dejaria a la persona buscando donde
 * se cambia su nombre; verlos bloqueados y con una explicacion responde la pregunta de una vez.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { color, radius, space } from '../../src/theme/tokens';
import { CheckRow, OptionGroup } from '../../src/ui/fields';
import { Icon } from '../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { Appear } from '../../src/ui/motion';
import { AtlasText, Button, Card, Divider, ErrorState } from '../../src/ui/primitives';

type Language = 'es' | 'en' | 'qu' | 'ay';
type Gender = 'female' | 'male' | 'other' | 'undisclosed';

const LANGUAGES: Array<{ value: Language; label: string; detail?: string }> = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'qu', label: 'Quechua' },
  { value: 'ay', label: 'Aymara' },
];

const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: 'female', label: 'Mujer' },
  { value: 'male', label: 'Hombre' },
  { value: 'other', label: 'Otro' },
  { value: 'undisclosed', label: 'Prefiero no decirlo' },
];

export default function EditProfile() {
  const router = useRouter();
  const session = useSession();
  const me = session.me;

  const [language, setLanguage] = useState<Language>('es');
  const [gender, setGender] = useState<Gender | null>(null);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  /*
   * El formulario arranca con lo que hay, no vacio. Un formulario de edicion en blanco le pide a la
   * persona que recuerde lo que puso, y quien no lo recuerde lo dejara peor de como estaba.
   */
  useEffect(() => {
    const current = me?.profile.preferredLanguage;
    if (current === 'es' || current === 'en' || current === 'qu' || current === 'ay') setLanguage(current);
  }, [me?.profile.preferredLanguage]);

  const save = async () => {
    if (!session.customerId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.updateProfile(session.customerId, {
        preferredLanguage: language,
        marketingOptIn: marketing,
        ...(gender ? { genderDeclared: gender } : {}),
      });
      await session.refresh();
      Alert.alert('Datos guardados', 'Tus preferencias quedaron actualizadas.');
      router.back();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;
  const fullName = [me?.profile.firstName, me?.profile.lastName].filter(Boolean).join(' ') || 'Sin registrar';

  return (
    <Screen footer={<Button label="Guardar cambios" onPress={save} loading={busy} />}>
      <ScreenHeader title="Editar mis datos" subtitle="Cambia lo que quieras de tus preferencias." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <Appear index={0}>
        <Card>
          <View style={styles.rowCenter}>
            <Icon name="candado" size={18} tint={color.text.tertiary} />
            <AtlasText variant="h3">Verificado con tu carnet</AtlasText>
          </View>
          <Divider />

          <LockedField label="Nombre y apellido" value={fullName} />
          <LockedField
            label="Fecha de nacimiento"
            value={me?.profile.birthDate ? new Date(`${me.profile.birthDate}T00:00:00`).toLocaleDateString('es-BO') : 'Sin registrar'}
          />

          <AtlasText variant="caption" tone="tertiary">
            Estos datos se compararon con tu documento de identidad, así que no se cambian desde aquí. Si hay un error,
            escríbenos y lo revisa una persona con tu carnet delante.
          </AtlasText>
        </Card>
      </Appear>

      <Appear index={1}>
        <Card>
          <View style={styles.rowCenter}>
            <Icon name="editar" size={18} tint={color.action.primary} />
            <AtlasText variant="h3">Tus preferencias</AtlasText>
          </View>
          <Divider />

          <OptionGroup label="Idioma" options={LANGUAGES} value={language} onChange={setLanguage} />
          <OptionGroup label="Género" options={GENDERS} value={gender} onChange={setGender} />

          <CheckRow
            label="Quiero recibir novedades y promociones"
            detail="Puedes desactivarlo cuando quieras. No afecta a los avisos de tus pagos."
            checked={marketing}
            onToggle={setMarketing}
          />
        </Card>
      </Appear>

      <Gap size="lg" />
    </Screen>
  );
}

/** Un dato que se ve pero no se toca, con el candado que explica por qué. */
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.locked}>
      <View style={styles.lockedText}>
        <AtlasText variant="caption" tone="tertiary">
          {label}
        </AtlasText>
        <AtlasText variant="bodyStrong">{value}</AtlasText>
      </View>
      <Icon name="candado" size={16} tint={color.text.tertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface.sunken,
  },
  lockedText: { flex: 1, gap: 2 },
});
