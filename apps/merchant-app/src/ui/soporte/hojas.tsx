/**
 * Las tres hojas de Soporte: «Abrir un caso», «¿Sobre qué es?» y el detalle de un caso.
 *
 * En la web son un `Modal` (abrir caso) y dos `Panel` que aparecen encima de la lista (motivos y
 * detalle). En el teléfono las tres son una hoja que sube desde abajo (`BottomSheet` de la app del
 * cliente): es lo que se hace con algo que se mira o se rellena sin perder de vista la lista.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { IconField, SelectField } from '@cliente/ui/form-controls';
import { BottomSheet } from '@cliente/ui/help-sheet';
import { AtlasText, Button, Divider, KeyValue, ListRow } from '@cliente/ui/primitives';
import type { CasoDeSoporte, MotivoDeSoporte } from '@/api/servicios/supportService';
import { aplanarMotivos, casoListoParaEnviar, fechaHora, motivoDeBloqueo, type BorradorDeCaso } from '@/features/soporte/chat';
import { Aviso } from '@/ui/aviso';

/* ------------------------------------------------------------------ abrir un caso */

/**
 * Un caso ESCRITO, sin chat: para lo que no urge y conviene que quede documentado de entrada. Los
 * rótulos, ejemplos y la regla del botón (motivo, título ≥ 3, descripción ≥ 10) son los de la web.
 */
export function HojaNuevoCaso({
  visible,
  motivos,
  caso,
  onCambiar,
  onEnviar,
  onCerrar,
  enviando,
  error,
}: {
  visible: boolean;
  motivos: MotivoDeSoporte[];
  caso: BorradorDeCaso;
  onCambiar: (caso: BorradorDeCaso) => void;
  onEnviar: () => void;
  onCerrar: () => void;
  enviando: boolean;
  error: string | null;
}) {
  return (
    <BottomSheet visible={visible} titulo="Abrir un caso" onClose={onCerrar} cierre="Cancelar" evitarTeclado altura="alta">
      <ScrollView contentContainerStyle={styles.formulario} keyboardShouldPersistTaps="handled" testID="formulario-abrir-caso">
        <AtlasText variant="body" tone="secondary">
          Cuéntanos qué pasa por escrito; lo seguimos desde tus casos.
        </AtlasText>
        <SelectField
          label="Motivo"
          required
          value={caso.categoryCode || null}
          onChange={(categoryCode) => onCambiar({ ...caso, categoryCode })}
          opciones={aplanarMotivos(motivos).map((motivo) => ({ valor: motivo.value, etiqueta: motivo.label }))}
          ayuda="Tema del caso; decide a qué equipo llega."
          hint={motivos.length === 0 ? 'El catálogo de motivos no cargó: vuelve a intentarlo o habla con soporte.' : undefined}
          deshabilitadoPorque={motivos.length === 0 ? 'El catálogo de motivos no cargó: vuelve a intentarlo o habla con soporte.' : null}
        />
        <IconField
          label="Título"
          icon="editar"
          required
          value={caso.title}
          onChangeText={(title) => onCambiar({ ...caso, title })}
          placeholder="Qué pasa, en una línea"
          ayuda="Resumen del problema en una línea."
        />
        <IconField
          label="Descripción"
          icon="documento"
          required
          multiline
          value={caso.description}
          onChangeText={(description) => onCambiar({ ...caso, description })}
          placeholder="Cuándo empezó, qué esperabas y qué pasó."
          ayuda="Qué pasó, cuándo y qué esperabas; cuanto más detalle, antes se resuelve."
          style={styles.descripcion}
        />
        {error ? <Aviso tono="warning">{error}</Aviso> : null}
        <Button
          label="Enviar el caso"
          icon="enviar"
          onPress={onEnviar}
          loading={enviando}
          disabled={!casoListoParaEnviar(caso)}
          blockedReason={motivoDeBloqueo(caso)}
          testID="enviar-caso"
        />
        <Button label="Cancelar" variant="ghost" icon={null} onPress={onCerrar} disabled={enviando} />
      </ScrollView>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ elegir el motivo */

/**
 * «¿Sobre qué es?». Un motivo con submotivos baja un nivel; uno sin ellos abre la conversación. La
 * salida sin motivo se queda a la vista: esconderla convertiría el catálogo en un peaje.
 */
export function HojaMotivos({
  motivos,
  onElegir,
  onSinMotivo,
  onCerrar,
}: {
  motivos: MotivoDeSoporte[] | null;
  onElegir: (motivo: MotivoDeSoporte) => void;
  onSinMotivo: () => void;
  onCerrar: () => void;
}) {
  return (
    <BottomSheet visible={motivos !== null} titulo="¿Sobre qué es?" onClose={onCerrar} cierre="Cancelar" altura="alta">
      <ScrollView contentContainerStyle={styles.lista} testID="motivos-soporte">
        <AtlasText variant="body" tone="secondary">
          Así te atiende quien más sabe del tema.
        </AtlasText>
        {(motivos ?? []).map((motivo) => (
          <View key={motivo.categoryCode}>
            <ListRow title={motivo.label} subtitle={motivo.description ?? undefined} onPress={() => onElegir(motivo)} />
            <Divider inset />
          </View>
        ))}
        <ListRow
          title="Ninguno de estos / prefiero contarlo"
          subtitle="Abrimos la conversación y la clasificamos nosotros."
          icon="chat"
          onPress={onSinMotivo}
        />
      </ScrollView>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ detalle de un caso */

/** Lo que el servidor sabe del caso, no sólo la fila de la lista. */
export function HojaDetalleCaso({ caso, onCerrar }: { caso: CasoDeSoporte | null; onCerrar: () => void }) {
  return (
    <BottomSheet visible={caso !== null} titulo={caso?.title ?? ''} onClose={onCerrar} cierre="Cerrar">
      {caso ? (
        <ScrollView contentContainerStyle={styles.lista} testID="detalle-del-caso">
          <AtlasText variant="caption" tone="secondary">{`${caso.caseNumber} · ${caso.status}`}</AtlasText>
          <KeyValue label="Tipo" value={caso.caseType} />
          <KeyValue label="Dominio" value={caso.domain} />
          <KeyValue label="Abierto" value={fechaHora(caso.openedAt)} />
          <KeyValue label="Última actividad" value={fechaHora(caso.lastActivityAt)} />
          <KeyValue label="Primera respuesta" value={fechaHora(caso.firstResponseAt)} />
          <KeyValue label="Resuelto" value={fechaHora(caso.resolvedAt)} />
          {caso.summary ? (
            <View style={styles.resumen}>
              <AtlasText variant="caption" tone="secondary">
                Resumen
              </AtlasText>
              <AtlasText variant="body">{caso.summary}</AtlasText>
            </View>
          ) : null}
          <Button label="Cerrar el detalle" variant="ghost" icon={null} onPress={onCerrar} />
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  formulario: { gap: space.base, paddingBottom: space.xl },
  descripcion: { minHeight: 120, textAlignVertical: 'top' },
  lista: { gap: space.sm, paddingBottom: space.xl },
  resumen: { gap: space.xxs, paddingTop: space.sm },
});
