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
 * Si en 12 s no se consigue quietud (poca luz, un teléfono que comprime distinto), aparece «Tomar ahora»: el
 * automático es la comodidad, nunca la única puerta.
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
import { AtlasText, Button } from './primitives';

export type PoseDeVida = { kind: IdentityEvidenceKind; titulo: string; instruccion: string };

type EstadoFoto = { kind: IdentityEvidenceKind; uri: string; estado: 'enviando' | 'enviada' | 'error' };

/** Tiempo para colocarse en la pose antes de empezar a medir. */
const RESPIRO_MS = 1600;
/** Entre fotograma y fotograma de medida. */
const MUESTREO_MS = 450;
/** Sin quietud en este tiempo, aparece «Tomar ahora». */
const AYUDA_MANUAL_MS = 12_000;

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
  const [ayudaManual, setAyudaManual] = useState(false);
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
        setAyudaManual(false);
      }, 1100);
    } finally {
      disparando.current = false;
    }
  }, [pose, enviar, destello]);

  // El bucle de una pose: respiro, medir quietud, disparar.
  useEffect(() => {
    if (!lista || !pose || fase !== 'colocate') return;
    let vivo = true;
    const ayuda = setTimeout(() => vivo && setAyudaManual(true), AYUDA_MANUAL_MS);
    void (async () => {
      await new Promise((r) => setTimeout(r, RESPIRO_MS));
      if (!vivo) return;
      setFase('midiendo');
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
        if (estaQuieto(tamanos)) {
          await disparar();
          return;
        }
        await new Promise((r) => setTimeout(r, MUESTREO_MS));
      }
    })();
    return () => {
      vivo = false;
      clearTimeout(ayuda);
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

      {/* Sólo el contorno donde va la cara. */}
      <View style={styles.centro} pointerEvents="none">
        <View style={[styles.ovalo, { borderColor: bordeOvalo, borderWidth: quieto ? 5 : 3 + avance * 2 }]} testID="prueba-de-vida-ovalo" />
      </View>
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
                {quieto ? 'Enviándola. Sigue la siguiente indicación.' : fase === 'midiendo' ? `${pose.instruccion} Quédate quieto…` : pose.instruccion}
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
        {ayudaManual && pose && !quieto ? <Button label="Tomar ahora" variant="secondary" icon="camara" onPress={() => void disparar()} testID="prueba-de-vida-manual" /> : null}
      </View>
    </View>
  );
}

const ESTADO_TEXTO: Record<EstadoFoto['estado'], string> = { enviando: 'Enviando…', enviada: 'Enviada', error: 'Reintentar' };

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: palette.black },
  centro: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  ovalo: { width: '68%', aspectRatio: 0.76, borderRadius: 999 },
  destello: { backgroundColor: palette.white },
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
