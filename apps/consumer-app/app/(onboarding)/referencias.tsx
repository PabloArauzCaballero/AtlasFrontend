/**
 * Referencias personales.
 *
 * Son datos de TERCEROS que no consintieron nada, asi que el backend exige declarar la base legal
 * de cada una y la app la hace explicita en vez de esconderla en un valor por defecto. Tampoco se
 * lee la agenda del telefono: el modelo de datos decidio no almacenar contactos, solo lo que la
 * persona escribe.
 */
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import { View, type ScrollView } from 'react-native';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { elegirContacto } from '../../src/device/contacts';
import { firstBlocker } from '../../src/ui/blocked';
import { CheckRow } from '../../src/ui/fields';
import { IconField, SelectField } from '../../src/ui/form-controls';
import { Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
import { AtlasText, Button, Card, Divider, ErrorState } from '../../src/ui/primitives';
import { TRUST_REFERENCIAS } from '../../src/features/trust-copy';
import { TrustCard } from '../../src/ui/trust-card';

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
        ? `Falta completar ${REQUIRED_REFERENCES} referencias con relación, nombre y teléfono.`
        : `Falta completar ${REQUIRED_REFERENCES - completed} referencia más: relación, nombre y teléfono.`,
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

  // El fallo se pinta arriba y el boton esta abajo: hay que llevar la vista hasta el.

  const scroll = useRef<ScrollView>(null);

  useScrollToError(error, scroll);

  return (
    <Screen scrollRef={scroll} footer={<Button label="Guardar referencias" onPress={save} loading={busy} disabled={!canSubmit} blockedReason={blockedReason} />}>
      <ScreenHeader title="Tus referencias" subtitle={`Necesitamos ${REQUIRED_REFERENCES} personas que puedan dar referencia de ti.`} onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {drafts.map((draft, index) => (
        <Card key={index}>
          <AtlasText variant="h3">Referencia {index + 1}</AtlasText>
          <Divider />

          <SelectField<Relationship>
            label="Qué relación tienen"
            value={draft.relationshipType}
            onChange={(next) => update(index, { relationshipType: next })}
            opciones={[
              { valor: 'family', etiqueta: 'Familiar' },
              { valor: 'friend', etiqueta: 'Amistad' },
              { valor: 'coworker', etiqueta: 'Compañero de trabajo' },
              { valor: 'employer', etiqueta: 'Empleador' },
            ]}
          />

          {/*
            Traerlo de la agenda en vez de teclearlo.

            Un telefono copiado a mano de la memoria sale mal una de cada tres veces, y una
            referencia con un numero equivocado no es una referencia: es una llamada perdida el dia
            que hace falta. El permiso se pide AQUI, al tocar el boton, no al arrancar la app: iOS
            pregunta una sola vez y una negativa temprana —cuando la persona todavia no sabe para
            que— cierra la puerta para siempre.

            Se lee UN contacto, el que la persona elige en la hoja del sistema. La app no recorre la
            agenda ni la guarda.
          */}
          <Button
            label="Elegir de mis contactos"
            variant="secondary"
            haptic="none"
            onPress={async () => {
              const contacto = await elegirContacto();
              if (!contacto) return;
              update(index, {
                fullName: contacto.nombre ?? draft.fullName,
                phone: contacto.telefono ?? draft.phone,
              });
            }}
          />

          <IconField icon="perfil"
            label="Nombre completo"
            value={draft.fullName}
            onChangeText={(value) => update(index, { fullName: value })}
            required
          />
          <IconField icon="telefono"
            label="Teléfono"
            value={draft.phone}
            onChangeText={(value) => update(index, { phone: value })}
            keyboardType="phone-pad"
            required
          />

          <CheckRow
            label="Le avisé que lo pondría como referencia"
            detail="Si no le avisaste, igual puedes continuar."
            checked={draft.informed}
            onToggle={(next) => update(index, { informed: next })}
          />
        </Card>
      ))}

      <View>
        <Button label="Agregar otra referencia" variant="ghost" onPress={() => setDrafts([...drafts, emptyDraft()])} />
      </View>
      {/* Al final del formulario: ver `ui/trust-card.tsx`. */}
      <TrustCard items={TRUST_REFERENCIAS} />
    </Screen>
  );
}
