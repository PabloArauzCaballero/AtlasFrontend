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
import { useEffect, useState, useRef } from 'react';
import * as customerApi from '../../src/api/endpoints/customer';
import { describeError } from '../../src/api/errors';
import { FINALIDAD_AGENDA, FINALIDAD_UBICACION } from '../../src/session/device-signals';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { StyleSheet, View, type ScrollView } from 'react-native';
import { ConsentRow } from '../../src/ui/consent-row';
import { type Country, DEFAULT_COUNTRY, DateField, IconField, PhoneField } from '../../src/ui/form-controls';
import { Icon, type IconName } from '../../src/ui/icons';
import { color, space } from '../../src/theme/tokens';
import { Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
import { PinField } from '../../src/ui/pin-field';
import { AtlasText, Button, Card, Divider, ErrorState, Overline, SectionHeader, Skeleton } from '../../src/ui/primitives';
import { TRUST_REGISTRO } from '../../src/features/trust-copy';
import { TrustCard } from '../../src/ui/trust-card';

/**
 * Los documentos que gobierna la pantalla de permisos y que por eso no se listan en el alta.
 *
 * Son los mismos codigos que declara `session/device-signals.ts`; se importan de alli para que
 * añadir un tercero no obligue a acordarse de este archivo.
 */
const PERMISOS_DE_ARRANQUE = new Set<string>([FINALIDAD_AGENDA, FINALIDAD_UBICACION]);

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

/**
 * Que le pasa a este PIN, dicho como se lo dirias a la persona.
 *
 * La lista de prohibidos es la MISMA que valida el servidor. Se repite aqui a proposito: que el
 * telefono lo diga al teclear evita un viaje de ida y vuelta para enterarse de que `1234` no vale,
 * y el servidor sigue siendo quien manda —esto es comodidad, no control.
 */
const PIN_PROHIBIDOS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '2345', '3456', '4567', '5678', '6789', '7890',
  '4321', '5432', '6543', '7654', '8765', '9876', '0987',
  '1212', '1122', '1004', '2000', '6969', '1313', '2001', '1010',
]);

function pinProblem(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'Tu PIN debe ser de 4 dígitos.';
  if (PIN_PROHIBIDOS.has(pin)) return 'Ese PIN es demasiado fácil de adivinar. Elige otro.';
  return null;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const loadConsents = () => {
    setLoadError(null);
    customerApi
      .listActiveConsents()
      .then((todos) => {
        /*
          Los dos permisos del arranque NO salen aqui.

          `device_address_book` y `location_tracking` ya se decidieron en la pantalla de permisos, y
          su consentimiento lo registra `session/device-signals.ts` en cuanto hay cuenta. Volver a
          pintarlos aqui como dos casillas sueltas le pediria a la persona lo mismo dos veces en el
          mismo minuto y —peor— dejaria que las respuestas se contradijeran: la casilla diria «no» y
          el permiso del sistema, concedido hace un momento, diria «si».
        */
        const list = todos.filter((documento) => !PERMISOS_DE_ARRANQUE.has(documento.documentCode));
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
        ? `Debes tener al menos ${MIN_AGE} años.`
        : null,
    phone: form.phone.length < 7 ? 'Escribe tu número, sin el código de país.' : null,
    email: !form.email.includes('@') ? 'Escribe un correo válido.' : null,
    password: pinProblem(form.password),
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
    [errors.phone === null, 'Falta tu número de teléfono.'],
    [errors.email === null, 'Falta tu correo electrónico.'],
    [errors.password === null, errors.password ?? 'Falta tu PIN de 4 dígitos.'],
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

  // El fallo se pinta arriba y el boton esta abajo: hay que llevar la vista hasta el.

  const scroll = useRef<ScrollView>(null);

  useScrollToError(error, scroll);
  const describedLoad = loadError ? describeError(loadError) : null;

  return (
    <Screen scrollRef={scroll} footer={<Button label="Crear mi cuenta" onPress={submit} loading={busy} disabled={!canSubmit} blockedReason={blockedReason} />}>
      <ScreenHeader title="Crear cuenta" subtitle="Necesitamos estos datos para abrir tu expediente." onBack="auto" />

      {described ? (
        <ErrorState
          title={described.title}
          detail={described.detail}
          reference={described.reference}
          actions={
            described.recovery.length > 0 ? (
              <>
                {described.recovery.map((option, index) => (
                  <Button
                    key={option.href}
                    label={option.label}
                    variant={index === 0 ? 'primary' : 'ghost'}
                    onPress={() => router.replace(option.href as never)}
                  />
                ))}
              </>
            ) : null
          }
        />
      ) : null}

      {/*
        Tres bloques y no una lista de siete campos.

        Quien abre esto no ve «siete cosas que rellenar», ve «quien soy, como te contacto, como
        entro». Agrupar por lo que significa cada dato acorta la pantalla percibida sin quitar un
        solo campo, y es lo que hace que un formulario parezca una ficha y no un cuestionario.
      */}
      <FormSection icon="perfil" title="Quién eres">
        <IconField
          label="Nombre"
          icon="perfil"
          value={form.firstName}
          onChangeText={(v) => setForm({ ...form, firstName: v })}
          autoComplete="given-name"
          textContentType="givenName"
          placeholder="Valeria"
          ayuda="Tu nombre tal como figura en tu carnet de identidad, sin apodos. Tiene que coincidir con el documento que vas a fotografiar más adelante: si no coincide, la verificación se detiene y la revisa una persona."
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
          ayuda="Tus dos apellidos como están en el carnet, incluido el de casada si aparece ahí. Es lo que se compara con el documento al verificar tu identidad."
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
          hint={`Debes tener al menos ${MIN_AGE} años.`}
          ayuda={`El día que naciste, el mismo que figura en tu carnet. Con menos de ${MIN_AGE} años no se puede firmar un crédito en Bolivia, y la edad también entra en el cálculo de cuánto puedes pagar cómodamente.`}
          required
          error={form.birthDate ? errors.birthDate : null}
        />
      </FormSection>

      <FormSection icon="ubicacion" title="Cómo te contactamos">
        <PhoneField
          label="Teléfono"
          value={form.phone}
          onChangeText={(v) => setForm({ ...form, phone: v })}
          country={country}
          onChangeCountry={setCountry}
          hint="Ahí te enviamos el código de verificación."
          ayuda="Tu número de celular, sin el código de país: ese se elige aparte. Ahí llega el código que confirma que la línea es tuya, y es por donde te avisamos de tus cuotas, así que tiene que ser un número al que tengas acceso hoy."
          required
          error={form.phone ? errors.phone : null}
        />
        <IconField
          label="Correo electrónico"
          icon="sobre"
          value={form.email}
          onChangeText={(v) => setForm({ ...form, email: v })}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="tu@correo.com"
          ayuda="Un correo que revises de verdad: por ahí llegan el contrato, tus comprobantes de pago y el código para recuperar el PIN si lo olvidas. Ej.: valeria.mendez@gmail.com."
          required
          error={form.email ? errors.email : null}
        />
      </FormSection>

      <FormSection icon="candado" title="Cómo entras">
        {/*
          Un PIN de CUATRO digitos, no una contrasena.

          La de diez caracteres la olvidaba la mitad de la gente, y recuperarla pasa por el correo
          —que en este segmento no siempre se revisa—. Un PIN que se recuerda es un PIN que no se
          apunta en un papel, y esa era la alternativa real. Lo sostienen el bloqueo temporal por
          intentos fallidos y la lista de PIN prohibidos que valida el servidor.
        */}
        <PinField
          label="Tu PIN"
          value={form.password}
          onChangeText={(v) => setForm({ ...form, password: v })}
          error={form.password ? errors.password : null}
          hint="Cuatro dígitos que recuerdes. Evita 1234, tu año de nacimiento o cuatro iguales."
          ayuda="Cuatro dígitos con los que entras a la app y autorizas tus compras. No lo compartas con nadie: quien lo tenga puede comprar a tu nombre. El servidor rechaza los fáciles de adivinar y bloquea la cuenta un rato tras cinco intentos fallidos."
        />
      </FormSection>

      <SectionHeader title="Autorizaciones" detail="Lo que necesitamos que aceptes para poder evaluarte." />

      {describedLoad ? (
        <ErrorState title={describedLoad.title} detail={describedLoad.detail} onRetry={loadConsents} reference={describedLoad.reference} />
      ) : documents === null ? (
        <Card>
          <Skeleton height={23} width="70%" />
          <Skeleton height={1} />
          <Skeleton height={23} width="50%" />
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
                  código del documento, así que publicar uno nuevo significaba tocar la app —y hasta
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
        Guardamos qué versión aceptaste y cuándo, tal como exige la normativa de protección de datos.
      </AtlasText>
      {/* Al final del formulario: ver `ui/trust-card.tsx`. */}
      <TrustCard items={TRUST_REGISTRO} />
    </Screen>
  );
}

function titleForConsent(code: string): string {
  if (code.includes('privacy')) return 'Acepto la política de privacidad';
  if (code.includes('terms')) return 'Acepto los términos y condiciones';
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
        <Icon name={icon} size={14} tint={color.text.tertiary} />
        {/*
          Las versalitas y su interletraje los pone `Overline`, no un `.toUpperCase()` con un
          `letterSpacing` elegido a ojo en esta pantalla. Escribirlas en el contenido deja al lector
          de pantalla deletreando el titulo del grupo letra a letra.
        */}
        <Overline>{title}</Overline>
      </View>
      <Card>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
});
