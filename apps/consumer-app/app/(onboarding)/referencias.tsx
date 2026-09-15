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
import { elegirContacto, resumirAgenda } from '../../src/device/contacts';
import { agendaNoCompartida } from '../../src/features/agenda';
import { firstBlocker } from '../../src/ui/blocked';
import { CheckRow } from '../../src/ui/fields';
import { IconField, SelectField } from '../../src/ui/form-controls';
import { Screen, useScrollToError } from '../../src/ui/layout';
import { StepHeader } from '../../src/ui/step-header';
import { Badge, Button, Card, CardHeader, ErrorState } from '../../src/ui/primitives';
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
  /**
   * Si la persona autoriza analizar la FORMA de su agenda.
   *
   * Empieza en `false` y hay que marcarlo: es una casilla de aceptacion, no una de renuncia. Un
   * valor por defecto en `true` seria consentimiento por descuido, que para datos de terceros —las
   * personas de la agenda no consintieron nada— no es consentimiento.
   */
  const [analizarAgenda, setAnalizarAgenda] = useState(false);

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
      /*
        El snapshot de la agenda va DESPUES de guardar las referencias, y no antes.

        El numero que mas informa —cuantas de las referencias declaradas estan realmente en la
        agenda— solo se puede calcular cuando ya se declararon. Y va despues tambien en el sentido
        de que su fallo no puede costar el paso: las referencias ya estan guardadas, asi que si el
        modulo de contactos falla o la persona cancela el dialogo del sistema, el alta sigue.
      */
      const telefonos = drafts.filter(isComplete).map((draft) => draft.phone.trim());
      const resumen = analizarAgenda
        ? await resumirAgenda(telefonos)
        : agendaNoCompartida(telefonos.length, new Date().toISOString());
      try {
        await onboardingApi.submitContactsSnapshot(session.customerId, {
          granted: resumen.permiso,
          algorithmVersion: resumen.algorithmVersion,
          computedAt: resumen.computedAt,
          totalContacts: resumen.totalContacts,
          contactsWithPhone: resumen.contactsWithPhone,
          uniquePhoneCount: resumen.uniquePhoneCount,
          bolivianPhoneCount: resumen.bolivianPhoneCount,
          referencesFoundInAddressBook: resumen.referencesFoundInAddressBook,
          referencesDeclared: resumen.referencesDeclared,
          ...(resumen.phoneHashes.length > 0 ? { phoneHashes: resumen.phoneHashes } : {}),
        });
      } catch {
        // Silencio deliberado: es una señal adicional, no el resultado del paso. Perder el avance
        // del alta porque no se pudo mandar un agregado seria cobrarle a la persona un problema
        // nuestro.
      }

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
      <StepHeader
        code="reference_contacts"
        title="Tus referencias"
        subtitle={`Necesitamos ${REQUIRED_REFERENCES} personas que puedan dar referencia de ti.`}
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {drafts.map((draft, index) => (
        <Card key={index} tone={draft.fullName && draft.phone ? 'success' : 'default'}>
          <CardHeader
            icon="perfil"
            iconTone={draft.fullName && draft.phone ? 'success' : 'neutral'}
            eyebrow={`Referencia ${index + 1} de ${Math.max(REQUIRED_REFERENCES, drafts.length)}`}
            title={draft.fullName || 'Sin completar'}
            trailing={
              <Badge
                dot
                label={draft.fullName && draft.phone ? 'lista' : 'pendiente'}
                tone={draft.fullName && draft.phone ? 'success' : 'warning'}
              />
            }
          />

          <SelectField<Relationship>
            label="Qué relación tienen"
            value={draft.relationshipType}
            onChange={(next) => update(index, { relationshipType: next })}
            ayuda="Qué es esta persona para ti. Sirve para saber a quién llamar primero si un día no conseguimos ubicarte; no se le pide que responda por tu deuda ni se le consulta tu historial."
            opciones={[
              { valor: 'family', etiqueta: 'Familiar', detalle: 'Alguien de tu familia: padres, hermanos, pareja.' },
              { valor: 'friend', etiqueta: 'Amistad', detalle: 'Una amiga o un amigo de confianza.' },
              { valor: 'coworker', etiqueta: 'Compañero de trabajo', detalle: 'Alguien con quien trabajas a diario.' },
              { valor: 'employer', etiqueta: 'Empleador', detalle: 'Tu jefe o la persona que te contrata.' },
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
            ayuda="El nombre y los apellidos de tu referencia, para saber por quién preguntar al llamar. Ej.: «Rosa Mendez Villca»."
            required
          />
          <IconField icon="telefono"
            label="Teléfono"
            value={draft.phone}
            onChangeText={(value) => update(index, { phone: value })}
            keyboardType="phone-pad"
            ayuda="El celular al que se puede llamar a esa persona. Cópialo de tus contactos con el botón de arriba: un número tecleado de memoria sale mal una de cada tres veces, y entonces la referencia no sirve de nada."
            required
          />

          <CheckRow
            label="Le avisé que lo pondría como referencia"
            detail="Si no le avisaste, igual puedes continuar."
            ayuda="Marcarlo dice que esa persona ya sabe que diste su número. No es obligatorio y no cambia tu evaluación, pero avisarle evita que reciba una llamada nuestra sin entender por qué."
            checked={draft.informed}
            onToggle={(next) => update(index, { informed: next })}
          />
        </Card>
      ))}

      <View>
        <Button label="Agregar otra referencia" variant="ghost" onPress={() => setDrafts([...drafts, emptyDraft()])} />
      </View>

      {/*
        La autorizacion para mirar la FORMA de la agenda, con lo que se manda escrito al lado.

        Va aqui, al final y despues de las fichas, porque hasta este punto la persona no sabe de que
        agenda hablamos. Y esta redactada diciendo lo que NO viaja —ni nombres ni telefonos— porque
        es la unica parte que a alguien le importa de verdad, y porque es cierta: lo que sale del
        telefono son cuentas (`device/contacts.ts`).
      */}
      <Card>
        <CardHeader
          icon="perfil"
          title="Ayúdanos a confirmar que eres tú"
          detail="Si nos autorizas, la app cuenta cuántos contactos tienes y si tus referencias están entre ellos. No enviamos nombres ni teléfonos de tu agenda: solo esos números."
        />
        <CheckRow
          label="Permitir analizar mi agenda"
          detail="Puedes continuar sin autorizarlo."
          ayuda="Marcarlo autoriza que la app cuente cuántos contactos tienes y cuántas de tus referencias están entre ellos, y envíe solo esos dos números. No salen del teléfono ni nombres ni números de tu agenda. Es opcional y no marcarlo no impide terminar el alta."
          checked={analizarAgenda}
          onToggle={setAnalizarAgenda}
        />
      </Card>
      {/* Al final del formulario: ver `ui/trust-card.tsx`. */}
      <TrustCard items={TRUST_REFERENCIAS} />
    </Screen>
  );
}
