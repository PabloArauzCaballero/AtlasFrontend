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
import { Field } from '../../src/ui/fields';
import { SelectField } from '../../src/ui/form-controls';
import { Gap, Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';
import { TRUST_ECONOMIA } from '../../src/features/trust-copy';
import { TrustCard } from '../../src/ui/trust-card';

type Employment = 'employee' | 'self_employed' | 'business_owner' | 'unemployed' | 'retired' | 'student';
type SourceOfFunds = 'salary' | 'business' | 'freelance' | 'pension' | 'family_support' | 'other';

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
        employmentSeniorityMonths: toNumber(seniority) !== undefined ? Math.round(toNumber(seniority)!) : undefined,
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
        onChange={setEmploymentStatus}
        opciones={[
          { valor: 'employee', etiqueta: 'Trabajo en relación de dependencia' },
          { valor: 'self_employed', etiqueta: 'Trabajo por mi cuenta' },
          { valor: 'business_owner', etiqueta: 'Tengo un negocio' },
          { valor: 'student', etiqueta: 'Estudio' },
        ]}
      />

      {employmentStatus === 'employee' ? (
        <Field
          label="Nombre de tu empleador"
          value={employerName}
          onChangeText={setEmployerName}
          required
          error={employerRequired ? 'Necesitamos el nombre de tu empleador.' : null}
        />
      ) : null}

      <Field
        label="Antigüedad en meses"
        value={seniority}
        onChangeText={(v) => setSeniority(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        hint="Cuánto tiempo llevas en tu trabajo o actividad actual."
      />

      <Field
        label="Ingreso mensual (Bs)"
        value={income}
        onChangeText={setIncome}
        keyboardType="decimal-pad"
        inputMode="decimal"
        required
      />
      <Field label="Otros ingresos mensuales (Bs)" value={otherIncome} onChangeText={setOtherIncome} keyboardType="decimal-pad" inputMode="decimal" />
      <Field
        label="Gastos mensuales (Bs)"
        value={expenses}
        onChangeText={setExpenses}
        keyboardType="decimal-pad"
        inputMode="decimal"
        hint="Alquiler, servicios, deudas y gastos fijos."
        required
      />

      <Field
        label="Actividad económica"
        value={activity}
        onChangeText={setActivity}
        placeholder="comercio, salud, transporte..."
        autoCapitalize="none"
        required
      />

      <SelectField<SourceOfFunds>
        label="Origen principal de tus ingresos"
        value={sourceOfFunds}
        onChange={setSourceOfFunds}
        opciones={[
          { valor: 'salary', etiqueta: 'Salario' },
          { valor: 'business', etiqueta: 'Mi negocio' },
          { valor: 'freelance', etiqueta: 'Trabajos independientes' },
          { valor: 'family_support', etiqueta: 'Apoyo familiar' },
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
