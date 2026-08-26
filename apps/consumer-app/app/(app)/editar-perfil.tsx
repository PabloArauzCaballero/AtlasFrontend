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
import { CheckRow } from '../../src/ui/fields';
import { type OpcionSelect, SelectField } from '../../src/ui/form-controls';
import { Icon } from '../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { Appear } from '../../src/ui/motion';
import { AtlasText, Button, Card, CardHeader, ErrorState, Overline } from '../../src/ui/primitives';

type Language = 'es' | 'en';
type Gender = 'female' | 'male' | 'other' | 'undisclosed';

/** Solo los idiomas en los que la app existe. Ver la nota en `(onboarding)/perfil.tsx`. */
const LANGUAGES: OpcionSelect<Language>[] = [
  { valor: 'es', etiqueta: 'Español' },
  { valor: 'en', etiqueta: 'Inglés' },
];

const GENDERS: OpcionSelect<Gender>[] = [
  { valor: 'female', etiqueta: 'Mujer' },
  { valor: 'male', etiqueta: 'Hombre' },
  { valor: 'other', etiqueta: 'Otro' },
  { valor: 'undisclosed', etiqueta: 'Prefiero no decirlo' },
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
    if (current === 'es' || current === 'en') setLanguage(current);
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
          <CardHeader icon="candado" iconTone="neutral" title="Verificado con tu carnet" />

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
          <CardHeader icon="editar" title="Tus preferencias" />

          <SelectField<Language> label="Idioma" opciones={LANGUAGES} value={language} onChange={setLanguage} />
          <SelectField<Gender> label="Género" opciones={GENDERS} value={gender} onChange={setGender} />

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
        <Overline>{label}</Overline>
        <AtlasText variant="title">{value}</AtlasText>
      </View>
      <Icon name="candado" size={16} tint={color.text.tertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  /*
    Un dato bloqueado se dibuja como el HUECO de un campo, no como una tarjeta dentro de otra.

    Es la misma superficie hundida y el mismo contorno que un campo editable, porque eso es lo que
    la persona ha venido a buscar: la fila donde estaria su nombre si se pudiera cambiar. Sin el
    contorno, el bloque se leia como un parrafo con fondo y no como un campo cerrado.
  */
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.sunken,
  },
  lockedText: { flex: 1, gap: space.xxs },
});
