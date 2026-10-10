/**
 * La pestaña «Soporte»: los casos del comercio, abrir uno por escrito y empezar una conversación.
 * Porte de la mitad «soporte» de `MerchantSupportScreen.tsx`.
 *
 * ## Por qué hay motivo antes de hablar
 *
 * El motivo decide a qué cola entra la conversación —conciliación y facturación no las atiende la
 * primera línea— y con qué plazo se mide. Si el catálogo no cargó se salta el paso: preguntar por
 * una lista vacía sería un callejón sin salida justo cuando alguien necesita ayuda.
 *
 * ## Por qué el catálogo falla a la vista
 *
 * En la web su fallo se tragaba «para no tumbar la pantalla» y escondió durante semanas que la
 * pasarela no reenviaba `merchant/support/categories`. Se puede seguir hablando sin motivos, pero
 * el aviso queda a la vista.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { AtlasText, Badge, Button, Card, CardHeader, Cargando, Divider } from '@cliente/ui/primitives';
import { supportService, type CasoDeSoporte, type MotivoDeSoporte } from '@/api/servicios/supportService';
import { CASO_VACIO, TEXTOS, canalVivo, soloFecha, tonoDelCaso, type BorradorDeCaso } from '@/features/soporte/chat';
import type { MerchantPartner } from '@/features/use-merchant-partner';
import { Aviso } from '@/ui/aviso';
import { HojaDetalleCaso, HojaMotivos, HojaNuevoCaso } from './hojas';

export function VistaSoporte({ partner, vuelta }: { partner: MerchantPartner; vuelta: number }) {
  const router = useRouter();
  const { partnerId } = partner;
  const [casos, setCasos] = useState<CasoDeSoporte[]>([]);
  const [motivos, setMotivos] = useState<MotivoDeSoporte[]>([]);
  const [cargandoCasos, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** `null` = todavía no se pulsó «Hablar»; un valor = el nivel del árbol que se está viendo. */
  const [eligiendo, setEligiendo] = useState<MotivoDeSoporte[] | null>(null);
  const [abriendoCaso, setAbriendoCaso] = useState(false);
  const [nuevoCaso, setNuevoCaso] = useState<BorradorDeCaso>(CASO_VACIO);
  const [enviandoCaso, setEnviandoCaso] = useState(false);
  const [errorDelCaso, setErrorDelCaso] = useState<string | null>(null);
  const [casoAbierto, setCasoAbierto] = useState<CasoDeSoporte | null>(null);
  const [abriendoConversacion, setAbriendoConversacion] = useState(false);
  const primeraVez = useRef(true);
  const cargando = cargandoCasos || (!partnerId && partner.cargando);

  useEffect(() => {
    if (!partnerId) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    (async () => {
      try {
        const [{ cases }, catalogo] = await Promise.all([
          supportService.listarCasos(partnerId),
          supportService.listarMotivos().catch(() => {
            if (!cancelado) setError(TEXTOS.noMotivos);
            return { categories: [] as MotivoDeSoporte[] };
          }),
        ]);
        if (cancelado) return;
        setCasos(cases);
        setMotivos(catalogo.categories);
      } catch {
        if (!cancelado) setError(TEXTOS.noCasos);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [partnerId, vuelta]);

  const recargarCasos = useCallback(async () => {
    if (!partnerId) return;
    const { cases } = await supportService.listarCasos(partnerId);
    setCasos(cases);
  }, [partnerId]);

  /*
    Al volver de una conversación se releen los casos: la web lo hace al cerrarla desde su botón, y
    aquí el botón vive en otra pantalla. La primera vez no, que ya lo hizo la carga de arriba.
  */
  useFocusEffect(
    useCallback(() => {
      if (primeraVez.current) {
        primeraVez.current = false;
        return;
      }
      void recargarCasos().catch(() => undefined);
    }, [recargarCasos]),
  );

  const abrirConversacion = async (categoryCode?: string) => {
    if (!partnerId) return;
    setEligiendo(null);
    setAbriendoConversacion(true);
    try {
      const canal = await supportService.abrirConversacion({ partnerProfileId: partnerId, ...(categoryCode ? { categoryCode } : {}) });
      setError(null);
      router.push({
        pathname: '/conversacion/[channelId]',
        params: { channelId: canal.channelId, ...(canal.agentsAvailable === 0 ? { aviso: 'sin-agentes' } : {}) },
      });
    } catch {
      setError(TEXTOS.noAbrio);
    } finally {
      setAbriendoConversacion(false);
    }
  };

  const empezar = () => {
    if (motivos.length === 0) {
      void abrirConversacion();
      return;
    }
    setEligiendo(motivos);
  };

  /** No se obliga a bajar hasta la hoja: el motivo de primer nivel ya enruta y ya se puede contar. */
  const elegirMotivo = (motivo: MotivoDeSoporte) => {
    if (motivo.subcategories && motivo.subcategories.length > 0) {
      setEligiendo(motivo.subcategories);
      return;
    }
    void abrirConversacion(motivo.categoryCode);
  };

  const enviarCaso = async () => {
    if (!partnerId || enviandoCaso) return;
    setEnviandoCaso(true);
    setError(null);
    setErrorDelCaso(null);
    try {
      await supportService.abrirCaso({ ...nuevoCaso, partnerProfileId: partnerId });
      setAbriendoCaso(false);
      setNuevoCaso(CASO_VACIO);
      await recargarCasos();
    } catch {
      // Dentro de la hoja, que es lo que se está mirando; y en la pestaña, como la web.
      setErrorDelCaso(TEXTOS.noCaso);
      setError(TEXTOS.noCaso);
    } finally {
      setEnviandoCaso(false);
    }
  };

  const abrirDetalle = async (caso: CasoDeSoporte) => {
    try {
      setCasoAbierto(await supportService.verCaso(caso.caseId));
    } catch {
      setError(TEXTOS.noDetalle);
    }
  };

  const verConversacion = (caso: CasoDeSoporte) => {
    const vivo = canalVivo(caso);
    if (vivo) router.push({ pathname: '/conversacion/[channelId]', params: { channelId: vivo } });
  };

  return (
    <View style={styles.columna}>
      <View style={styles.acciones}>
        <Button
          label="Hablar con soporte"
          icon="chat"
          onPress={empezar}
          loading={abriendoConversacion}
          disabled={!partnerId}
          blockedReason={!partnerId && !partner.cargando ? partner.error : null}
          testID="hablar-con-soporte"
        />
        <Button
          label="Abrir un caso"
          icon="documento"
          variant="secondary"
          onPress={() => {
            setErrorDelCaso(null);
            setAbriendoCaso(true);
          }}
          disabled={!partnerId}
          testID="abrir-un-caso"
        />
      </View>

      {error ? <Aviso tono="warning">{error}</Aviso> : null}
      {!partnerId && !partner.cargando && partner.error ? <Aviso tono="warning">{partner.error}</Aviso> : null}

      <Card>
        <CardHeader title="Mis casos" detail={cargando ? 'Cargando…' : `${casos.length} caso(s)`} icon="lista" />
        {cargando ? <Cargando texto="Cargando…" /> : null}
        {casos.length === 0 && !cargando ? (
          <AtlasText variant="body" tone="secondary">
            Todavía no abriste ningún caso. El botón de arriba abre una conversación.
          </AtlasText>
        ) : null}
        {casos.map((caso, indice) => (
          <View key={caso.caseId} style={styles.caso} testID={`caso-${caso.caseId}`}>
            {indice > 0 ? <Divider /> : null}
            <View style={styles.filaEntre}>
              <View style={styles.crece}>
                <AtlasText variant="title" numberOfLines={2}>
                  {caso.title}
                </AtlasText>
                <AtlasText variant="caption" tone="secondary">{`${caso.caseNumber} · abierto el ${soloFecha(caso.openedAt)}`}</AtlasText>
              </View>
              <Badge label={caso.status} tone={tonoDelCaso(caso)} />
            </View>
            <View style={styles.botonesCaso}>
              <Button label="Ver detalle" variant="ghost" icon={null} onPress={() => void abrirDetalle(caso)} />
              {canalVivo(caso) ? <Button label="Ver conversación" variant="ghost" icon="chat" onPress={() => verConversacion(caso)} /> : null}
            </View>
          </View>
        ))}
      </Card>

      <HojaNuevoCaso
        visible={abriendoCaso}
        motivos={motivos}
        caso={nuevoCaso}
        onCambiar={setNuevoCaso}
        onEnviar={() => void enviarCaso()}
        onCerrar={() => setAbriendoCaso(false)}
        enviando={enviandoCaso}
        error={errorDelCaso}
      />
      <HojaMotivos motivos={eligiendo} onElegir={elegirMotivo} onSinMotivo={() => void abrirConversacion()} onCerrar={() => setEligiendo(null)} />
      <HojaDetalleCaso caso={casoAbierto} onCerrar={() => setCasoAbierto(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { gap: space.base },
  acciones: { gap: space.sm },
  caso: { gap: space.xs, paddingVertical: space.xs },
  filaEntre: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  crece: { flex: 1, gap: space.xxs },
  botonesCaso: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
