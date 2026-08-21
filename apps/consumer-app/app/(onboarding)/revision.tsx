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
import { useCallback, useState } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { AtlasApiError, describeError } from '../../src/api/errors';
import { SECTION_LABEL, SECTION_ROUTE, describeBlocker, describeLifecycle } from '../../src/features/onboarding-map';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ErrorState, ListRow } from '../../src/ui/primitives';

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
      setJustSubmitted(true);
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
    <Screen
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
      <ScreenHeader title={submitted ? lifecycle.title : 'Revisa y envia'} subtitle={lifecycle.detail} onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {pending.length > 0 ? (
        <Card>
          <AtlasText variant="h3">Todavía falta</AtlasText>
          <Divider />
          {pending.map((section) => (
            <ListRow
              key={section.code}
              title={SECTION_LABEL[section.code]?.title ?? section.code}
              subtitle={SECTION_LABEL[section.code]?.detail}
              right={<Badge label="pendiente" tone="warning" />}
              onPress={() => router.push(SECTION_ROUTE[section.code])}
            />
          ))}
        </Card>
      ) : null}

      {status && status.blockers.length > 0 ? (
        <Card>
          <AtlasText variant="h3">Estado de tu evaluación</AtlasText>
          <Divider />
          {status.blockers.map((blocker) => {
            const copy = describeBlocker(blocker);
            return (
              <ListRow
                key={blocker.code}
                title={copy.title}
                subtitle={copy.detail}
                right={<Badge label={copy.actionable ? 'accion tuya' : 'en curso'} tone={copy.actionable ? 'warning' : 'info'} />}
              />
            );
          })}
        </Card>
      ) : null}

      {submitted ? (
        <Card>
          <AtlasText variant="bodyStrong">Que sigue</AtlasText>
          <AtlasText variant="body" tone="secondary">
            Un analista revisa tu documento y tu informacion. Te avisamos por notificacion apenas haya respuesta; no hace
            falta que dejes la app abierta.
          </AtlasText>
        </Card>
      ) : null}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Al enviar confirmas que la información declarada es correcta.
      </AtlasText>
    </Screen>
  );
}
