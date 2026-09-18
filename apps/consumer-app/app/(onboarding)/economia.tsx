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
import { Gap, Screen, useScrollToError } from '../../src/ui/layout';
import { StepHeader } from '../../src/ui/step-header';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';
import { TRUST_ECONOMIA } from '../../src/features/trust-copy';
import { TrustCard } from '../../src/ui/trust-card';
import { bitacora } from '../../src/features/bitacora';
import { AdjuntoDeApoyo } from '../../src/ui/adjunto-de-apoyo';
import { GrabadorDeOcupacion } from '../../src/ui/grabador-de-ocupacion';

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
      await bitacora.medirEnvio(() => onboardingApi.updateFinancialProfile(session.customerId!, {
        employmentStatus: employmentStatus ?? undefined,
        employerName: employerName.trim() || undefined,
        employmentSeniorityMonths:
          pideAntiguedad && toNumber(seniority) !== undefined ? Math.round(toNumber(seniority)!) : undefined,
        monthlyIncomeDeclared: toNumber(income),
        otherMonthlyIncome: toNumber(otherIncome) ?? 0,
        monthlyExpensesDeclared: toNumber(expenses),
        economicActivityCode: activity.trim(),
        sourceOfFunds: sourceOfFunds ?? undefined,
      }));
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
      <StepHeader code="financial_profile" title="Tu situación económica" subtitle="Con esto calculamos cuánto puedes pagar cómodamente." />

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
        ayuda="De dónde sale el dinero con el que vas a pagar tus cuotas. Lo que elijas cambia lo que se te pregunta después —empleador, antigüedad— y cuánta estabilidad se le supone a tu ingreso."
        opciones={[
          { valor: 'employee', etiqueta: 'Trabajo en relación de dependencia', detalle: 'Tienes un empleador que te paga un sueldo.' },
          { valor: 'self_employed', etiqueta: 'Trabajo por mi cuenta', detalle: 'Cobras por trabajo hecho, sin patrón fijo.' },
          { valor: 'business_owner', etiqueta: 'Tengo un negocio', detalle: 'Vives de un negocio tuyo, con o sin empleados.' },
          { valor: 'student', etiqueta: 'Estudio', detalle: 'Tu ocupación principal es estudiar.' },
          // Faltaban las dos, y el servidor las acepta: sin ellas, quien no trabaja no puede
          // terminar el alta —ni eligiendo otra cosa, porque estaria declarando algo falso—.
          { valor: 'unemployed', etiqueta: 'Ahora no trabajo', detalle: 'Sin ingreso propio por trabajo en este momento.' },
          { valor: 'retired', etiqueta: 'Estoy jubilado', detalle: 'Cobras una jubilación o una renta.' },
        ]}
      />

      {employmentStatus === 'employee' ? (
        <IconField icon="comercio"
          label="Nombre de tu empleador"
          value={employerName}
          onChangeText={setEmployerName}
          ayuda="El nombre de la empresa o la persona que te paga, como figura en tu boleta de pago. Ej.: «Farmacorp S.A.». Sirve para confirmar el ingreso que declaras."
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
          ayuda={
            employmentStatus === 'business_owner'
              ? 'Cuántos meses llevas con este negocio, en números. Dos años son 24. Un negocio que ya pasó su primer año sostiene mejor una cuota que uno recién abierto.'
              : 'Cuántos meses llevas con tu empleador actual, en números. Dos años son 24. Cuanto más tiempo, más estable se considera el ingreso que declaras.'
          }
        />
      ) : null}

      <IconField icon="billetera"
        label="Ingreso mensual (Bs)"
        value={income}
        onChangeText={setIncome}
        keyboardType="decimal-pad"
        inputMode="decimal"
        ayuda="Lo que te queda cada mes de tu trabajo principal, ya descontados aportes e impuestos. Ej.: 4500. Es la base del cálculo de cuánto puedes pagar cómodamente: inflarlo solo consigue una cuota que no vas a poder pagar."
        required
      />
      <IconField
        icon="billetera"
        label="Otros ingresos mensuales (Bs)"
        value={otherIncome}
        onChangeText={setOtherIncome}
        keyboardType="decimal-pad"
        inputMode="decimal"
        ayuda="Lo que entra cada mes además de tu trabajo principal: alquileres, remesas, pensiones, un segundo empleo. Si no hay nada más, déjalo vacío. Ej.: 800."
      />
      <IconField icon="grafico"
        label="Gastos mensuales (Bs)"
        value={expenses}
        onChangeText={setExpenses}
        keyboardType="decimal-pad"
        inputMode="decimal"
        hint="Alquiler, servicios, deudas y gastos fijos."
        ayuda="Lo que se te va cada mes sí o sí: alquiler, luz, agua, colegio, cuotas de otras deudas. Ej.: 2200. Es lo que se resta a tus ingresos para ver cuánto queda libre; declararlo de menos hace que te ofrezcamos una cuota que te aprieta."
        required
      />

      <SelectField
        label="Actividad económica"
        value={activity || null}
        onChange={setActivity}
        opciones={OPCIONES_ACTIVIDAD}
        placeholder="Elige tu rubro"
        hint={nombreActividad(activity) ? undefined : 'Busca por rubro: comercio, transporte, salud…'}
        ayuda="A qué se dedica el trabajo o el negocio del que vives, elegido de la lista. Si no encuentras el tuyo, escribe una palabra en el buscador de la hoja; si aun así no está, usa «Otra actividad» en vez de elegir uno parecido."
        required
        buscable
      />

      <SelectField<SourceOfFunds>
        label="Origen principal de tus ingresos"
        value={sourceOfFunds}
        onChange={setSourceOfFunds}
        ayuda="De dónde viene la mayor parte del dinero que declaraste arriba. La ley contra el lavado obliga a preguntarlo y a que la respuesta cuadre con tu situación laboral; elige la fuente que más pesa, no todas las que tienes."
        opciones={[
          { valor: 'salary', etiqueta: 'Salario', detalle: 'Un sueldo que te paga un empleador.' },
          { valor: 'business_income', etiqueta: 'Mi negocio', detalle: 'Las ventas o los servicios de tu propio negocio.' },
          { valor: 'rental_income', etiqueta: 'Alquileres', detalle: 'Rentas de una casa, un local o un vehículo.' },
          { valor: 'remittances', etiqueta: 'Remesas del exterior', detalle: 'Dinero que te envía alguien desde otro país.' },
          { valor: 'pension', etiqueta: 'Jubilación o renta', detalle: 'Una jubilación, una renta o una pensión.' },
          { valor: 'savings', etiqueta: 'Ahorros', detalle: 'Vives de dinero que ahorraste antes.' },
          { valor: 'other', etiqueta: 'Otro', detalle: 'Ninguna de las anteriores describe tu caso.' },
        ]}
      />

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Declarar información falsa puede anular tu línea de crédito.
      </AtlasText>
      {/* Al final del formulario: ver `ui/trust-card.tsx`. */}
      {/*
        Lo que MEJORA el monto, sin ser obligatorio. Copiado de quien lo hacia bien: el extracto
        encuadrado como «mejora tu monto aprobado», el QR de cobro sin monto como prueba de que hay
        una cuenta bancaria activa, y un audio corto para explicar a que te dedicas con tu voz.
      */}
      <Gap size="sm" />
      <AtlasText variant="title">Mejora tu monto (opcional)</AtlasText>
      <AtlasText variant="caption" tone="secondary">
        Nada de esto es obligatorio. Cada cosa que añadas la revisa una persona y cuenta a tu favor.
      </AtlasText>
      {session.customerId ? (
        <>
          <AdjuntoDeApoyo
            customerId={session.customerId}
            kind="bank_qr_proof"
            titulo="QR de cobro de tu banca"
            detalle="Un QR de cobro SIN monto, generado desde tu app bancaria. No se hará ningún cobro ni depósito: sólo prueba que tienes una cuenta activa."
            bitacora="subir_qr"
            origen="imagen"
          />
          <GrabadorDeOcupacion customerId={session.customerId} />
          <Button label="Subir mi extracto bancario (3 meses)" bitacora="subir_extracto" variant="secondary" onPress={() => router.push('/(app)/extracto-bancario')} />
        </>
      ) : null}
      <Gap size="sm" />
      <TrustCard items={TRUST_ECONOMIA} />
    </Screen>
  );
}
