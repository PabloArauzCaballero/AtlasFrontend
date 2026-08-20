/**
 * Referencias personales.
 *
 * Son datos de TERCEROS que no consintieron nada, asi que el backend exige declarar la base legal
 * de cada una y la app la hace explicita en vez de esconderla en un valor por defecto. Tampoco se
 * lee la agenda del telefono: el modelo de datos decidio no almacenar contactos, solo lo que la
 * persona escribe.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { CheckRow, Field, OptionGroup } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, Card, Divider, ErrorState } from '../../src/ui/primitives';

type Relationship = onboardingApi.ReferenceContact['relationshipType'];

type Draft = { relationshipType: Relationship | null; fullName: string; phone: string; informed: boolean };

const emptyDraft = (): Draft => ({ relationshipType: null, fullName: '', phone: '+591', informed: false });

const REQUIRED_REFERENCES = 2;

export default function References() {
  const router = useRouter();
  const session = useSession();

  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft(), emptyDraft()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((current) => current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)));

  const isComplete = (draft: Draft) =>
    draft.relationshipType !== null && draft.fullName.trim().length >= 3 && draft.phone.trim().length >= 8;

  const completed = drafts.filter(isComplete).length;
  const canSubmit = completed >= REQUIRED_REFERENCES && !busy;

  // Se cuenta cuantas faltan en vez de senalar un campo: con dos fichas identicas en pantalla,
  // "falta el telefono" no dice de cual de las dos.
  const blockedReason = firstBlocker([
    [
      completed >= REQUIRED_REFERENCES,
      completed === 0
        ? `Falta completar ${REQUIRED_REFERENCES} referencias con relacion, nombre y telefono.`
        : `Falta completar ${REQUIRED_REFERENCES - completed} referencia mas: relacion, nombre y telefono.`,
    ],
  ]);

  const save = async () => {
    if (!session.customerId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.addReferences(
        session.customerId,
        drafts.filter(isComplete).map((draft) => ({
          relationshipType: draft.relationshipType!,
          fullName: draft.fullName.trim(),
          phone: draft.phone.trim(),
          // La base legal cambia segun si la persona aviso a su referencia o no.
          consentBasis: draft.informed ? 'reference_informed' : 'customer_declared',
        })),
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

  return (
    <Screen footer={<Button label="Guardar referencias" onPress={save} loading={busy} disabled={!canSubmit} blockedReason={blockedReason} />}>
      <ScreenHeader title="Tus referencias" subtitle={`Necesitamos ${REQUIRED_REFERENCES} personas que puedan dar referencia de ti.`} onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {drafts.map((draft, index) => (
        <Card key={index}>
          <AtlasText variant="h3">Referencia {index + 1}</AtlasText>
          <Divider />

          <OptionGroup<Relationship>
            label="Que relacion tienen"
            value={draft.relationshipType}
            onChange={(next) => update(index, { relationshipType: next })}
            options={[
              { value: 'family', label: 'Familiar' },
              { value: 'friend', label: 'Amistad' },
              { value: 'coworker', label: 'Companero de trabajo' },
              { value: 'employer', label: 'Empleador' },
            ]}
          />

          <Field
            label="Nombre completo"
            value={draft.fullName}
            onChangeText={(value) => update(index, { fullName: value })}
            required
          />
          <Field
            label="Telefono"
            value={draft.phone}
            onChangeText={(value) => update(index, { phone: value })}
            keyboardType="phone-pad"
            required
          />

          <CheckRow
            label="Le avise que lo pondria como referencia"
            detail="Si no le avisaste, igual puedes continuar."
            checked={draft.informed}
            onToggle={(next) => update(index, { informed: next })}
          />
        </Card>
      ))}

      <View>
        <Button label="Agregar otra referencia" variant="ghost" onPress={() => setDrafts([...drafts, emptyDraft()])} />
      </View>

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Solo contactamos a tus referencias si no logramos comunicarnos contigo.
      </AtlasText>
    </Screen>
  );
}
