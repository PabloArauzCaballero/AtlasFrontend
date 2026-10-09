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
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as contentApi from '../../src/api/endpoints/app-content';
import { ContentActionButton, ContentBullets } from '../../src/ui/content';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { Markdown } from '../../src/ui/markdown';
import { Accordion, AtlasText, Button, Card, CardHeader, EmptyState, IconChip, SectionHeader, Skeleton } from '../../src/ui/primitives';
import { Field } from '../../src/ui/fields';
import { Icon, type IconName } from '../../src/ui/icons';
import { color, radius, space, stroke, marca } from '../../src/theme/tokens';
import { filtrarPreguntas } from '../../src/features/preguntas-frecuentes';
import { urlDeLaGuia } from '../../src/features/guia-pdf';
import { useVerRecorrido } from '../../src/features/ver-recorrido';
import { useTourInicio } from '../../src/features/use-contenido-remoto';

export default function Ayuda() {
  const router = useRouter();
  // El texto del recorrido sale del portal; el de fábrica queda de respaldo (sin red, o sin pieza).
  const pasosTour = useTourInicio();
  const [help, setHelp] = useState<contentApi.ContentEntry[]>([]);
  const [faq, setFaq] = useState<contentApi.ContentEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const preguntas = useMemo(() => filtrarPreguntas(faq, busqueda), [faq, busqueda]);

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

  // Vuelve al Inicio que ya existe y arranca cuando la navegación terminó: ver `features/ver-recorrido.ts`.
  const replayTour = useVerRecorrido(pasosTour);

  /*
    Rediseño (Pablo, 2026-10-08: «la estética se ve pésima en comparación a las demás»). Antes: tres tarjetas con un
    botón cada una y una lista plegada sin jerarquía. Ahora sigue a las demás pantallas: una cabecera de marca con el
    buscador, tres accesos en cuadrícula y cada pregunta en su propia pieza, numerada, que se busca mientras se escribe.
  */
  return (
    <Screen>
      <ScreenHeader title="Ayuda" onBack="auto" />

      <View style={styles.portada}>
        <LinearGradient
          colors={[color.heroWash, color.surface.raised]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <IconChip name="ayuda" size="lg" />
        <AtlasText variant="h2">¿En qué te ayudamos?</AtlasText>
        <AtlasText variant="body" tone="secondary">
          Lo que más nos preguntan, contestado en serio. Busca tu duda o habla con una persona.
        </AtlasText>
        <Field
          label="Buscar una pregunta"
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Ej.: cuota, comprobante, límite"
          ayuda="Escribe una palabra de tu duda y la lista de preguntas se filtra mientras escribes."
        />
      </View>

      <View style={styles.accesos}>
        <Acceso icono="telefono" titulo={`Hablar con ${marca.nombre}`} detalle="Soporte y tus casos" onPress={() => router.push('/(app)/soporte' as never)} />
        <Acceso icono="documento" titulo="Guía en PDF" detalle="Paso a paso" onPress={() => void Linking.openURL(urlDeLaGuia())} />
        <Acceso icono="chispa" titulo="Ver el recorrido" detalle="Otra vez" onPress={replayTour} />
      </View>

      {!ready ? (
        <Card>
          <Skeleton height={23} width="70%" />
          <Skeleton height={1} />
          <Skeleton height={23} width="55%" />
          <Skeleton height={1} />
          <Skeleton height={23} width="64%" />
        </Card>
      ) : null}

      {help.map((entry) => (
        <Card key={entry.contentKey}>
          <CardHeader
            icon="telefono"
            title={entry.title ?? `Hablar con ${marca.nombre}`}
            detail={entry.subtitle ?? undefined}
            divider={false}
          />
          <ContentActionButton action={entry.action} onScreen={openScreen} onTour={replayTour} />
        </Card>
      ))}

      {faq.length > 0 ? (
        <>
          <SectionHeader
            title="Preguntas frecuentes"
            detail={busqueda ? `${preguntas.length} ${preguntas.length === 1 ? 'resultado' : 'resultados'} para «${busqueda}»` : 'Toca una para ver la respuesta.'}
          />
          {preguntas.length === 0 ? (
            <EmptyState icon="ayuda" title="No encontramos esa pregunta" detail={`Prueba con otra palabra o escríbenos desde «Hablar con ${marca.nombre}».`} />
          ) : null}
          {/*
            Una pregunta sin titulo no se pinta (`filtrarPreguntas`): el contenido lo edita una persona desde el portal y
            un desplegable sin encabezado sería una flecha suelta que abre un párrafo.
          */}
          {preguntas.map((entry, index) => (
            <View key={entry.contentKey} style={styles.pregunta} testID={`faq-${entry.contentKey}`}>
              <View style={styles.numero}>
                <AtlasText variant="captionStrong" tone="brand">
                  {String(index + 1).padStart(2, '0')}
                </AtlasText>
              </View>
              <View style={styles.cuerpo}>
                <Accordion title={entry.title ?? ''}>
                  {entry.body ? <Markdown variant="body">{entry.body}</Markdown> : null}
                  {entry.bullets.length > 0 ? <ContentBullets bullets={entry.bullets} /> : null}
                  {entry.action ? <ContentActionButton action={entry.action} onScreen={openScreen} onTour={replayTour} /> : null}
                </Accordion>
              </View>
            </View>
          ))}
          <Card tone="brand">
            <CardHeader icon="chat" title="¿No encontraste tu respuesta?" detail={`Una persona de ${marca.nombre} te contesta desde Soporte.`} divider={false} />
            <Button label="Escribir a soporte" icon="chat" onPress={() => router.push('/(app)/soporte' as never)} />
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

function Acceso({ icono, titulo, detalle, onPress }: { icono: IconName; titulo: string; detalle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={titulo} onPress={onPress} style={({ pressed }) => [styles.acceso, pressed && styles.accesoPulsado]}>
      <IconChip name={icono} />
      <AtlasText variant="captionStrong">{titulo}</AtlasText>
      <AtlasText variant="micro" tone="secondary">
        {detalle}
      </AtlasText>
      <Icon name="adelante" size={14} tint={color.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  portada: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: stroke.hairline,
    borderColor: color.feedbackBorder.brand,
  },
  accesos: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  acceso: {
    flex: 1,
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: stroke.hairline,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
  },
  accesoPulsado: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  pregunta: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    marginBottom: space.sm,
    borderRadius: radius.xl,
    borderWidth: stroke.hairline,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
  },
  numero: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.feedbackSoft.success,
  },
  cuerpo: { flex: 1 },
});
