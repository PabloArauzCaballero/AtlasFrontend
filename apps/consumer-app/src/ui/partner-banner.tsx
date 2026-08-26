/**
 * El espacio publicitario de un partner.
 *
 * ## Por que dibujado y no una imagen
 *
 * Una campana real llega como imagen desde el servidor. Mientras ese canal no exista, incrustar un
 * JPG de relleno en el bundle tiene dos problemas: pesa en cada instalacion y, sobre todo, se
 * confunde con contenido real —alguien lo ve en una demo y cree que la campana esta contratada—.
 * Dibujarlo con los tokens de la marca deja claro que es el HUECO, no el anuncio.
 *
 * ## Por que va marcado como publicidad
 *
 * Un bloque promocional dentro de una pantalla de dinero, sin etiquetar, se lee como una
 * recomendacion de Atlas. La etiqueta «Espacio de partner» es lo que separa lo que la app afirma de
 * lo que un tercero paga por decir.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { color, palette, press, radius, space } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { PressSurface } from './motion';
import { AtlasText } from './primitives';

export type PartnerBannerContent = {
  partnerName: string;
  headline: string;
  detail: string;
  ctaLabel: string;
  icon: IconName;
};

/**
 * El contenido de muestra.
 *
 * Se declara aqui y no dentro del componente para que el dia que llegue del servidor solo cambie de
 * origen: la forma ya es la que tendra la respuesta.
 */
export const SAMPLE_PARTNER_BANNER: PartnerBannerContent = {
  partnerName: 'Libreria Altiplano',
  headline: '2x1 en utiles escolares',
  detail: 'Paga en 3 cuotas sin interés con tu línea Atlas. Válido hasta fin de mes.',
  ctaLabel: 'Ver la promocion',
  icon: 'educacion',
};

export function PartnerBanner({ content = SAMPLE_PARTNER_BANNER, onPress }: { content?: PartnerBannerContent; onPress?: () => void }) {
  return (
    <View style={styles.wrapper}>
      <AtlasText variant="caption" tone="tertiary" style={styles.tag}>
        ESPACIO DE PARTNER
      </AtlasText>

      <PressSurface
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Publicidad de ${content.partnerName}: ${content.headline}`}
        style={styles.card}
        scaleTo={press.scaleSubtle}
      >
        {/* El degradado va en SVG: React Native no admite gradientes en `backgroundColor`. */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="partnerBanner" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.brand700} />
              <Stop offset="1" stopColor={palette.navy} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={radius.xxl} fill="url(#partnerBanner)" />
        </Svg>

        <View style={styles.content}>
          <View style={styles.iconBox}>
            <Icon name={content.icon} size={24} tint={palette.brand400} />
          </View>
          <View style={styles.text}>
            <AtlasText variant="caption" style={styles.partnerName}>
              {content.partnerName}
            </AtlasText>
            <AtlasText variant="h3" style={styles.headline}>
              {content.headline}
            </AtlasText>
            <AtlasText variant="caption" style={styles.detail}>
              {content.detail}
            </AtlasText>
          </View>
          <Icon name="adelante" size={18} tint={palette.tint} />
        </View>
      </PressSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.xs },
  tag: { letterSpacing: 1 },
  card: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.surface.edge,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.base },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink10,
  },
  text: { flex: 1, gap: space.xxs },
  /*
    Estos tres son los unicos colores de la app que se declaran contra un fondo que no es el de la
    app: el banner trae su propio degradado, asi que los tonos del sistema para texto —pensados
    sobre el navy— no valen aqui. Salen igualmente del palette, que es lo que pide §1: lo que no
    puede haber es un literal.
  */
  partnerName: { color: palette.tint, letterSpacing: 0.6 },
  headline: { color: palette.white },
  // El cuerpo va al 78 % en vez de con un tono propio: sobre un degradado, un gris fijo se aclara o
  // se ensucia segun la zona de la tarjeta donde caiga.
  detail: { color: palette.text1, opacity: 0.78 },
});
