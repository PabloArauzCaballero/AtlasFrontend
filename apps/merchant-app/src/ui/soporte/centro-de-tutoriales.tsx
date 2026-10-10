/**
 * La pestaña «Tutoriales» de Soporte: el `TutorialCenter audience="merchant" embedded` de la web,
 * con lo que en un teléfono se puede hacer.
 *
 * Arriba, la guía en PDF (la misma de la web, descargada de su sitio y entregada por la hoja de
 * compartir). Después, el recorrido del comercio LEÍDO paso a paso en vez de recorrido sobre la
 * pantalla (ver `features/soporte/tutoriales.ts` por qué). Al final, las guías «¿Qué es esto?» de
 * cada pantalla del portal, plegadas: quien entra aquí trae UNA pregunta, no seis.
 */
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { Accordion, AtlasText, Badge, Button, Card, CardHeader, Divider, SectionHeader } from '@cliente/ui/primitives';
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
      <Card testID="guia-pdf">
        <CardHeader title={GUIA_PDF.titulo} detail={GUIA_PDF.detalle} icon="documento" divider={false} />
        <Button label="Descargar la guía en PDF" icon="descargar" variant="secondary" loading={bajando} onPress={() => void bajar()} />
      </Card>

      <Card testID={`tutorial-${tutorial.id}`}>
        <View style={styles.etiquetas}>
          <Badge label={tutorial.categoria} />
          {tutorial.esencial ? <Badge label="Esencial" tone="success" /> : null}
        </View>
        <CardHeader title={tutorial.title} detail={tutorial.intro} icon="educacion" />
        <AtlasText variant="caption" tone="tertiary">{`${tutorial.minutos} min · ${tutorial.steps.length} pasos · ${tutorial.nivel}`}</AtlasText>
        {tutorial.steps.map((paso, indice) => (
          <View key={paso.id} style={styles.paso}>
            {indice > 0 ? <Divider /> : null}
            <AtlasText variant="micro" tone="tertiary">{`PASO ${indice + 1} DE ${tutorial.steps.length}`}</AtlasText>
            <AtlasText variant="title">{paso.title}</AtlasText>
            <AtlasText variant="body" tone="secondary">
              {paso.content}
            </AtlasText>
            {paso.tip ? <Apunte texto={paso.tip} /> : null}
          </View>
        ))}
      </Card>

      <SectionHeader title="Guías de cada pantalla" detail="Qué es cada sección, qué puedes hacer y a quién avisar si algo no sale como esperabas." />
      {guiasDelComercio().map(({ ruta, guia }) => (
        <Card key={ruta} padding="tight" testID={`guia-${ruta.split('/').pop()}`}>
          <Accordion title={guia.title}>
            <Guia guia={guia} />
          </Accordion>
        </Card>
      ))}
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
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingBottom: space.sm },
  paso: { gap: space.xs, paddingTop: space.sm },
  guia: { gap: space.md, paddingTop: space.sm },
  seccion: { gap: space.xs },
});
