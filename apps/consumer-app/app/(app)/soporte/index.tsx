/**
 * Soporte: buscar primero, preguntar despues.
 *
 * ## Por que el buscador va antes que el boton de hablar
 *
 * Porque la mayoria de las dudas ya estan contestadas, y encontrar la respuesta en diez segundos es
 * mejor experiencia que una conversacion de diez minutos, para la persona y para el equipo. Poner
 * el chat primero convierte cada duda repetida en trabajo humano.
 *
 * Pero el boton de hablar SIEMPRE esta visible: esconderlo detras de «¿seguro que no te sirve
 * ninguna de estas respuestas?» es el patron que hace que la gente termine escribiendo por redes
 * sociales, donde nada queda registrado.
 *
 * ## Por que los casos se ven aqui y no en el perfil
 *
 * Porque un caso abierto es algo que la persona esta esperando. Enterrarlo en un menu obliga a
 * recordar donde estaba; aqui es lo primero que ve quien vuelve.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import * as supportApi from '../../../src/api/endpoints/support';
import { Field } from '../../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { Accordion, AtlasText, Badge, Button, Card, CardHeader, Divider, EmptyState, ListRow, SectionHeader, Skeleton } from '../../../src/ui/primitives';
import { space } from '../../../src/theme/tokens';

export default function Soporte() {
  const router = useRouter();
  const [faq, setFaq] = useState<supportApi.FaqArticle[]>([]);
  const [casos, setCasos] = useState<supportApi.SupportCase[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<supportApi.KnowledgeHit[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([supportApi.getFaq(), supportApi.listCases()])
      .then(([ayuda, mios]) => {
        if (cancelado) return;
        setFaq(ayuda.faq);
        setCasos(mios.cases);
      })
      .catch(() => {
        if (!cancelado) setError('No pudimos cargar la ayuda. Puedes escribirnos igual.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Busca al dejar de escribir, no en cada tecla.
   *
   * Una consulta por pulsacion serian ocho llamadas para «no me llega», y la respuesta de la
   * primera puede pintarse despues de la ultima: el usuario veria resultados de lo que escribio
   * hace tres letras.
   */
  const buscar = useCallback(async (texto: string) => {
    if (texto.trim().length < 3) {
      setResultados(null);
      return;
    }
    try {
      const encontrado = await supportApi.searchKnowledge(texto.trim());
      setResultados(encontrado.results);
    } catch {
      setResultados([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void buscar(busqueda), 400);
    return () => clearTimeout(timer);
  }, [busqueda, buscar]);

  /**
   * Abrir la conversacion.
   *
   * Si ya hay una viva, el servidor devuelve esa misma: pulsar dos veces no crea dos chats ni deja
   * al agente viendo a la misma persona duplicada.
   */
  const hablarConSoporte = async () => {
    setAbriendo(true);
    try {
      const canal = await supportApi.openChannel({});
      router.push(`/(app)/soporte/${canal.channelId}` as never);
    } catch {
      setError('No pudimos abrir la conversación. Inténtalo de nuevo.');
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Soporte" subtitle="Busca tu respuesta o habla con nosotros." onBack="auto" />

      <Card>
        <CardHeader icon="ayuda" title="¿Con qué te ayudamos?" detail="Escribe tu duda en tus palabras." divider={false} />
        <Field label="Buscar en la ayuda" value={busqueda} onChangeText={setBusqueda} placeholder="Ej.: no me llega el código" />
        <Button label="Hablar con soporte" onPress={() => void hablarConSoporte()} loading={abriendo} />
      </Card>

      {error ? (
        <AtlasText variant="caption" tone="danger">
          {error}
        </AtlasText>
      ) : null}

      {resultados !== null ? (
        <>
          <SectionHeader title="Resultados" detail={resultados.length === 0 ? 'Nada por aquí. Escríbenos y lo vemos.' : undefined} />
          {resultados.map((hit) => (
            <Card key={hit.articleId}>
              <AtlasText variant="body">{hit.question ?? hit.title}</AtlasText>
              {hit.shortAnswer ? (
                <AtlasText variant="caption" tone="secondary">
                  {hit.shortAnswer}
                </AtlasText>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {casos.length > 0 ? (
        <>
          <SectionHeader title="Mis casos" detail="Lo que ya nos contaste." />
          <Card padding="none">
            {casos.map((caso, index) => (
              <View key={caso.caseId}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  title={caso.title}
                  subtitle={`${caso.caseNumber} · ${caso.status}`}
                  icon="ayuda"
                  onPress={() => router.push(`/(app)/soporte/caso/${caso.caseId}` as never)}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {cargando ? (
        <Card>
          <Skeleton height={22} width="70%" />
          <Skeleton height={22} width="50%" />
        </Card>
      ) : null}

      {faq.length > 0 && resultados === null ? (
        <>
          <SectionHeader title="Preguntas frecuentes" detail="Lo que más nos preguntan." />
          <Card>
            {faq.map((articulo, index) => (
              <View key={articulo.articleId}>
                {index > 0 ? <Divider /> : null}
                <Accordion title={articulo.question ?? articulo.title}>
                  {articulo.shortAnswer ? <AtlasText variant="body">{articulo.shortAnswer}</AtlasText> : null}
                  <Gap size="xs" />
                  <AtlasText variant="caption" tone="secondary">
                    {articulo.body}
                  </AtlasText>
                  {/*
                    Cuando escalar va aparte y destacado: un articulo que no dice donde termina su
                    utilidad deja a la persona insistiendo con una guia que ya no aplica a su caso.
                  */}
                  {articulo.escalateWhen ? (
                    <View style={{ marginTop: space.sm }}>
                      <Badge label="Cuándo escribirnos" tone="info" />
                      <AtlasText variant="caption" tone="secondary">
                        {articulo.escalateWhen}
                      </AtlasText>
                    </View>
                  ) : null}
                </Accordion>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {!cargando && faq.length === 0 && casos.length === 0 && resultados === null ? (
        <EmptyState
          icon="ayuda"
          title="Aún no hay artículos"
          detail="Puedes escribirnos igual: el botón de arriba abre una conversación con una persona."
        />
      ) : null}

      <Gap size="lg" />
    </Screen>
  );
}
