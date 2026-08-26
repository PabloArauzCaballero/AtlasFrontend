/**
 * Envio a revision y estado de la solicitud.
 *
 * Es el unico punto del flujo donde el servidor valida completitud. Si algo falta, responde
 * `ONBOARDING_INCOMPLETE` con las secciones pendientes: la pantalla las muestra en vez de repetir
 * un mensaje generico.
 *
 * Despues del envio el estado es `under_review`, y eso es lo que se comunica: ni "aprobado" ni
 * "listo". Prometer una aprobacion que no ocurrio es el peor final posible para un onboarding.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { View, type ScrollView } from 'react-native';
import { useCallback, useState, useRef } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { AtlasApiError, describeError } from '../../src/api/errors';
import { SECTION_LABEL, SECTION_ROUTE, describeBlocker, describeLifecycle } from '../../src/features/onboarding-map';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { Gap, Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, CardHeader, Divider, ErrorState, ListRow } from '../../src/ui/primitives';
import { useBrandCut } from '../../src/ui/brand-cut';

export default function Review() {
  const router = useRouter();
  const session = useSession();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Envio confirmado por ESTA pantalla, con independencia de lo que diga el estado remoto.
   *
   * El 200 de `submitForReview` ya es la confirmacion: la solicitud esta registrada. Depender del
   * `refresh()` posterior para enterarse hacia que un refresco fallido —el limitador de peticiones
   * devuelve 429 justo despues del envio, porque la pantalla ya venia consultando el estado—
   * dejara la pantalla en su estado previo, con el boton de enviar todavia ahi. El cliente volvia a
   * pulsarlo y recibia `ONBOARDING_ALREADY_SUBMITTED` como si hubiera hecho algo mal.
   */
  const [justSubmitted, setJustSubmitted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void session.refresh();
    }, [session]),
  );

  const cortar = useBrandCut();

  const status = session.onboarding;
  const submitted =
    justSubmitted || status?.onboarding.completionStatus === 'completed' || status?.lifecycleStatus === 'under_review';
  const lifecycle = describeLifecycle(status?.lifecycleStatus ?? 'registered');

  const submit = async () => {
    if (!session.customerId) return;
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.submitForReview(session.customerId);
      /*
        El mismo corte de marca que abre la app, ahora para cerrarla.

        Terminar el alta es el segundo momento del producto que merece marcarse: la pantalla apenas
        cambiaba —el mismo fondo, otro texto— y ocho pasos de formulario terminaban sin que nada
        dijera «esto ya está». El corte tapa el cambio de estado y lo devuelve convertido en un
        hecho, con la misma gramática con la que se entró.

        Va DESPUÉS del 200 y no antes: celebrar un envío que todavía puede fallar es peor que no
        celebrarlo. Y `useBrandCut` respeta el ajuste de movimiento reducido —con él activo ejecuta
        la acción sin animar—, así que esto no le tapa la pantalla a quien pidió que no se la tapen.
      */
      cortar(() => setJustSubmitted(true));
      // El refresco es para enriquecer la pantalla, no para saber si el envio ocurrio. Si falla
      // —incluido el 429 del limitador— la solicitud sigue enviada y la pantalla ya lo refleja.
      await session.refresh().catch(() => undefined);
    } catch (caught) {
      // Que ya estuviera enviada no es un fallo del cliente: es exactamente lo que queria lograr.
      // Mostrarlo como error le dice que revise unos datos que estan bien y que ya no puede tocar.
      if (caught instanceof AtlasApiError && caught.code === 'ONBOARDING_ALREADY_SUBMITTED') {
        setJustSubmitted(true);
        await session.refresh().catch(() => undefined);
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await session.refresh();
    setRefreshing(false);
  };

  const described = error ? describeError(error) : null;

  // El fallo se pinta arriba y el boton esta abajo: hay que llevar la vista hasta el.

  const scroll = useRef<ScrollView>(null);

  useScrollToError(error, scroll);
  const pending = (status?.sections ?? []).filter((section) => section.status !== 'completed');

  /*
    Aquí el motivo no lo decide la pantalla sino el servidor, que es el único que valida completitud.
    Se nombra la primera seccion pendiente —la misma que aparece en la lista de abajo, tocable— para
    que el aviso y la lista digan lo mismo y no haya que elegir a cual creerle.
  */
  const firstPending = pending[0];
  const blockedReason = firstBlocker([
    [Boolean(status), 'Estamos consultando el estado de tu solicitud.'],
    [
      status?.canSubmit ?? false,
      firstPending
        ? `Falta completar ${(SECTION_LABEL[firstPending.code]?.title ?? firstPending.code).toLowerCase()}.`
        : 'Todavía falta completar una parte de tu expediente.',
    ],
  ]);

  return (
    <Screen scrollRef={scroll}
      onRefresh={onRefresh}
      refreshing={refreshing}
      footer={
        submitted ? (
          <Button label="Actualizar estado" variant="secondary" onPress={onRefresh} loading={refreshing} />
        ) : (
          <Button
            label="Enviar mi solicitud"
            onPress={submit}
            loading={busy}
            disabled={busy || !(status?.canSubmit ?? false)}
            blockedReason={blockedReason}
            haptic="success"
          />
        )
      }
    >
      <ScreenHeader
        eyebrow="Último paso"
        title={submitted ? lifecycle.title : 'Revisa y envía'}
        subtitle={lifecycle.detail}
        onBack="auto"
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {pending.length > 0 ? (
        <Card tone="warning" padding="tight">
          <CardHeader
            icon="alerta"
            iconTone="warning"
            title="Todavía falta"
            detail={pending.length === 1 ? '1 paso por completar' : `${pending.length} pasos por completar`}
          />
          {pending.map((section, index) => (
            <View key={section.code}>
              {index > 0 ? <Divider inset /> : null}
              <ListRow
                title={SECTION_LABEL[section.code]?.title ?? section.code}
                subtitle={SECTION_LABEL[section.code]?.detail}
                icon={SECTION_LABEL[section.code]?.icon}
                right={<Badge dot label="pendiente" tone="warning" />}
                onPress={() => router.push(SECTION_ROUTE[section.code])}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {status && status.blockers.length > 0 ? (
        <Card padding="tight">
          <CardHeader icon="escudo" title="Estado de tu evaluación" />
          {status.blockers.map((blocker, index) => {
            const copy = describeBlocker(blocker);
            return (
              <View key={blocker.code}>
                {index > 0 ? <Divider inset /> : null}
                <ListRow
                  icon={copy.actionable ? 'alerta' : 'reloj'}
                  title={copy.title}
                  subtitle={copy.detail}
                  right={
                    <Badge dot label={copy.actionable ? 'acción tuya' : 'en curso'} tone={copy.actionable ? 'warning' : 'info'} />
                  }
                />
              </View>
            );
          })}
        </Card>
      ) : null}

      {submitted ? (
        <Card tone="brand">
          <CardHeader
            icon="reloj"
            title="Qué sigue"
            detail="Un analista revisa tu documento y tu información. Te avisamos por notificación apenas haya respuesta; no hace falta que dejes la app abierta."
            divider={false}
          />
        </Card>
      ) : null}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Al enviar confirmas que la información declarada es correcta.
      </AtlasText>
    </Screen>
  );
}
