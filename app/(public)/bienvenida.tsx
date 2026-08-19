/**
 * Bienvenida.
 *
 * Primera impresion de marca y una sola decision: crear cuenta o entrar. No se piden datos todavia
 * ni se pide un solo permiso: los permisos se solicitan cuando aportan valor, no al arrancar.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AtlasLogo } from '../../src/ui/brand';
import { Gap, Screen } from '../../src/ui/layout';
import { AtlasText, Button } from '../../src/ui/primitives';
import { color, radius, space } from '../../src/theme/tokens';

const VALUE_PROPS = [
  { title: 'Pagas 60% hoy', detail: 'El resto se divide en 3 cuotas cada 14 dias.' },
  { title: 'Sin tarjeta', detail: 'Escaneas el QR del comercio y listo.' },
  { title: 'Pagas al comercio', detail: 'El dinero va directo a la cuenta del negocio.' },
];

export default function Welcome() {
  const router = useRouter();

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Crear mi cuenta" onPress={() => router.push('/(onboarding)/registro')} />
          <Button label="Ya tengo cuenta" variant="ghost" onPress={() => router.push('/(auth)/ingresar')} />
        </>
      }
    >
      <Gap size="xxl" />
      <AtlasLogo />
      <Gap size="lg" />

      <AtlasText variant="hero">Compra hoy.{'\n'}Paga en cuotas.</AtlasText>
      <AtlasText variant="body" tone="secondary">
        Credito al instante en los comercios de Santa Cruz, sin tramites y sin tarjeta.
      </AtlasText>

      <Gap size="lg" />
      <View style={styles.list}>
        {VALUE_PROPS.map((item, index) => (
          <View key={item.title} style={styles.item}>
            <View style={styles.bullet}>
              <AtlasText variant="micro" tone="onBrand">
                {index + 1}
              </AtlasText>
            </View>
            <View style={styles.itemText}>
              <AtlasText variant="bodyStrong">{item.title}</AtlasText>
              <AtlasText variant="caption" tone="secondary">
                {item.detail}
              </AtlasText>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.base },
  item: { flexDirection: 'row', gap: space.base, alignItems: 'flex-start' },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: color.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, gap: space.xxs },
});
