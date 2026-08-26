/**
 * Como se pinta el contenido que llega del servidor.
 *
 * ## Por que los bullets son datos y no texto con guiones
 *
 * Porque un parrafo con guiones se lee como un parrafo. Lo que hace que una respuesta larga se
 * entienda de un vistazo es la jerarquia —un icono por punto, una linea por idea, el punto importante
 * destacado— y eso no se consigue interpretando texto libre. Quien edita desde el portal escribe la
 * lista; la app la maqueta. Ninguno de los dos tiene que saber lo del otro.
 *
 * ## Por que un icono desconocido no rompe nada
 *
 * El servidor puede nombrar un icono que esta app todavia no tiene: es lo que pasa cuando alguien
 * publica contenido nuevo antes de que la version con el icono llegue a las tiendas. Cae a uno
 * generico en lugar de reventar la pantalla.
 */
import { Linking, StyleSheet, View } from 'react-native';
import type { ContentAction, ContentBullet } from '../api/endpoints/app-content';
import { color, press, radius, space, touch } from '../theme/tokens';
import { Icon, ICON_NAMES, type IconName } from './icons';
import { PressSurface } from './motion';
import { AtlasText, IconChip } from './primitives';

function iconOr(name: string | null | undefined, fallback: IconName): IconName {
  return name && (ICON_NAMES as readonly string[]).includes(name) ? (name as IconName) : fallback;
}

/**
 * La lista de puntos de una respuesta.
 *
 * `emphasis` no cambia el tamano de la letra: cambia el color del icono y su fondo. Agrandar el texto
 * de un punto rompe el ritmo de la lista y hace que los demas parezcan letra pequena, que es lo
 * contrario de lo que se buscaba al destacarlo.
 */
export function ContentBullets({ bullets }: { bullets: ContentBullet[] }) {
  if (!bullets.length) return null;

  return (
    <View style={styles.list}>
      {bullets.map((bullet, index) => {
        return (
          <View key={`${index}-${bullet.text.slice(0, 12)}`} style={styles.bullet}>
            {/*
              El chip comun del sistema, no un fondo fabricado concatenando la alfa al hexadecimal
              (`${tint}1F`): eso es un color literal escrito fuera de los tokens, y ese 12 % fijo
              pesaba distinto segun el color de partida, asi que dos puntos de la misma lista no se
              veian igual de destacados aunque el codigo dijera que si.
            */}
            <IconChip name={iconOr(bullet.icon, 'check')} tone={bullet.emphasis ? 'brand' : 'success'} size="sm" />
            <AtlasText variant={bullet.emphasis ? 'title' : 'body'} tone={bullet.emphasis ? 'primary' : 'secondary'} style={styles.flex}>
              {bullet.text}
            </AtlasText>
          </View>
        );
      })}
    </View>
  );
}

/**
 * El boton del final de una pieza de contenido.
 *
 * `onScreen` y `onTour` los resuelve quien llama porque son navegacion de la app; los enlaces
 * externos —WhatsApp incluido— los abre el sistema. Si no hay quien atienda la accion, el boton no se
 * pinta: un boton que no hace nada es peor que la ausencia del boton.
 */
export function ContentActionButton({
  action,
  onScreen,
  onTour,
}: {
  action: ContentAction | null;
  onScreen?: (path: string) => void;
  onTour?: (tourKey: string) => void;
}) {
  if (!action) return null;
  if (action.kind === 'screen' && !onScreen) return null;
  if (action.kind === 'tour' && !onTour) return null;

  const abrir = () => {
    if (action.kind === 'screen') onScreen?.(action.url);
    else if (action.kind === 'tour') onTour?.(action.url);
    else void Linking.openURL(action.url);
  };

  const icon: IconName = action.kind === 'whatsapp' ? 'telefono' : action.kind === 'tour' ? 'refrescar' : 'adelante';
  const isWhatsApp = action.kind === 'whatsapp';

  return (
    /*
      El mismo hundimiento que el resto de la app, no un salto de opacidad.

      `pressed` de `Pressable` entra y sale en un fotograma; en una app donde TODO lo tocable se
      hunde con muelle, el unico control que se limita a apagarse se nota aunque nadie sepa decir
      por que. La regla esta en `docs/identidad-visual.md` §6 y se comprueba buscando el estado
      `pressed` de `Pressable` en `src` y `app`: no debe aparecer en ninguna pantalla.
    */
    <PressSurface
      onPress={abrir}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      scaleTo={press.scaleSubtle}
      style={[styles.action, isWhatsApp && styles.actionWhatsApp]}
    >
      <Icon name={icon} size={18} tint={isWhatsApp ? WHATSAPP_INK : color.action.primary} />
      <AtlasText variant="bodyStrong" style={{ color: isWhatsApp ? WHATSAPP_INK : color.action.primary }}>
        {action.label}
      </AtlasText>
    </PressSurface>
  );
}

/*
 * El verde de WhatsApp. Es una marca ajena y se usa solo para que el boton se reconozca de un
 * vistazo: quien busca ayuda no lee, busca el verde. No entra en los tokens del tema porque no es un
 * color de Atlas y no debe poder usarse para nada mas.
 */
const WHATSAPP_INK = '#128C7E';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space.sm },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: touch.minSize,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.action.primary,
    backgroundColor: color.surface.raised,
  },
  actionWhatsApp: { borderColor: WHATSAPP_INK, backgroundColor: `${WHATSAPP_INK}14` },
});
