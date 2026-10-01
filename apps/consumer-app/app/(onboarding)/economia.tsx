/**
 * Situacion economica declarada.
 *
 * Es la entrada del motor de decision, asi que la pantalla explica para que se pide cada dato. Los
 * importes se capturan con teclado numerico y se envian como numero: aqui el backend espera un
 * decimal, no centavos, y se respeta su contrato en lugar de imponerle el nuestro.
 */
import { type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
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
import { TrustCardRemoto } from '../../src/features/use-contenido-remoto';
import { bitacora } from '../../src/features/bitacora';
import { AdjuntoDeApoyo } from '../../src/ui/adjunto-de-apoyo';

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
type Employment = 'employee' | 'self_employed' | 'business_owner' | 'unemployed' | 'student';
type IncomeFrequency = 'monthly' | 'biweekly' | 'weekly' | 'irregular';

/*
 * El ingreso se pide por BANDA, no por monto: es autodeclarado y se trata como dato blando. Lo que
 * decide la capacidad de pago de verdad es el extracto bancario, al final del alta.
 *
 * `declarado` es el valor que viaja como `monthlyIncomeDeclared`, porque la capacidad sin extracto
 * (`CAP_SIN_EXTRACTO`) necesita un número: el PISO de la banda —conservador a propósito—, salvo la
 * primera, cuyo piso es cero y dejaría a todos sin cupo. Los códigos los cierra el servidor
 * (`MONTHLY_INCOME_BAND_VALUES`).
 */
type IncomeBand = 'bs_0_3000' | 'bs_3000_5000' | 'bs_5000_8000' | 'bs_8000_12000' | 'bs_12000_20000' | 'bs_20000_plus';
const BANDAS: readonly { valor: IncomeBand; etiqueta: string; detalle: string; declarado: number }[] = [
  { valor: 'bs_0_3000', etiqueta: 'Menos de Bs 3.000', detalle: 'Te queda menos de 3.000 bolivianos al mes.', declarado: 1500 },
  { valor: 'bs_3000_5000', etiqueta: 'Bs 3.000 a 5.000', detalle: 'Te queda entre 3.000 y 5.000 bolivianos al mes.', declarado: 3000 },
  { valor: 'bs_5000_8000', etiqueta: 'Bs 5.000 a 8.000', detalle: 'Te queda entre 5.000 y 8.000 bolivianos al mes.', declarado: 5000 },
  { valor: 'bs_8000_12000', etiqueta: 'Bs 8.000 a 12.000', detalle: 'Te queda entre 8.000 y 12.000 bolivianos al mes.', declarado: 8000 },
  { valor: 'bs_12000_20000', etiqueta: 'Bs 12.000 a 20.000', detalle: 'Te queda entre 12.000 y 20.000 bolivianos al mes.', declarado: 12000 },
  { valor: 'bs_20000_plus', etiqueta: 'Más de Bs 20.000', detalle: 'Te quedan más de 20.000 bolivianos al mes.', declarado: 20000 },
];

const EMPLEOS: readonly Employment[] = ['employee', 'self_employed', 'business_owner', 'unemployed', 'student'];
const FRECUENCIAS: readonly IncomeFrequency[] = ['monthly', 'biweekly', 'weekly', 'irregular'];

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
  const [incomeBand, setIncomeBand] = useState<IncomeBand | null>(null);
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency | null>(null);
  const [activity, setActivity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  /*
    Volver a este paso enseña lo ya contestado (pedido de Pablo, 2026-09-28): antes cada vuelta atrás
    era un formulario vacío. Sólo rellena lo que la persona todavía no tocó en esta visita.
  */
  useEffect(() => {
    if (!session.customerId) return;
    let vivo = true;
    void onboardingApi
      .getAnswers(session.customerId)
      .then(({ financialProfile: guardado }) => {
        if (!vivo) return;
        const texto = (clave: keyof typeof guardado) => (typeof guardado[clave] === 'string' ? (guardado[clave] as string) : null);
        const empleo = texto('employmentStatus');
        if (empleo && EMPLEOS.includes(empleo as Employment)) setEmploymentStatus((actual) => actual ?? (empleo as Employment));
        const empleador = texto('employerName');
        if (empleador) setEmployerName((actual) => actual || empleador);
        const meses = guardado.employmentSeniorityMonths;
        if (typeof meses === 'number') setSeniority((actual) => actual || String(Math.floor(meses / 12)));
        const banda = texto('monthlyIncomeBand');
        if (banda && BANDAS.some((b) => b.valor === banda)) setIncomeBand((actual) => actual ?? (banda as IncomeBand));
        const frecuencia = texto('incomeFrequency');
        if (frecuencia && FRECUENCIAS.includes(frecuencia as IncomeFrequency)) setIncomeFrequency((actual) => actual ?? (frecuencia as IncomeFrequency));
        const rubro = texto('economicActivityCode');
        if (rubro) setActivity((actual) => actual || rubro);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [session.customerId]);

  // El backend rechaza `employee` sin empleador: se valida antes de gastar un viaje de red.
  const employerRequired = employmentStatus === 'employee' && employerName.trim().length === 0;

  /*
    La antigüedad solo existe donde hay de qué contarla.

    El campo dice «cuánto tiempo llevas en tu trabajo o actividad actual» y se mostraba siempre,
    incluso tras declarar que no se trabaja: pedirle a alguien sin empleo la antigüedad de su empleo
    es una pregunta sin respuesta posible, y la que teclee para poder seguir es un dato inventado que
    entra al motor de decisión igual que uno real.
  */
  const pideAntiguedad = employmentStatus === 'employee' || employmentStatus === 'self_employed' || employmentStatus === 'business_owner';
  const faltanAnios = pideAntiguedad && seniority.trim().length === 0;
  const canSubmit =
    employmentStatus !== null &&
    incomeBand !== null &&
    incomeFrequency !== null &&
    !faltanAnios &&
    activity.trim().length > 0 &&
    !employerRequired &&
    !busy;

  const blockedReason = firstBlocker([
    [employmentStatus !== null, 'Falta elegir tu situación laboral.'],
    [!employerRequired, 'Falta el nombre de tu empleador.'],
    [!faltanAnios, 'Faltan tus años en el trabajo actual.'],
    [incomeBand !== null, 'Falta tu rango de ingreso mensual.'],
    [incomeFrequency !== null, 'Falta cada cuánto cobras.'],
    [activity.trim().length > 0, 'Falta a que te dedicas.'],
  ]);

  const save = async () => {
    if (!session.customerId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await bitacora.medirEnvio(() => onboardingApi.updateFinancialProfile(session.customerId!, {
        employmentStatus: employmentStatus ?? undefined,
        employerName: employerName.trim() || undefined,
        // Se pregunta en AÑOS, que es como la gente lo sabe; el servidor lo guarda en meses.
        employmentSeniorityMonths:
          pideAntiguedad && toNumber(seniority) !== undefined ? Math.round(toNumber(seniority)! * 12) : undefined,
        monthlyIncomeBand: incomeBand ?? undefined,
        monthlyIncomeDeclared: BANDAS.find((banda) => banda.valor === incomeBand)?.declarado,
        incomeFrequency: incomeFrequency ?? undefined,
        economicActivityCode: activity.trim(),
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
          if (next !== 'employee' && next !== 'self_employed' && next !== 'business_owner') setSeniority('');
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
          label="Años en tu trabajo actual"
          value={seniority}
          onChangeText={(v) => setSeniority(v.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          required
          hint={
            employmentStatus === 'business_owner'
              ? 'Cuántos años llevas con tu negocio. Menos de uno: 0.'
              : employmentStatus === 'self_employed'
                ? 'Cuántos años llevas en esta actividad. Menos de uno: 0.'
                : 'Cuántos años llevas con tu empleador actual. Menos de uno: 0.'
          }
          ayuda="En años completos, en números. Si todavía no cumpliste un año, escribe 0. Cuanto más tiempo, más estable se considera el ingreso que declaras."
        />
      ) : null}

      <SelectField<IncomeBand>
        label="Rango de ingreso mensual"
        value={incomeBand}
        onChange={setIncomeBand}
        required
        ayuda="Lo que te queda cada mes de tu trabajo principal, ya descontados aportes e impuestos. Basta con el rango: el monto exacto lo confirmamos con tu extracto bancario al final del registro."
        opciones={BANDAS.map((banda) => ({ valor: banda.valor, etiqueta: banda.etiqueta, detalle: banda.detalle }))}
      />
      <SelectField<IncomeFrequency>
        label="¿Cada cuánto cobras?"
        value={incomeFrequency}
        onChange={setIncomeFrequency}
        required
        ayuda="Con esto ponemos las fechas de tus cuotas cerca del día en que cobras, para que el pago no te agarre sin dinero."
        opciones={[
          { valor: 'monthly', etiqueta: 'Mensual', detalle: 'Te pagan una vez al mes.' },
          { valor: 'biweekly', etiqueta: 'Quincenal', detalle: 'Te pagan dos veces al mes.' },
          { valor: 'weekly', etiqueta: 'Semanal', detalle: 'Te pagan cada semana.' },
          { valor: 'irregular', etiqueta: 'Irregular', detalle: 'Depende de las ventas o de los trabajos.' },
        ]}
      />
      <SelectField
        label="Rubro o industria"
        value={activity || null}
        onChange={setActivity}
        opciones={OPCIONES_ACTIVIDAD}
        placeholder="Elige tu rubro"
        hint={nombreActividad(activity) ? undefined : 'Busca por rubro: comercio, transporte, salud…'}
        ayuda="A qué se dedica el trabajo o el negocio del que vives, elegido de la lista. Si no encuentras el tuyo, escribe una palabra en el buscador de la hoja; si aun así no está, usa «Otra actividad» en vez de elegir uno parecido."
        required
        buscable
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
        Nada de esto es obligatorio. Cada cosa que añadas la revisa una persona y cuenta a tu favor. El extracto bancario te lo pedimos al final.
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
        </>
      ) : null}
      <Gap size="sm" />
      <TrustCardRemoto grupo="economia" base={TRUST_ECONOMIA} />
    </Screen>
  );
}
