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
import { StyleSheet, View, Pressable } from 'react-native';
import { ConsentRow } from '../../src/ui/consent-row';
import { type Country, DEFAULT_COUNTRY, DateField, IconField, PhoneField } from '../../src/ui/form-controls';
import { Icon, type IconName } from '../../src/ui/icons';
import { color, space } from '../../src/theme/tokens';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, Card, Divider, ErrorState, Skeleton } from '../../src/ui/primitives';

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
  const [form, setForm] = useState({ firstName: '', lastName: '', birthDate: '', phone: '', email: '', password: '' });
  /*
   * Bolivia por defecto: es donde opera el producto. Preseleccionar el pais mas probable ahorra
   * un toque a casi todo el mundo y no le quita la opcion a nadie.
   */
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showPassword, setShowPassword] = useState(false);
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

  /*
   * Los limites del calendario. El maximo es el dia en que se cumple la edad minima: asi la fecha
   * que no vale directamente NO se puede elegir, en vez de elegirse y rechazarse despues.
   */
  const today = new Date();
  const latestBirth = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
  const earliestBirth = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());

  const age = ageFrom(form.birthDate);
  const errors = {
    firstName: form.firstName.trim().length === 0 ? 'Escribe tu nombre.' : null,
    lastName: form.lastName.trim().length === 0 ? 'Escribe tu apellido.' : null,
    /*
     * El formato ya no puede fallar: lo pone el calendario. Lo unico que queda por comprobar es la
     * edad, que es una regla de negocio y no de escritura.
     */
    birthDate: !isIsoDate(form.birthDate)
      ? 'Elige tu fecha de nacimiento.'
      : age !== null && age < MIN_AGE
        ? `Debes tener al menos ${MIN_AGE} anos.`
        : null,
    phone: form.phone.length < 7 ? 'Escribe tu numero, sin el codigo de pais.' : null,
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
    [errors.phone === null, 'Falta tu numero de telefono.'],
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
        // El prefijo se une aqui: el campo guarda solo los digitos nacionales.
        phone: `${country.dial}${form.phone}`,
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

      {/*
        Tres bloques y no una lista de siete campos.

        Quien abre esto no ve «siete cosas que rellenar», ve «quien soy, como te contacto, como
        entro». Agrupar por lo que significa cada dato acorta la pantalla percibida sin quitar un
        solo campo, y es lo que hace que un formulario parezca una ficha y no un cuestionario.
      */}
      <FormSection icon="perfil" title="Quien eres">
        <IconField
          label="Nombre"
          icon="perfil"
          value={form.firstName}
          onChangeText={(v) => setForm({ ...form, firstName: v })}
          autoComplete="given-name"
          textContentType="givenName"
          placeholder="Valeria"
          required
          error={form.firstName ? errors.firstName : null}
        />
        <IconField
          label="Apellido"
          icon="perfil"
          value={form.lastName}
          onChangeText={(v) => setForm({ ...form, lastName: v })}
          autoComplete="family-name"
          textContentType="familyName"
          placeholder="Mendez"
          required
          error={form.lastName ? errors.lastName : null}
        />
        <DateField
          label="Fecha de nacimiento"
          value={form.birthDate}
          onChange={(iso) => setForm({ ...form, birthDate: iso })}
          minimumDate={earliestBirth}
          maximumDate={latestBirth}
          initialDate={latestBirth}
          hint={`Debes tener al menos ${MIN_AGE} anos.`}
          required
          error={form.birthDate ? errors.birthDate : null}
        />
      </FormSection>

      <FormSection icon="ubicacion" title="Como te contactamos">
        <PhoneField
          label="Telefono"
          value={form.phone}
          onChangeText={(v) => setForm({ ...form, phone: v })}
          country={country}
          onChangeCountry={setCountry}
          hint="Ahi te enviamos el codigo de verificacion."
          required
          error={form.phone ? errors.phone : null}
        />
        <IconField
          label="Correo electronico"
          icon="documento"
          value={form.email}
          onChangeText={(v) => setForm({ ...form, email: v })}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="tu@correo.com"
          required
          error={form.email ? errors.email : null}
        />
      </FormSection>

      <FormSection icon="candado" title="Como entras">
        <IconField
          label="Contrasena"
          icon="candado"
          value={form.password}
          onChangeText={(v) => setForm({ ...form, password: v })}
          secureTextEntry={!showPassword}
          textContentType="newPassword"
          autoComplete="new-password"
          placeholder="Minimo 10 caracteres"
          required
          error={form.password ? errors.password : null}
          hint="Minimo 10 caracteres."
          trailing={
            /*
              Ver lo que se escribe reduce los errores de tecleo mas que cualquier mensaje. Va como
              texto y no como icono de ojo porque el ojo tachado y sin tachar se confunden.
            */
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              hitSlop={8}
            >
              <AtlasText variant="caption" style={{ color: color.action.primary }}>
                {showPassword ? 'Ocultar' : 'Ver'}
              </AtlasText>
            </Pressable>
          }
        />
      </FormSection>

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
          {documents.map((document, index) => (
            <View key={document.id}>
              {index > 0 ? <Divider /> : null}
              <ConsentRow
                /*
                  El titulo viene del BACKEND. Antes lo adivinaba una funcion local a partir del
                  codigo del documento, asi que publicar uno nuevo significaba tocar la app —y hasta
                  entonces salia «Acepto privacy-policy-dev».
                */
                title={document.title ?? titleForConsent(document.documentCode)}
                summary={document.summary}
                bodyMarkdown={document.bodyMarkdown}
                versionCode={document.versionCode}
                required={document.requiresExplicitAction}
                checked={Boolean(accepted[document.id])}
                onToggle={(next) => setAccepted({ ...accepted, [document.id]: next })}
              />
            </View>
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

/**
 * Un bloque del formulario, con su titulo y su icono.
 *
 * El icono va en el ENCABEZADO y no repetido en cada campo: dentro de los campos indica que dato se
 * pide, aqui indica de que trata el grupo. Dos jerarquias distintas con el mismo lenguaje grafico.
 */
function FormSection({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Icon name={icon} size={16} tint={color.text.tertiary} />
        <AtlasText variant="caption" tone="tertiary" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </AtlasText>
      </View>
      <Card>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xxs },
  sectionTitle: { letterSpacing: 1.1 },
});
