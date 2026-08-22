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
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { ContentAction, ContentBullet } from '../api/endpoints/app-content';
import { color, radius, space } from '../theme/tokens';
import { Icon, ICON_NAMES, type IconName } from './icons';
import { AtlasText } from './primitives';

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
        const tint = bullet.emphasis ? color.action.primary : color.feedback.success;
        return (
          <View key={`${index}-${bullet.text.slice(0, 12)}`} style={styles.bullet}>
            <View style={[styles.bulletIcon, { backgroundColor: `${tint}1F` }]}>
              <Icon name={iconOr(bullet.icon, 'check')} size={16} tint={tint} />
            </View>
            <AtlasText variant={bullet.emphasis ? 'bodyStrong' : 'body'} tone={bullet.emphasis ? 'primary' : 'secondary'} style={styles.flex}>
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

  const press = () => {
    if (action.kind === 'screen') onScreen?.(action.url);
    else if (action.kind === 'tour') onTour?.(action.url);
    else void Linking.openURL(action.url);
  };

  const icon: IconName = action.kind === 'whatsapp' ? 'telefono' : action.kind === 'tour' ? 'refrescar' : 'adelante';
  const isWhatsApp = action.kind === 'whatsapp';

  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={({ pressed }) => [styles.action, isWhatsApp && styles.actionWhatsApp, pressed && styles.actionPressed]}
    >
      <Icon name={icon} size={18} tint={isWhatsApp ? WHATSAPP_INK : color.action.primary} />
      <AtlasText variant="bodyStrong" style={{ color: isWhatsApp ? WHATSAPP_INK : color.action.primary }}>
        {action.label}
      </AtlasText>
    </Pressable>
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
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  bulletIcon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.action.primary,
    backgroundColor: color.surface.raised,
  },
  actionWhatsApp: { borderColor: WHATSAPP_INK, backgroundColor: `${WHATSAPP_INK}14` },
  actionPressed: { opacity: 0.7 },
});
