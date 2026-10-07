/**
 * La prueba de vida: tres fotos de la cara, sacadas SOLAS, como en una videollamada.
 *
 * Pablo (2026-10-06): «debe mostrar sólo los bordes donde va la cara y activar la cámara como videochat; automático
 * las tres, y sólo cuando te quedes quieto realmente te saque la foto, te avise y te muestre cada foto mientras se
 * manda». Antes eran tres pantallas de cámara con mira de cuatro esquinas y un botón «Tomar foto» en cada una.
 *
 * ## Cómo va
 *
 * 1. La cámara frontal llena la pantalla y encima sólo hay el CONTORNO de la cara (un óvalo) y la instrucción.
 * 2. Un respiro para colocarse en la pose; luego la app mira fotogramas pequeños hasta que la imagen se queda quieta
 *    (`features/quietud.ts`). Mientras, el óvalo se va llenando de color: se ve que está esperando a que no te muevas.
 * 3. Quieto: vibra, destella, dice «¡Foto tomada!» y la foto aparece abajo, en su miniatura, con «Enviando…» hasta
 *    que el servidor la tiene. La siguiente pose empieza sola; la subida no la frena.
 * 4. Si una subida falla, su miniatura lo dice y se reintenta tocándola, con la MISMA foto.
 *
 * ## Sale SOLA, siempre (Pablo, 2026-10-07: «no quiere sacar la foto automáticamente, es muy difícil lo de la cara»)
 *
 * Medir la quietud con el tamaño del JPEG casi nunca da «quieto» en un teléfono real —el ruido del sensor mueve el
 * tamaño más de lo que la quietud lo mueve—, así que la foto no salía y había que esperar al botón. Ahora hay una
 * CUENTA ATRÁS visible de 3 segundos: si la imagen se queda quieta antes (pasado un mínimo), se dispara antes; si no,
 * se dispara al llegar a cero. Siempre sale sola, y «Tomar ahora» está SIEMPRE a la vista: la prueba de vida nunca puede
 * bloquear el alta (Pablo, 2026-10-07: «que no me impida el flujo; que me deje sacarla yo mismo, las tres»).
 */
import { CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IdentityEvidenceKind } from '../features/evidence-upload';
import { avanceDeQuietud, estaQuieto } from '../features/quietud';
import { color, palette, radius, space, stroke } from '../theme/tokens';
import { Icon } from './icons';
import { SiluetaDeCara, silutaDe } from './silueta-de-cara';
import { AtlasText, Button } from './primitives';

export type PoseDeVida = { kind: IdentityEvidenceKind; titulo: string; instruccion: string };

type EstadoFoto = { kind: IdentityEvidenceKind; uri: string; estado: 'enviando' | 'enviada' | 'error' };

/** Tiempo para colocarse en la pose antes de empezar a medir. */
const RESPIRO_MS = 1600;
/** Entre fotograma y fotograma de medida. */
const MUESTREO_MS = 350;
/** La cuenta atrás: a los 3 s se dispara aunque la imagen no se haya quedado «quieta» por el sensor. */
const CUENTA_ATRAS_MS = 3000;
/** Antes de este tiempo no se dispara por quietud: da margen a colocarse en la pose. */
const MINIMO_MS = 1200;

export function PruebaDeVida({
  poses,
  onFoto,
  onTerminar,
  onSalir,
}: {
  /** Las poses que faltan, en orden. */
  poses: readonly PoseDeVida[];
  /** Sube una foto. Resuelve cuando el servidor la tiene; rechaza si falló. */
  onFoto: (kind: IdentityEvidenceKind, uri: string) => Promise<void>;
  onTerminar: () => void;
  onSalir: () => void;
}) {
  const insets = useSafeAreaInsets();
  const camara = useRef<CameraView>(null);
  const [lista, setLista] = useState(false);
  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState<'colocate' | 'midiendo' | 'tomada'>('colocate');
  const [avance, setAvance] = useState(0);
  /** Segundos que faltan para la foto; 0 = todavía no empieza la cuenta. */
  const [cuenta, setCuenta] = useState(0);
  const [fotos, setFotos] = useState<EstadoFoto[]>([]);
  const disparando = useRef(false);
  const destello = useSharedValue(0);
  const estiloDestello = useAnimatedStyle(() => ({ opacity: destello.value }));

  const pose = poses[indice] ?? null;
  const todasTomadas = indice >= poses.length;
  const todasEnviadas = todasTomadas && fotos.length > 0 && fotos.every((f) => f.estado === 'enviada');

  const enviar = useCallback(
    (kind: IdentityEvidenceKind, uri: string) => {
      setFotos((actual) => [...actual.filter((f) => f.kind !== kind), { kind, uri, estado: 'enviando' }]);
      onFoto(kind, uri).then(
        () => setFotos((actual) => actual.map((f) => (f.kind === kind ? { ...f, estado: 'enviada' } : f))),
        () => setFotos((actual) => actual.map((f) => (f.kind === kind ? { ...f, estado: 'error' } : f))),
      );
    },
    [onFoto],
  );

  const disparar = useCallback(async () => {
    if (!pose || !camara.current || disparando.current) return;
    disparando.current = true;
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.7, skipProcessing: true, shutterSound: false });
      if (!foto?.uri) return;
      setFase('tomada');
      destello.value = withSequence(withTiming(0.85, { duration: 80 }), withTiming(0, { duration: 420 }));
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      enviar(pose.kind, foto.uri);
      // Un momento para leer «¡Foto tomada!» antes de la siguiente pose.
      setTimeout(() => {
        setIndice((n) => n + 1);
        setFase('colocate');
        setAvance(0);
        setCuenta(0);
      }, 1100);
    } finally {
      disparando.current = false;
    }
  }, [pose, enviar, destello]);

  // El bucle de una pose: respiro, medir quietud, disparar.
  useEffect(() => {
    if (!lista || !pose || fase !== 'colocate') return;
    let vivo = true;
    void (async () => {
      await new Promise((r) => setTimeout(r, RESPIRO_MS));
      if (!vivo) return;
      setFase('midiendo');
      const inicio = Date.now();
      setCuenta(Math.ceil(CUENTA_ATRAS_MS / 1000));
      const tamanos: number[] = [];
      while (vivo && camara.current) {
        try {
          const muestra = await camara.current.takePictureAsync({ quality: 0.05, base64: true, skipProcessing: true, shutterSound: false });
          if (muestra?.base64) tamanos.push(muestra.base64.length);
        } catch {
          // Un fotograma que no sale no rompe la medida: se sigue con el siguiente.
        }
        if (!vivo) return;
        if (tamanos.length > 6) tamanos.shift();
        setAvance(avanceDeQuietud(tamanos));
        const transcurrido = Date.now() - inicio;
        setCuenta(Math.max(1, Math.ceil((CUENTA_ATRAS_MS - transcurrido) / 1000)));
        if ((transcurrido >= MINIMO_MS && estaQuieto(tamanos)) || transcurrido >= CUENTA_ATRAS_MS) {
          setCuenta(0);
          await disparar();
          return;
        }
        await new Promise((r) => setTimeout(r, MUESTREO_MS));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [lista, pose, fase, disparar]);

  const reintentar = (foto: EstadoFoto) => {
    if (foto.estado === 'error') enviar(foto.kind, foto.uri);
  };

  const quieto = fase === 'tomada';
  const bordeOvalo = quieto ? color.action.primary : avance > 0 ? palette.brand300 : 'rgba(255,255,255,0.85)';

  return (
    <View style={styles.pantalla} testID="prueba-de-vida">
      <CameraView ref={camara} style={StyleSheet.absoluteFill} facing="front" mirror animateShutter={false} onCameraReady={() => setLista(true)} />

      {/* La silueta donde va la CARA (de frente o girando), no el cuerpo. */}
      {pose ? <SiluetaDeCara pose={silutaDe(pose.kind)} color={bordeOvalo} grosor={quieto ? 5 : 3 + avance * 2} testID="prueba-de-vida-ovalo" /> : null}
      {fase === 'midiendo' && cuenta > 0 ? (
        <View style={styles.cuentaCaja} pointerEvents="none">
          <AtlasText variant="amountHero" style={styles.cuenta} testID="prueba-de-vida-cuenta">
            {String(cuenta)}
          </AtlasText>
        </View>
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.destello, estiloDestello]} />

      {/* Arriba: salir, paso y la instrucción. */}
      <View style={[styles.arriba, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onSalir} accessibilityRole="button" accessibilityLabel="Salir de la prueba de vida" hitSlop={12} style={styles.salir}>
          <Icon name="cerrar" size={22} tint={palette.white} />
        </Pressable>
        <View style={styles.instruccion}>
          {pose ? (
            <>
              <AtlasText variant="overline" style={styles.claro}>{`FOTO ${indice + 1} DE ${poses.length}`}</AtlasText>
              <AtlasText variant="h2" style={styles.claro} align="center">
                {quieto ? '¡Foto tomada!' : pose.titulo}
              </AtlasText>
              <AtlasText variant="body" style={styles.claroSuave} align="center">
                {quieto ? 'Enviándola. Sigue la siguiente indicación.' : fase === 'midiendo' ? `${pose.instruccion} Quédate quieto: la foto sale sola.` : pose.instruccion}
              </AtlasText>
            </>
          ) : (
            <>
              <AtlasText variant="h2" style={styles.claro} align="center">
                {todasEnviadas ? '¡Listo! Las tres fotos llegaron' : 'Terminando de enviar tus fotos…'}
              </AtlasText>
              {fotos.some((f) => f.estado === 'error') ? (
                <AtlasText variant="body" style={styles.claroSuave} align="center">
                  Una foto no se pudo enviar. Toca su miniatura para reintentarlo.
                </AtlasText>
              ) : null}
            </>
          )}
        </View>
      </View>

      {/* Abajo: cada foto con su estado, y las salidas. */}
      <View style={[styles.abajo, { paddingBottom: insets.bottom + space.base }]}>
        <View style={styles.miniaturas}>
          {poses.map((p) => {
            const foto = fotos.find((f) => f.kind === p.kind);
            return (
              <Pressable
                key={p.kind}
                onPress={foto ? () => reintentar(foto) : undefined}
                disabled={foto?.estado !== 'error'}
                accessibilityRole={foto?.estado === 'error' ? 'button' : undefined}
                accessibilityLabel={`${p.titulo}: ${foto ? ESTADO_TEXTO[foto.estado] : 'pendiente'}`}
                style={styles.miniatura}
                testID={`prueba-de-vida-foto-${p.kind}`}
              >
                {foto ? <Image source={{ uri: foto.uri }} style={styles.miniaturaImagen} /> : <Icon name="perfil" size={22} tint={palette.text3} />}
                {foto ? (
                  <View style={[styles.sello, foto.estado === 'enviada' ? styles.selloOk : foto.estado === 'error' ? styles.selloError : styles.selloEnviando]}>
                    <AtlasText variant="micro" style={styles.selloTexto}>
                      {ESTADO_TEXTO[foto.estado]}
                    </AtlasText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {todasEnviadas ? <Button label="Continuar" onPress={onTerminar} haptic="success" testID="prueba-de-vida-continuar" /> : null}
        {pose && !quieto ? <Button label="Tomar ahora" variant="secondary" icon="camara" onPress={() => void disparar()} testID="prueba-de-vida-manual" /> : null}
      </View>
    </View>
  );
}

const ESTADO_TEXTO: Record<EstadoFoto['estado'], string> = { enviando: 'Enviando…', enviada: 'Enviada', error: 'Reintentar' };

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: palette.black },
  centro: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  destello: { backgroundColor: palette.white },
  // Sobre el pecho, no sobre la cara: la persona tiene que verse mientras cuenta.
  cuentaCaja: { position: 'absolute', left: 0, right: 0, top: '58%', alignItems: 'center' },
  cuenta: { color: palette.white, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  arriba: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.lg, gap: space.sm, backgroundColor: 'rgba(0,0,0,0.35)', paddingBottom: space.md },
  salir: { alignSelf: 'flex-start', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  instruccion: { alignItems: 'center', gap: space.xxs },
  claro: { color: palette.white },
  claroSuave: { color: 'rgba(255,255,255,0.86)' },
  abajo: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, backgroundColor: 'rgba(0,0,0,0.35)' },
  miniaturas: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  miniatura: {
    width: 76,
    height: 96,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hairline,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  miniaturaImagen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sello: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 3, alignItems: 'center' },
  selloEnviando: { backgroundColor: 'rgba(0,0,0,0.6)' },
  selloOk: { backgroundColor: palette.brand500 },
  selloError: { backgroundColor: palette.dangerDeep },
  selloTexto: { color: palette.white },
});
