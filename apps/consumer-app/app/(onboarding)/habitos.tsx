/**
 * Tus habitos: la fase 4 del alta, una pregunta por pantalla.
 *
 * ## Que se pregunta y por que asi
 *
 * Seis preguntas de SITUACION —gasto fijo, dependientes, ahorro, imprevisto, cuota maxima,
 * frecuencia— y ninguna de personalidad. «¿Que tan cierto es que priorizo pagar?» se contesta
 * «totalmente» cuando de la respuesta depende un credito, y no separa a nadie. Una pregunta de
 * situacion tiene una respuesta contrastable con el ingreso declarado, con el extracto y con los
 * dependientes del perfil economico: lo que puntua despues es la CONSISTENCIA, no la respuesta.
 *
 * ## Lo que se mide sin preguntar
 *
 * Cuanto tarda cada respuesta desde que la pregunta aparece. Menos de segundo y medio es no haber
 * leido, y eso viaja al servidor como `answeredInMs`; no se rechaza la respuesta, se anota.
 *
 * ## El catalogo lo manda el servidor
 *
 * Las preguntas, sus opciones y la version (`habitos-v1`) salen de
 * `GET /customer-onboarding/consumer-survey/catalog`. Cambiar una pregunta no exige publicar la app,
 * y el servidor valida cada respuesta contra la misma version que la pinto.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { bitacora } from '../../src/features/bitacora';
import { useSession } from '../../src/session/session';
import { space } from '../../src/theme/tokens';
import { IconField } from '../../src/ui/form-controls';
import { Gap, Screen, useScrollToError } from '../../src/ui/layout';
import { AtlasText, Button, Card, ErrorState, ProgressBar, Skeleton } from '../../src/ui/primitives';
import { StepHeader } from '../../src/ui/step-header';
import type { ScrollView } from 'react-native';

type Respuesta = { answerCode?: string; answerValue?: number };

export default function Habitos() {
  const router = useRouter();
  const session = useSession();
  const customerId = session.customerId;

  const [catalogo, setCatalogo] = useState<onboardingApi.CatalogoDeHabitos | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({});
  const [indice, setIndice] = useState(0);
  const [monto, setMonto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [cargaFallida, setCargaFallida] = useState<unknown>(null);
  /* Cuando aparecio la pregunta actual. Es de donde sale `answeredInMs`. */
  const mostradaEn = useRef<number>(Date.now());

  const cargar = useCallback(async () => {
    if (!customerId) return;
    setCargaFallida(null);
    try {
      const [cat, estado] = await Promise.all([onboardingApi.getConsumerSurveyCatalog(), onboardingApi.getConsumerSurvey(customerId)]);
      setCatalogo(cat);
      const previas: Record<string, Respuesta> = {};
      for (const r of estado.answered) previas[r.questionCode] = { answerCode: r.answerCode ?? undefined, answerValue: r.answerValue ?? undefined };
      setRespuestas(previas);
      // Se retoma en la primera pregunta sin contestar; si estan todas, en la ultima para revisar.
      const primeraSinContestar = cat.questions.findIndex((q) => !previas[q.code]);
      setIndice(primeraSinContestar === -1 ? Math.max(0, cat.questions.length - 1) : primeraSinContestar);
      mostradaEn.current = Date.now();
    } catch (caught) {
      setCargaFallida(caught);
    }
  }, [customerId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const preguntas = catalogo?.questions ?? [];
  const pregunta = preguntas[indice] ?? null;
  const total = preguntas.length;
  const contestadas = preguntas.filter((q) => respuestas[q.code]).length;

  useEffect(() => {
    mostradaEn.current = Date.now();
    if (pregunta?.type === 'monto') {
      const previa = respuestas[pregunta.code]?.answerValue;
      setMonto(previa === undefined ? '' : String(previa));
    }
    // Solo cuando cambia la pregunta: las respuestas cambian al contestar y no deben reiniciar el reloj.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta?.code]);

  /**
   * Guarda UNA respuesta y avanza. Cada pregunta se guarda al contestarla y no al final: quien cierra
   * la app en la cuarta no vuelve a la primera, y el servidor ya sabe cuanto tardo cada una.
   */
  const contestar = async (respuesta: Respuesta) => {
    if (!customerId || !catalogo || !pregunta || busy) return;
    setBusy(true);
    setError(null);
    const answeredInMs = Math.max(0, Date.now() - mostradaEn.current);
    try {
      await bitacora.medirEnvio(() =>
        onboardingApi.saveConsumerSurvey(customerId, {
          surveyVersion: catalogo.surveyVersion,
          answers: [{ questionCode: pregunta.code, ...respuesta, answeredInMs }],
        }),
      );
      const siguientes = { ...respuestas, [pregunta.code]: respuesta };
      setRespuestas(siguientes);
      bitacora.campoCompleto('habito_respuesta');
      const faltaAlguna = preguntas.findIndex((q, i) => i > indice && !siguientes[q.code]);
      if (indice < total - 1) {
        setIndice(faltaAlguna === -1 ? indice + 1 : faltaAlguna);
      } else {
        await session.refresh();
        router.replace('/(onboarding)/progreso');
      }
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const montoNumero = Number(monto.replace(/[^\d.]/g, ''));
  const montoValido =
    pregunta?.type === 'monto' && monto.trim() !== '' && Number.isFinite(montoNumero) && montoNumero >= (pregunta.min ?? 0) && montoNumero <= (pregunta.max ?? Number.MAX_SAFE_INTEGER);

  const described = error ? describeError(error) : null;
  const describedCarga = cargaFallida ? describeError(cargaFallida) : null;
  const scroll = useRef<ScrollView>(null);
  useScrollToError(error, scroll);

  return (
    <Screen
      scrollRef={scroll}
      footer={
        pregunta?.type === 'monto' ? (
          <View style={styles.pie}>
            <Button
              label={indice === total - 1 ? 'Terminar' : 'Siguiente'}
              bitacora="siguiente"
              onPress={() => void contestar({ answerValue: montoNumero })}
              loading={busy}
              disabled={!montoValido || busy}
              blockedReason={montoValido ? null : `Escribe un monto entre ${pregunta.min ?? 0} y ${pregunta.max ?? '…'} Bs.`}
            />
            {indice > 0 ? <Button label="Anterior" bitacora="atras" variant="ghost" onPress={() => setIndice(indice - 1)} disabled={busy} /> : null}
          </View>
        ) : indice > 0 && pregunta ? (
          <Button label="Anterior" bitacora="atras" variant="ghost" onPress={() => setIndice(indice - 1)} disabled={busy} />
        ) : undefined
      }
    >
      <StepHeader code="consumer_survey" title="Tus hábitos" subtitle="Seis preguntas cortas. No hay respuestas buenas ni malas: lo que importa es que sean tuyas." />

      {describedCarga ? (
        <ErrorState title={describedCarga.title} detail={describedCarga.detail} reference={describedCarga.reference} onRetry={() => void cargar()} />
      ) : null}
      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {!catalogo && !describedCarga ? (
        <Card>
          <Skeleton height={23} width="80%" />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </Card>
      ) : null}

      {catalogo && pregunta ? (
        <>
          <ProgressBar value={total === 0 ? 0 : contestadas / total} label={`${contestadas} de ${total} completadas`} />
          <Gap size="sm" />
          <AtlasText variant="h3">{pregunta.prompt}</AtlasText>
          <Gap size="sm" />

          {pregunta.type === 'opcion' ? (
            <View style={styles.opciones}>
              {(pregunta.options ?? []).map((opcion) => {
                const elegida = respuestas[pregunta.code]?.answerCode === opcion.code;
                return (
                  <Button
                    key={opcion.code}
                    label={opcion.label}
                    bitacora="elegir_opcion"
                    variant={elegida ? 'primary' : 'secondary'}
                    onPress={() => contestar({ answerCode: opcion.code })}
                    disabled={busy}
                    accessibilityState={{ selected: elegida }}
                  />
                );
              })}
            </View>
          ) : (
            <IconField
              icon="billetera"
              bitacora="cuota_maxima"
              label="Cuota mensual, en Bs"
              value={monto}
              onChangeText={(next) => setMonto(next.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="350"
              hint={`Entre ${pregunta.min ?? 0} y ${pregunta.max ?? '…'} Bs.`}
              ayuda="La cuota que podrías pagar cada mes sin dejar de cubrir lo que ya pagas. Se compara con tu ingreso declarado: no es un compromiso, es una referencia para no ofrecerte más de lo que puedes."
              required
            />
          )}
        </>
      ) : null}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Tus respuestas no se comparten con los comercios. Se cruzan con lo que declaraste y con tu extracto, si lo subiste.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  opciones: { gap: space.sm },
  pie: { gap: space.sm },
});
