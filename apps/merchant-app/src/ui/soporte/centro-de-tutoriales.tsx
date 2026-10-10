/**
 * La pestaña «Tutoriales» de Soporte: el `TutorialCenter audience="merchant" embedded` de la web,
 * con lo que en un teléfono se puede hacer.
 *
 * Arriba, la guía en PDF (la misma de la web, descargada de su sitio y entregada por la hoja de
 * compartir). Después, el recorrido del comercio LEÍDO paso a paso en vez de recorrido sobre la
 * pantalla (ver `features/soporte/tutoriales.ts` por qué). Al final, las guías «¿Qué es esto?» de
 * cada pantalla del portal, plegadas: quien entra aquí trae UNA pregunta, no seis.
 *
 * Todo es una lista compacta: la guía en PDF es UNA fila, y el recorrido y cada guía son filas
 * plegadas (título y duración) que sólo enseñan su texto al abrirlas.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { color, space } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { Accordion, AtlasText, Card, Divider, ListRow } from '@cliente/ui/primitives';
import { guardarArchivo } from '@/features/pdf';
import type { ScreenGuide } from '@/features/soporte/guias-portal';
import { GUIA_PDF, TUTORIAL_PRIMEROS_PASOS, guiasDelComercio, urlDeLaGuiaPdf } from '@/features/soporte/tutoriales';

/** Baja la guía (archivo público del portal, sin sesión) y abre la hoja de compartir. */
async function descargarGuia(): Promise<void> {
  const respuesta = await fetch(urlDeLaGuiaPdf(), { headers: { Accept: 'application/pdf' } });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  await guardarArchivo(new Uint8Array(await respuesta.arrayBuffer()), GUIA_PDF.archivo);
}

export function CentroDeTutoriales() {
  const [bajando, setBajando] = useState(false);
  const tutorial = TUTORIAL_PRIMEROS_PASOS;

  const bajar = async () => {
    setBajando(true);
    try {
      await descargarGuia();
    } catch {
      Alert.alert('No se pudo descargar la guía', 'Revisa tu conexión y vuelve a intentarlo en un momento.');
    } finally {
      setBajando(false);
    }
  };

  return (
    <View style={styles.columna} testID="tutorial-center">
      <Card padding="tight" testID="guia-pdf">
        <ListRow
          title="Guía en PDF"
          subtitle={GUIA_PDF.titulo}
          icon="documento"
          onPress={() => (bajando ? undefined : void bajar())}
          accessibilityHint="Descarga la guía del portal en PDF"
          right={bajando ? <ActivityIndicator color={color.text.secondary} /> : <Icon name="descargar" size={18} tint={color.text.secondary} />}
        />
      </Card>

      <Card padding="tight">
        <View testID={`tutorial-${tutorial.id}`}>
          <Accordion title={`${tutorial.title} · ${tutorial.minutos} min`}>
            <View style={styles.guia}>
              <AtlasText variant="body" tone="secondary">
                {tutorial.intro}
              </AtlasText>
              {tutorial.steps.map((paso, indice) => (
                <View key={paso.id} style={styles.seccion}>
                  <AtlasText variant="micro" tone="tertiary">{`PASO ${indice + 1} DE ${tutorial.steps.length}`}</AtlasText>
                  <AtlasText variant="title">{paso.title}</AtlasText>
                  <AtlasText variant="body" tone="secondary">
                    {paso.content}
                  </AtlasText>
                  {paso.tip ? <Apunte texto={paso.tip} /> : null}
                </View>
              ))}
            </View>
          </Accordion>
        </View>
        {guiasDelComercio().map(({ ruta, guia }) => (
          <View key={ruta} testID={`guia-${ruta.split('/').pop()}`}>
            <Divider />
            <Accordion title={guia.title}>
              <Guia guia={guia} />
            </Accordion>
          </View>
        ))}
      </Card>
    </View>
  );
}

function Guia({ guia }: { guia: ScreenGuide }) {
  return (
    <View style={styles.guia}>
      <AtlasText variant="body" tone="secondary">
        {guia.intro}
      </AtlasText>
      {guia.sections.map((seccion) => (
        <View key={seccion.title} style={styles.seccion}>
          <AtlasText variant="title">{seccion.title}</AtlasText>
          <AtlasText variant="body" tone="secondary">
            {seccion.body}
          </AtlasText>
          {seccion.tip ? <Apunte texto={seccion.tip} /> : null}
        </View>
      ))}
    </View>
  );
}

/** El aparte destacado de la web (`tip`): la trampa, el atajo o la consecuencia. */
function Apunte({ texto }: { texto: string }) {
  return (
    <Card tone="brand" padding="tight">
      <AtlasText variant="caption">{texto}</AtlasText>
    </Card>
  );
}

const styles = StyleSheet.create({
  columna: { gap: space.base },
  guia: { gap: space.md, paddingTop: space.sm },
  seccion: { gap: space.xs },
});
