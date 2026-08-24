/**
 * Situacion economica declarada.
 *
 * Es la entrada del motor de decision, asi que la pantalla explica para que se pide cada dato. Los
 * importes se capturan con teclado numerico y se envian como numero: aqui el backend espera un
 * decimal, no centavos, y se respeta su contrato en lugar de imponerle el nuestro.
 */
import { type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { IconField, SelectField } from '../../src/ui/form-controls';
import { OPCIONES_ACTIVIDAD, nombreActividad } from '../../src/features/actividades';
import { Gap, Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';
import { TRUST_ECONOMIA } from '../../src/features/trust-copy';
import { TrustCard } from '../../src/ui/trust-card';

/*
 * Los dos catálogos los cierra el SERVIDOR (`customer-eligibility.constants.ts`), y hay que
 * copiarlos tal cual: el esquema del backend es `z.enum(...).strict()`, así que un valor que aquí
 * suene bien pero allí no exista no se degrada — devuelve 400 y la pantalla dice «Revisa los datos»
 * sin señalar el campo.
 *
 * Es lo que pasaba: el origen de ingresos ofrecía `business`, `freelance` y `family_support`, que el
 * servidor no conoce. Tres de las cuatro opciones del desplegable rompían el paso, y la cuarta
 * —`salary`— lo salvaba, que es justo lo que hace que un fallo así sobreviva a las pruebas a mano.
 */
type Employment = 'employee' | 'self_employed' | 'business_owner' | 'unemployed' | 'retired' | 'student';
type SourceOfFunds = 'salary' | 'business_income' | 'rental_income' | 'pension' | 'remittances' | 'savings' | 'other';

const toNumber = (raw: string): number | undefined => {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
  if (cleaned === '') return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export default function FinancialProfile() {
  const router = useRouter();
  const session = useSession();

  const [employmentStatus, setEmploymentStatus] = useState<Employment | null>(null);
  const [employerName, setEmployerName] = useState('');
  const [seniority, setSeniority] = useState('');
  const [income, setIncome] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [activity, setActivity] = useState('');
  const [sourceOfFunds, setSourceOfFunds] = useState<SourceOfFunds | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // El backend rechaza `employee` sin empleador: se valida antes de gastar un viaje de red.
  const employerRequired = employmentStatus === 'employee' && employerName.trim().length === 0;

  /*
    La antigüedad solo existe donde hay de qué contarla.

    El campo dice «cuánto tiempo llevas en tu trabajo o actividad actual» y se mostraba siempre,
    incluso tras declarar que no se trabaja: pedirle a alguien sin empleo la antigüedad de su empleo
    es una pregunta sin respuesta posible, y la que teclee para poder seguir es un dato inventado que
    entra al motor de decisión igual que uno real.
  */
  const pideAntiguedad = employmentStatus === 'employee' || employmentStatus === 'business_owner';
  const canSubmit =
    employmentStatus !== null &&
    sourceOfFunds !== null &&
    toNumber(income) !== undefined &&
    toNumber(expenses) !== undefined &&
    activity.trim().length > 0 &&
    !employerRequired &&
    !busy;

  const blockedReason = firstBlocker([
    [employmentStatus !== null, 'Falta elegir tu situación laboral.'],
    [!employerRequired, 'Falta el nombre de tu empleador.'],
    [toNumber(income) !== undefined, 'Falta tu ingreso mensual.'],
    [toNumber(expenses) !== undefined, 'Faltan tus gastos mensuales.'],
    [activity.trim().length > 0, 'Falta a que te dedicas.'],
    [sourceOfFunds !== null, 'Falta el origen de tus ingresos.'],
  ]);

  const save = async () => {
    if (!session.customerId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.updateFinancialProfile(session.customerId, {
        employmentStatus: employmentStatus ?? undefined,
        employerName: employerName.trim() || undefined,
        employmentSeniorityMonths:
          pideAntiguedad && toNumber(seniority) !== undefined ? Math.round(toNumber(seniority)!) : undefined,
        monthlyIncomeDeclared: toNumber(income),
        otherMonthlyIncome: toNumber(otherIncome) ?? 0,
        monthlyExpensesDeclared: toNumber(expenses),
        economicActivityCode: activity.trim(),
        sourceOfFunds: sourceOfFunds ?? undefined,
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
    <Screen scrollRef={scroll} footer={<Button label="Guardar" onPress={save} loading={busy} disabled={!canSubmit} blockedReason={blockedReason} />}>
      <ScreenHeader title="Tu situación económica" subtitle="Con esto calculamos cuánto puedes pagar cómodamente." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <SelectField<Employment>
        label="Situación laboral"
        value={employmentStatus}
        onChange={(next) => {
          setEmploymentStatus(next);
          /*
            Lo que deja de preguntarse se BORRA, no se esconde.

            Si alguien teclea 36 meses como empleado y luego corrige a «ahora no trabajo», el campo
            desaparece de la pantalla pero su valor seguiría viajando en el envío: el expediente
            diría que no trabaja y que lleva tres años en ese trabajo. Lo mismo con el empleador.
          */
          if (next !== 'employee' && next !== 'business_owner') setSeniority('');
          if (next !== 'employee') setEmployerName('');
        }}
        opciones={[
          { valor: 'employee', etiqueta: 'Trabajo en relación de dependencia' },
          { valor: 'self_employed', etiqueta: 'Trabajo por mi cuenta' },
          { valor: 'business_owner', etiqueta: 'Tengo un negocio' },
          { valor: 'student', etiqueta: 'Estudio' },
          // Faltaban las dos, y el servidor las acepta: sin ellas, quien no trabaja no puede
          // terminar el alta —ni eligiendo otra cosa, porque estaria declarando algo falso—.
          { valor: 'unemployed', etiqueta: 'Ahora no trabajo' },
          { valor: 'retired', etiqueta: 'Estoy jubilado' },
        ]}
      />

      {employmentStatus === 'employee' ? (
        <IconField icon="comercio"
          label="Nombre de tu empleador"
          value={employerName}
          onChangeText={setEmployerName}
          required
          error={employerRequired ? 'Necesitamos el nombre de tu empleador.' : null}
        />
      ) : null}

      {pideAntiguedad ? (
        <IconField icon="reloj"
          label="Antigüedad en meses"
          value={seniority}
          onChangeText={(v) => setSeniority(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          hint={employmentStatus === 'business_owner' ? 'Cuánto tiempo llevas con tu negocio.' : 'Cuánto tiempo llevas con tu empleador actual.'}
        />
      ) : null}

      <IconField icon="billetera"
        label="Ingreso mensual (Bs)"
        value={income}
        onChangeText={setIncome}
        keyboardType="decimal-pad"
        inputMode="decimal"
        required
      />
      <IconField icon="billetera" label="Otros ingresos mensuales (Bs)" value={otherIncome} onChangeText={setOtherIncome} keyboardType="decimal-pad" inputMode="decimal" />
      <IconField icon="grafico"
        label="Gastos mensuales (Bs)"
        value={expenses}
        onChangeText={setExpenses}
        keyboardType="decimal-pad"
        inputMode="decimal"
        hint="Alquiler, servicios, deudas y gastos fijos."
        required
      />

      <SelectField
        label="Actividad económica"
        value={activity || null}
        onChange={setActivity}
        opciones={OPCIONES_ACTIVIDAD}
        placeholder="Elige tu rubro"
        hint={nombreActividad(activity) ? undefined : 'Busca por rubro: comercio, transporte, salud…'}
        required
        buscable
      />

      <SelectField<SourceOfFunds>
        label="Origen principal de tus ingresos"
        value={sourceOfFunds}
        onChange={setSourceOfFunds}
        opciones={[
          { valor: 'salary', etiqueta: 'Salario' },
          { valor: 'business_income', etiqueta: 'Mi negocio' },
          { valor: 'rental_income', etiqueta: 'Alquileres' },
          { valor: 'remittances', etiqueta: 'Remesas del exterior' },
          { valor: 'pension', etiqueta: 'Jubilación o renta' },
          { valor: 'savings', etiqueta: 'Ahorros' },
          { valor: 'other', etiqueta: 'Otro' },
        ]}
      />

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Declarar información falsa puede anular tu línea de crédito.
      </AtlasText>
      {/* Al final del formulario: ver `ui/trust-card.tsx`. */}
      <TrustCard items={TRUST_ECONOMIA} />
    </Screen>
  );
}
