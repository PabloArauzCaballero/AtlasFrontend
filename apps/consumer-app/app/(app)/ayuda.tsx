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
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import * as contentApi from '../../src/api/endpoints/app-content';
import { ContentActionButton, ContentBullets } from '../../src/ui/content';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { Markdown } from '../../src/ui/markdown';
import { Accordion, AtlasText, Button, Card, CardHeader, Divider, EmptyState, SectionHeader, Skeleton } from '../../src/ui/primitives';
import { resetTour, useTour } from '../../src/ui/tour';
import { TOUR_INICIO_KEY } from '../../src/features/tour-inicio';
import { useCopy, useTourInicio } from '../../src/features/use-contenido-remoto';

export default function Ayuda() {
  const t = useCopy();
  const router = useRouter();
  const tour = useTour();
  // El texto del recorrido sale del portal; el de fábrica queda de respaldo (sin red, o sin pieza).
  const pasosTour = useTourInicio();
  const pasosTourRef = useRef(pasosTour);
  pasosTourRef.current = pasosTour;
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
      tour.start(pasosTourRef.current, TOUR_INICIO_KEY);
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
          <Skeleton height={23} width="70%" />
          <Skeleton height={1} />
          <Skeleton height={23} width="55%" />
          <Skeleton height={1} />
          <Skeleton height={23} width="64%" />
        </Card>
      ) : null}

      {/*
        Hablar con una persona, arriba del todo.

        Quien abre esta pantalla ya tiene un problema; obligarle a leer seis respuestas antes de
        encontrar como hablar con alguien es hacerle pagar por nuestra organizacion del contenido.
        Lleva al centro de soporte, donde ademas puede buscar y ver sus casos abiertos.
      */}
      <Card>
        <CardHeader icon="ayuda" title={t.titulo('ayuda.hablar')} detail={t.texto('ayuda.hablar')} divider={false} />
        <Button label="Ir a soporte" icon="telefono" onPress={() => router.push('/(app)/soporte' as never)} />
      </Card>

      {help.map((entry) => (
        <Card key={entry.contentKey}>
          <CardHeader
            icon="telefono"
            title={entry.title ?? 'Hablar con Atlas'}
            detail={entry.subtitle ?? undefined}
            divider={false}
          />
          <ContentActionButton action={entry.action} onScreen={openScreen} onTour={replayTour} />
        </Card>
      ))}

      {faq.length > 0 ? (
        <>
          <SectionHeader title="Preguntas frecuentes" detail="Toca una para ver la respuesta." />
          {/*
            Las seis preguntas viven en UNA tarjeta, plegadas, y no en seis tarjetas abiertas.

            Seis tarjetas con seis respuestas completas convierten la ayuda en un documento que hay
            que recorrer entero; una sola lista de preguntas es un indice, que es lo que alguien con
            una duda concreta necesita. La tarjeta ademas las agrupa: dice que las seis son la misma
            clase de cosa.
          */}
          <Card>
            {/*
              Una pregunta sin titulo no se pinta. El contenido lo edita una persona desde el portal
              y el titulo puede llegar vacio; un desplegable sin encabezado seria una flecha suelta
              que abre un parrafo, y nadie sabria que estaba abriendo.
            */}
            {faq.filter((entry) => Boolean(entry.title)).map((entry, index) => (
              <View key={entry.contentKey}>
                {index > 0 ? <Divider /> : null}
                <Accordion title={entry.title ?? ''}>
                  {entry.body ? <Markdown variant="body">{entry.body}</Markdown> : null}

                  {entry.bullets.length > 0 ? <ContentBullets bullets={entry.bullets} /> : null}

                  {entry.action ? (
                    <ContentActionButton action={entry.action} onScreen={openScreen} onTour={replayTour} />
                  ) : null}
                </Accordion>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {ready && help.length === 0 && faq.length === 0 ? (
        <EmptyState
          icon="ayuda"
          title="No pudimos cargar la ayuda"
          detail="Vuelve a intentarlo en un momento. Si necesitas hablar con alguien ahora, abre una conversación desde Soporte."
        />
      ) : null}

      <Gap size="lg" />
    </Screen>
  );
}

