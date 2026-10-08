/**
 * «Conoce Atlas»: las pantallas de presentación que se veían antes de entrar, ahora a mano desde Inicio con el botón de
 * la marca (Pablo, 2026-10-08: «un botón que es Atlas y que lleve a las pantallas que teníamos antes»).
 *
 * Los mismos pasos que la bienvenida (`features/bienvenida-pasos.ts`, editables desde el portal), con una puesta en
 * escena mejor: la ilustración mucho más grande, sobre un resplandor de marca con una órbita, y flotando despacio; un
 * número de paso que se lee de lejos y puntos que siguen al dedo. Con movimiento reducido todo queda quieto.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as contentApi from '../../src/api/endpoints/app-content';
import { PASOS_POR_DEFECTO, pasosDesdeContenido, type Paso } from '../../src/features/bienvenida-pasos';
import { color, palette, radius, space } from '../../src/theme/tokens';
import { BrandHalo } from '../../src/ui/brand';
import { Ilustracion } from '../../src/ui/ilustraciones-bienvenida';
import { Screen, ScreenHeader } from '../../src/ui/layout';
import { Appear, Vivo } from '../../src/ui/motion';
import { AtlasText, Button } from '../../src/ui/primitives';

export default function ConoceAtlas() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const ancho = width - space.lg * 2;
  const [pasos, setPasos] = useState<Paso[]>(PASOS_POR_DEFECTO);
  const [pagina, setPagina] = useState(0);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let vivo = true;
    contentApi
      .getContent('onboarding')
      .then((entradas) => {
        const desdePortal = pasosDesdeContenido(entradas);
        if (vivo && desdePortal.length > 0) setPasos(desdePortal);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const alDesplazar = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPagina(Math.round(e.nativeEvent.contentOffset.x / ancho));
  const ultima = pagina >= pasos.length - 1;
  const siguiente = () => (ultima ? router.back() : scroll.current?.scrollTo({ x: (pagina + 1) * ancho, animated: true }));

  return (
    <Screen>
      <ScreenHeader title="Conoce Atlas" onBack="auto" />
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={alDesplazar}
        testID="conoce-atlas-paginas"
      >
        {pasos.map((paso, i) => (
          <View key={paso.clave} style={[styles.pagina, { width: ancho }]} accessibilityLabel={`${paso.titulo}. ${paso.cuerpo}`}>
            <View style={styles.escenario}>
              <LinearGradient colors={[palette.brand700, color.surface.primary]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
              <BrandHalo size={ancho * 1.1} style={styles.halo} />
              <View style={[styles.orbita, { width: ancho * 0.82, height: ancho * 0.82, borderRadius: ancho * 0.41 }]} />
              <Vivo tipo="flota" periodo={3600} retardo={i * 400}>
                <Ilustracion nombre={paso.ilustracion} ancho={Math.min(ancho * 0.86, 340)} decorativa />
              </Vivo>
            </View>
            <Appear index={0}>
              <View style={styles.paso}>
                <AtlasText variant="captionStrong" tone="brand">
                  {`PASO ${i + 1} DE ${pasos.length}`}
                </AtlasText>
              </View>
            </Appear>
            <AtlasText variant="h1">{paso.titulo}</AtlasText>
            <AtlasText variant="body" tone="secondary">
              {paso.cuerpo}
            </AtlasText>
          </View>
        ))}
      </ScrollView>

      <View style={styles.puntos} accessibilityRole="tablist">
        {pasos.map((paso, i) => (
          <View key={paso.clave} style={[styles.punto, i === pagina && styles.puntoActivo]} />
        ))}
      </View>
      <Button label={ultima ? 'Entendido' : 'Siguiente'} icon={ultima ? 'check' : 'adelante'} onPress={siguiente} testID="conoce-atlas-siguiente" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pagina: { gap: space.md },
  escenario: {
    height: 360,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.feedbackBorder.brand,
  },
  halo: { position: 'absolute' },
  orbita: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(43,224,168,0.28)', borderStyle: 'dashed' },
  paso: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.feedbackSoft.success,
  },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginVertical: space.lg },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.border.strong },
  puntoActivo: { width: 24, backgroundColor: color.action.primary },
});
