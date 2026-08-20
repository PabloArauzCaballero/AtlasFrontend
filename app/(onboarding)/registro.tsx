/**
 * Creacion de cuenta.
 *
 * Un solo paso con lo minimo indispensable: quien eres, como te contactamos, tu contrasena y el
 * consentimiento explicito. Todo lo demas —economia, domicilio, documento, referencias— llega
 * despues, cuando la persona ya tiene una cuenta que recuperar si abandona.
 *
 * El consentimiento no es una casilla decorativa: el backend exige al menos uno y guarda cual
 * version se acepto.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as customerApi from '../../src/api/endpoints/customer';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { CheckRow, Field } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, Card, ErrorState, Skeleton } from '../../src/ui/primitives';

/** Edad minima exigida por la regla de habilitacion del backend. */
const MIN_AGE = 18;

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function ageFrom(birthDate: string): number | null {
  if (!isIsoDate(birthDate)) return null;
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export default function Register() {
  const router = useRouter();
  const session = useSession();

  const [documents, setDocuments] = useState<customerApi.ConsentDocument[] | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ firstName: '', lastName: '', birthDate: '', phone: '+591', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const loadConsents = () => {
    setLoadError(null);
    customerApi
      .listActiveConsents()
      .then((list) => {
        setDocuments(list);
        setAccepted(Object.fromEntries(list.map((document) => [document.id, false])));
      })
      .catch(setLoadError);
  };

  useEffect(loadConsents, []);

  const age = ageFrom(form.birthDate);
  const errors = {
    firstName: form.firstName.trim().length === 0 ? 'Escribe tu nombre.' : null,
    lastName: form.lastName.trim().length === 0 ? 'Escribe tu apellido.' : null,
    birthDate: !isIsoDate(form.birthDate)
      ? 'Usa el formato AAAA-MM-DD.'
      : age !== null && age < MIN_AGE
        ? `Debes tener al menos ${MIN_AGE} anos.`
        : null,
    phone: form.phone.trim().length < 8 ? 'Escribe tu numero con codigo de pais.' : null,
    email: !form.email.includes('@') ? 'Escribe un correo valido.' : null,
    password: form.password.length < 10 ? 'Minimo 10 caracteres.' : null,
  };

  const requiredConsents = (documents ?? []).filter((document) => document.requiresExplicitAction);
  const consentsOk = requiredConsents.every((document) => accepted[document.id]);
  const formOk = Object.values(errors).every((value) => value === null);
  const canSubmit = formOk && consentsOk && !busy && documents !== null;

  /*
    El motivo va en el orden de la pantalla: el primero que falta es el que hay que ir a corregir.
    La fecha de nacimiento es el caso que motivo todo esto —su ejemplo `1996-04-12` se lee como un
    valor ya escrito—, asi que su mensaje nombra el campo en vez de limitarse a "revisa los datos".
  */
  const blockedReason = firstBlocker([
    [documents !== null, 'Estamos cargando las autorizaciones. Un momento.'],
    [errors.firstName === null, 'Falta tu nombre.'],
    [errors.lastName === null, 'Falta tu apellido.'],
    [errors.birthDate === null, errors.birthDate ?? 'Falta tu fecha de nacimiento.'],
    [errors.phone === null, 'Falta tu telefono con codigo de pais.'],
    [errors.email === null, 'Falta tu correo electronico.'],
    [errors.password === null, 'La contrasena necesita al menos 10 caracteres.'],
    [consentsOk, 'Falta aceptar las autorizaciones obligatorias.'],
  ]);

  const submit = async () => {
    if (!canSubmit || !documents) return;
    setBusy(true);
    setError(null);
    try {
      await session.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthDate: form.birthDate,
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        consents: documents.map((document) => ({
          consentDocumentId: document.id,
          purposeCode: document.documentCode,
          granted: Boolean(accepted[document.id]),
        })),
      });
      router.replace('/(onboarding)/verificar-contacto');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;
  const describedLoad = loadError ? describeError(loadError) : null;

  return (
    <Screen footer={<Button label="Crear mi cuenta" onPress={submit} loading={busy} disabled={!canSubmit} blockedReason={blockedReason} />}>
      <ScreenHeader title="Crear cuenta" subtitle="Necesitamos estos datos para abrir tu expediente." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <Field label="Nombre" value={form.firstName} onChangeText={(v) => setForm({ ...form, firstName: v })} autoComplete="given-name" textContentType="givenName" required error={form.firstName ? errors.firstName : null} />
      <Field label="Apellido" value={form.lastName} onChangeText={(v) => setForm({ ...form, lastName: v })} autoComplete="family-name" textContentType="familyName" required error={form.lastName ? errors.lastName : null} />
      <Field
        label="Fecha de nacimiento"
        value={form.birthDate}
        onChangeText={(v) => setForm({ ...form, birthDate: v })}
        placeholder="1996-04-12"
        keyboardType="numbers-and-punctuation"
        inputMode="numeric"
        maxLength={10}
        hint="Formato AAAA-MM-DD."
        required
        error={form.birthDate ? errors.birthDate : null}
      />
      <Field
        label="Telefono"
        value={form.phone}
        onChangeText={(v) => setForm({ ...form, phone: v })}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        hint="Ahi te enviamos el codigo de verificacion."
        required
        error={form.phone.length > 4 ? errors.phone : null}
      />
      <Field
        label="Correo electronico"
        value={form.email}
        onChangeText={(v) => setForm({ ...form, email: v })}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        required
        error={form.email ? errors.email : null}
      />
      <Field
        label="Contrasena"
        value={form.password}
        onChangeText={(v) => setForm({ ...form, password: v })}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        hint="Minimo 10 caracteres."
        required
        error={form.password ? errors.password : null}
      />

      <Gap size="sm" />
      <AtlasText variant="h3">Autorizaciones</AtlasText>

      {describedLoad ? (
        <ErrorState title={describedLoad.title} detail={describedLoad.detail} onRetry={loadConsents} reference={describedLoad.reference} />
      ) : documents === null ? (
        <Card>
          <Skeleton height={20} width="70%" />
          <Skeleton height={20} width="50%" />
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <AtlasText variant="body" tone="secondary">
            No hay documentos vigentes para aceptar en este momento.
          </AtlasText>
        </Card>
      ) : (
        <Card>
          {documents.map((document) => (
            <CheckRow
              key={document.id}
              label={titleForConsent(document.documentCode)}
              detail={`Version ${document.versionCode}`}
              checked={Boolean(accepted[document.id])}
              onToggle={(next) => setAccepted({ ...accepted, [document.id]: next })}
            />
          ))}
        </Card>
      )}

      <AtlasText variant="caption" tone="tertiary">
        Guardamos que version aceptaste y cuando, tal como exige la normativa de proteccion de datos.
      </AtlasText>
    </Screen>
  );
}

function titleForConsent(code: string): string {
  if (code.includes('privacy')) return 'Acepto la politica de privacidad';
  if (code.includes('terms')) return 'Acepto los terminos y condiciones';
  if (code.includes('bureau') || code.includes('credit')) return 'Autorizo la consulta de mi historial crediticio';
  return `Acepto ${code}`;
}
