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
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { color, press, radius, space } from '../theme/tokens';
import { getContent, type ContentAction, type ContentEntry } from '../api/endpoints/app-content';
import { ICON_NAMES, Icon, type IconName } from './icons';
import { PressSurface } from './motion';
import { AtlasText } from './primitives';

export type PartnerBannerContent = {
  partnerName: string;
  headline: string;
  detail: string;
  ctaLabel: string;
  icon: IconName;
  /** El enlace que trae el contenido; sin el, el banner informa y no es un boton. */
  action: ContentAction | null;
};

/**
 * Convierte la primera entrada de `app-content` (`surface: 'home'`) en un banner.
 *
 * ## Por que ya no hay un contenido de muestra
 *
 * Habia uno: «Libreria Altiplano · 2x1 en utiles escolares · Paga en 3 cuotas sin interes». Lo veia
 * TODO cliente en el inicio, aunque ninguna campana estuviera contratada, y prometia un plazo y una
 * tasa que Core no cobra. Ahora el banner sale del catalogo de contenidos —lo edita negocio desde el
 * portal— y si no hay una entrada con titulo, NO se pinta: un hueco vacio es mejor que un anuncio
 * inventado.
 *
 * El nombre del comercio viaja en `metadata.partnerName`; sin el, no se sabe QUIEN paga por decirlo y
 * tampoco se pinta.
 */
export function bannerDesdeContenido(entries: readonly ContentEntry[]): PartnerBannerContent | null {
  for (const entry of entries) {
    const partnerName = typeof entry.metadata?.partnerName === 'string' ? entry.metadata.partnerName.trim() : '';
    const headline = entry.title?.trim() ?? '';
    if (!partnerName || !headline) continue;
    const icono = entry.bullets.find((bullet) => bullet.icon)?.icon ?? null;
    return {
      partnerName,
      headline,
      detail: (entry.subtitle ?? entry.body ?? '').trim(),
      ctaLabel: entry.action?.label ?? '',
      icon: icono && (ICON_NAMES as readonly string[]).includes(icono) ? (icono as IconName) : 'comercio',
      action: entry.action && /^(https?|whatsapp):/i.test(entry.action.url) ? entry.action : null,
    };
  }
  return null;
}

/** El banner del inicio: `null` mientras carga, si no hay campana o si el servidor no contesta. */
export function usePartnerBanner(): PartnerBannerContent | null {
  const [banner, setBanner] = useState<PartnerBannerContent | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getContent('home').then((entries) => {
      if (!cancelled) setBanner(bannerDesdeContenido(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return banner;
}

export function PartnerBanner({ content, onPress }: { content: PartnerBannerContent; onPress?: () => void }) {
  return (
    <View style={styles.wrapper}>
      <AtlasText variant="caption" tone="tertiary" style={styles.tag}>
        ESPACIO DE PARTNER
      </AtlasText>

      <PressSurface
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={`Publicidad de ${content.partnerName}: ${content.headline}`}
        style={styles.card}
        scaleTo={press.scaleSubtle}
      >
        {/* El degradado va en SVG: React Native no admite gradientes en `backgroundColor`. */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="partnerBanner" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color.brand.b700} />
              <Stop offset="1" stopColor={color.brand.navy} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={radius.xxl} fill="url(#partnerBanner)" />
        </Svg>

        <View style={styles.content}>
          <View style={styles.iconBox}>
            <Icon name={content.icon} size={24} tint={color.brand.b400} />
          </View>
          <View style={styles.text}>
            <AtlasText variant="caption" style={styles.partnerName}>
              {content.partnerName}
            </AtlasText>
            <AtlasText variant="h3" style={styles.headline}>
              {content.headline}
            </AtlasText>
            {content.detail ? (
              <AtlasText variant="caption" style={styles.detail}>
                {content.detail}
              </AtlasText>
            ) : null}
          </View>
          <Icon name="adelante" size={18} tint={color.brand.tint} />
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
    backgroundColor: color.fill.strong,
  },
  text: { flex: 1, gap: space.xxs },
  /*
    Estos tres son los unicos colores de la app que se declaran contra un fondo que no es el de la
    app: el banner trae su propio degradado, asi que los tonos del sistema para texto —pensados
    sobre el navy— no valen aqui. Salen igualmente del palette, que es lo que pide §1: lo que no
    puede haber es un literal.
  */
  partnerName: { color: color.brand.tint, letterSpacing: 0.6 },
  headline: { color: color.fixed.white },
  // El cuerpo va al 78 % en vez de con un tono propio: sobre un degradado, un gris fijo se aclara o
  // se ensucia segun la zona de la tarjeta donde caiga.
  detail: { color: color.text.primary, opacity: 0.78 },
});
