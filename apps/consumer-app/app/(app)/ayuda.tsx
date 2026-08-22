/**
 * Ayuda y preguntas frecuentes.
 *
 * ## Por que es una pantalla y no dos filas en el perfil
 *
 * Porque lo era. En el perfil habia dos filas —«¿Como funciona Atlas?» y «¿Donde pago mis cuotas?»—
 * con la respuesta metida en el subtitulo, a diez palabras cada una. Eso no responde nada: es un
 * titular. Las preguntas que la gente se hace de verdad («¿como deciden cuanto me prestan?», «¿que
 * pasa si me atraso?») no caben en una linea, y contestarlas a medias es peor que no contestarlas,
 * porque cierra la pregunta sin resolverla.
 *
 * ## Por que el contenido viene del servidor
 *
 * Porque una respuesta que confunde a la gente hay que poder reescribirla hoy, no en la proxima
 * version de la app. Y porque estas respuestas hablan de credito: la version que lee cada persona no
 * puede depender de cuando actualizo.
 *
 * ## Por que WhatsApp esta arriba y no al final
 *
 * Quien abre esta pantalla ya tiene un problema. Obligarle a leer seis respuestas antes de encontrar
 * como hablar con alguien es hacerle pagar por nuestra organizacion del contenido.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as contentApi from '../../src/api/endpoints/app-content';
import { ContentActionButton, ContentBullets } from '../../src/ui/content';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Card, Divider, Skeleton } from '../../src/ui/primitives';
import { resetTour, useTour } from '../../src/ui/tour';
import { TOUR_INICIO_KEY, TOUR_INICIO_STEPS } from '../../src/features/tour-inicio';

export default function Ayuda() {
  const router = useRouter();
  const tour = useTour();
  const [help, setHelp] = useState<contentApi.ContentEntry[]>([]);
  const [faq, setFaq] = useState<contentApi.ContentEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([contentApi.getContent('help'), contentApi.getContent('faq')])
      .then(([helpEntries, faqEntries]) => {
        if (cancelled) return;
        setHelp(helpEntries);
        setFaq(faqEntries);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openScreen = (path: string) => router.push(path as never);

  const replayTour = () => {
    // Se olvida que ya se vio ANTES de lanzarlo para que al cerrarlo vuelva a marcarse: si no, el
    // estado quedaria en «visto» y el boton no tendria nada que restablecer la vez siguiente.
    void resetTour(TOUR_INICIO_KEY).then(() => {
      router.push('/(app)/(tabs)');
      tour.start(TOUR_INICIO_STEPS, TOUR_INICIO_KEY);
    });
  };

  return (
    <Screen>
      <ScreenHeader
        title="Ayuda y preguntas frecuentes"
        subtitle="Lo que más nos preguntan, contestado en serio."
        onBack="auto"
      />

      {!ready ? (
        <Card>
          <Skeleton height={18} width="70%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
        </Card>
      ) : null}

      {help.map((entry) => (
        <Card key={entry.contentKey}>
          <AtlasText variant="h3">{entry.title}</AtlasText>
          {entry.subtitle ? (
            <AtlasText variant="body" tone="secondary">
              {entry.subtitle}
            </AtlasText>
          ) : null}
          <Gap size="xs" />
          <ContentActionButton action={entry.action} onScreen={openScreen} onTour={replayTour} />
        </Card>
      ))}

      {faq.length > 0 ? (
        <>
          <Gap size="sm" />
          <AtlasText variant="caption" tone="tertiary">
            PREGUNTAS FRECUENTES
          </AtlasText>
        </>
      ) : null}

      {faq.map((entry) => (
        <Card key={entry.contentKey}>
          {/*
            La pregunta a tamano de titulo y la respuesta a tamano de lectura. Al reves —que es como
            estaba, pregunta y respuesta con el mismo peso— obliga a leer las seis para encontrar la
            tuya.
          */}
          <AtlasText variant="h3">{entry.title}</AtlasText>

          {entry.body ? (
            <>
              <Gap size="xxs" />
              <AtlasText variant="body" tone="secondary">
                {entry.body}
              </AtlasText>
            </>
          ) : null}

          {entry.bullets.length > 0 ? (
            <>
              <Divider />
              <ContentBullets bullets={entry.bullets} />
            </>
          ) : null}

          {entry.action ? (
            <>
              <Gap size="xs" />
              <ContentActionButton action={entry.action} onScreen={openScreen} onTour={replayTour} />
            </>
          ) : null}
        </Card>
      ))}

      {ready && help.length === 0 && faq.length === 0 ? (
        <Card>
          <AtlasText variant="h3">No pudimos cargar la ayuda</AtlasText>
          <AtlasText variant="body" tone="secondary">
            Vuelve a intentarlo en un momento. Si necesitas hablar con alguien ahora, escríbenos por WhatsApp desde tu perfil.
          </AtlasText>
        </Card>
      ) : null}

      <Gap size="lg" />
    </Screen>
  );
}

