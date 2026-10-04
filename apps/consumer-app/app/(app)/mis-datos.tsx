/**
 * Mis datos: todo lo que Atlas sabe de la persona, en un solo sitio y siempre disponible.
 *
 * Es el derecho de acceso hecho pantalla —no una solicitud que se envía y se espera—: se ve al momento.
 * A cambio, se vuelve a pedir el PIN: la sesión dice quién abrió la app, no que quien la tiene en la mano
 * sea esa persona.
 *
 * ## Qué se enseña y de dónde sale
 *
 * Nada se inventa ni se resume: son los mismos datos que el backend guarda (perfil, contactos, domicilio,
 * perfil económico declarado, permisos que se dieron o negaron) y, para la línea de crédito, de dónde salió
 * cada dato (`expediente` = lo que la persona declaró, `derivado` = lo que se calculó, `ausente` = lo que
 * falta). Los contactos van enmascarados, como en el resto de la app.
 *
 * ## Se protege solo
 *
 * Llegar aquí por un enlace directo no se salta el PIN: si no se confirmó hace poco, la pantalla lo pide
 * antes de pintar nada.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import * as customerApi from '../../src/api/endpoints/customer';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { useCreditBook } from '../../src/features/use-credit-book';
import { useProgress } from '../../src/features/use-progress';
import { contactoLegible, estadoDeCuenta, etiquetaEconomia, fechaLarga, oSinRegistrar, valorEconomia } from '../../src/features/mis-datos-formato';
import { fraseDeExperiencia } from '../../src/features/puntaje-explicado';
import { NivelCard } from '../../src/ui/nivel-card';
import { marcarPinConfirmado, pinConfirmadoReciente } from '../../src/features/pin-verificado';
import { useSession } from '../../src/session/session';
import { ConfirmarPinSheet } from '../../src/ui/confirmar-pin-sheet';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, Card, CardHeader, Divider, EmptyState, ErrorState, KeyValue, SkeletonLista } from '../../src/ui/primitives';

const FINALIDADES: Record<string, string> = {
  device_address_book: 'Agenda del dispositivo',
  location_tracking: 'Ubicación del dispositivo',
  data_processing: 'Tratamiento de tus datos',
  credit_bureau_inquiry: 'Consulta a burós de crédito',
  marketing: 'Ofertas y novedades',
};
const finalidad = (codigo: string) => FINALIDADES[codigo] ?? codigo.replace(/_/g, ' ');

const ORIGEN: Record<string, string> = {
  expediente: 'Lo declaraste tú',
  derivado: 'Lo calculó Atlas',
  ausente: 'Falta',
};
const VARIABLE: Record<string, string> = {
  monthlyIncome: 'Ingreso mensual',
  incomeSource: 'Fuente de ingreso',
  employmentType: 'Tipo de empleo',
  monthlyExpenses: 'Gastos mensuales',
  dependents: 'Dependientes',
};
const variable = (codigo: string) => VARIABLE[codigo] ?? codigo.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase();

type Datos = { me: customerApi.CustomerMe; respuestas: onboardingApi.OnboardingAnswers | null };

export default function MisDatos() {
  const router = useRouter();
  const session = useSession();
  const customerId = session.customerId;
  const [verificado, setVerificado] = useState(() => pinConfirmadoReciente());
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  const book = useCreditBook(verificado ? customerId : null);
  const nivel = useProgress(verificado ? customerId : null);

  const cargar = useCallback(async () => {
    if (!customerId) return;
    setCargando(true);
    setFallo(false);
    try {
      const [me, respuestas] = await Promise.all([
        customerApi.getMe(customerId),
        // El domicilio y el perfil económico son un complemento: si fallan, el resto se enseña igual.
        onboardingApi.getAnswers(customerId).catch(() => null),
      ]);
      setDatos({ me, respuestas });
    } catch {
      setFallo(true);
    } finally {
      setCargando(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (verificado) void cargar();
  }, [verificado, cargar]);

  if (!verificado) {
    return (
      <Screen>
        <ScreenHeader title="Mis datos" subtitle="Lo que Atlas sabe de ti." onBack="auto" />
        <EmptyState icon="candado" title="Confirma tu PIN" detail="Para enseñarte tus datos te pedimos el PIN otra vez." />
        <ConfirmarPinSheet
          visible
          onClose={() => router.back()}
          onVerificado={() => {
            marcarPinConfirmado();
            setVerificado(true);
          }}
          motivo="Vas a ver tus datos personales. Escribe tu PIN para continuar."
        />
      </Screen>
    );
  }

  if (cargando) {
    return (
      <Screen>
        <ScreenHeader title="Mis datos" subtitle="Lo que Atlas sabe de ti." onBack="auto" />
        <SkeletonLista filas={4} alto={96} />
      </Screen>
    );
  }

  if (fallo || !datos) {
    return (
      <Screen>
        <ScreenHeader title="Mis datos" subtitle="Lo que Atlas sabe de ti." onBack="auto" />
        <ErrorState title="No pudimos cargar tus datos" detail="Revisa tu conexión y vuelve a intentar." onRetry={() => void cargar()} />
      </Screen>
    );
  }

  const { me, respuestas } = datos;
  const direccion = respuestas?.address;
  const economia = respuestas?.financialProfile ?? {};
  const permisos = me.consents ?? { accepted: [], declined: [] };
  const inputs = book.creditLine?.inputs ?? {};
  const estado = estadoDeCuenta(me.customer.status);

  return (
    <Screen>
      <ScreenHeader title="Mis datos" subtitle="Lo que Atlas sabe de ti." onBack="auto" />

      {/*
        Tu nivel y por qué: el puntaje también es un dato que Atlas tiene de la persona. Se muestra aquí con su
        explicación a un toque (la cuenta parte por parte vive en «Tu nivel Atlas»).
      */}
      {nivel.fase === 'lista' ? (
        <>
          <NivelCard progress={nivel.progress} onPress={() => router.push('/(app)/progreso')} />
          <AtlasText variant="caption" tone="secondary">
            {`${fraseDeExperiencia(nivel.progress.experience.xp)} Toca la tarjeta para ver por qué tienes este puntaje.`}
          </AtlasText>
        </>
      ) : nivel.fase === 'cargando' ? (
        <SkeletonLista filas={1} alto={110} />
      ) : null}

      <Card>
        <CardHeader icon="perfil" title="Quién eres" divider={false} />
        {/* El código interno del cliente NO se enseña: es una clave de la base y en una captura identifica la cuenta. */}
        <KeyValue label="Nombre" value={oSinRegistrar([me.profile.firstName, me.profile.lastName].filter(Boolean).join(' '))} />
        <KeyValue label="Fecha de nacimiento" value={oSinRegistrar(fechaLarga(me.profile.birthDate))} />
        <KeyValue label="Estado de tu cuenta" value={estado.texto} tone={estado.tono} />
      </Card>

      <Card>
        <CardHeader icon="telefono" title="Cómo te contactamos" divider={false} />
        {me.contacts.length === 0 ? <AtlasText variant="body" tone="secondary">No tenemos contactos registrados.</AtlasText> : null}
        {me.contacts.map((contacto, indice) => {
          const fila = contactoLegible(contacto);
          return <KeyValue key={`${contacto.contactType}-${indice}`} label={fila.etiqueta} value={fila.valor} />;
        })}
      </Card>

      <Card>
        <CardHeader icon="ubicacion" title="Dónde vives" divider={false} />
        {direccion ? (
          <>
            <KeyValue label="Dirección" value={oSinRegistrar(direccion.addressLine)} />
            <KeyValue label="Zona" value={oSinRegistrar(direccion.zone)} />
            <KeyValue label="Ciudad" value={oSinRegistrar([direccion.city, direccion.department].filter(Boolean).join(', '))} />
          </>
        ) : (
          <AtlasText variant="body" tone="secondary">Todavía no registraste tu domicilio.</AtlasText>
        )}
      </Card>

      <Card>
        <CardHeader icon="billetera" title="Tu economía declarada" divider={false} />
        {Object.keys(economia).length === 0 ? (
          <AtlasText variant="body" tone="secondary">Todavía no declaraste datos económicos.</AtlasText>
        ) : (
          Object.entries(economia).map(([clave, valor]) => <KeyValue key={clave} label={etiquetaEconomia(clave)} value={valorEconomia(clave, valor)} />)
        )}
      </Card>

      <Card>
        <CardHeader icon="escudo" title="Permisos que diste y que negaste" divider={false} />
        {permisos.accepted.length === 0 && permisos.declined.length === 0 ? (
          <AtlasText variant="body" tone="secondary">No hay permisos registrados.</AtlasText>
        ) : null}
        {permisos.accepted.map((codigo) => (
          <KeyValue key={`si-${codigo}`} label={finalidad(codigo)} value="Diste el permiso" tone="success" />
        ))}
        {permisos.declined.map((codigo) => (
          <KeyValue key={`no-${codigo}`} label={finalidad(codigo)} value="No lo diste" tone="tertiary" />
        ))}
        <Divider />
        <AtlasText variant="caption" tone="secondary">Puedes cambiar tus permisos desde Privacidad.</AtlasText>
      </Card>

      {Object.keys(inputs).length > 0 ? (
        <Card>
          <CardHeader icon="grafico" title="De dónde salió cada dato de tu línea" divider={false} />
          {Object.entries(inputs).map(([clave, origen]) => (
            <KeyValue key={clave} label={variable(clave)} value={ORIGEN[origen] ?? origen} />
          ))}
        </Card>
      ) : null}

      <Gap />
      <Button label="Corregir un dato" icon="editar" variant="secondary" onPress={() => router.replace('/(app)/privacidad')} />
    </Screen>
  );
}
