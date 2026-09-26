/**
 * La ayuda de un campo, en una hoja. Y la hoja que la sostiene.
 *
 * ## Por que no hay «tooltip»
 *
 * En la web la ayuda de un campo se pone al pasar el raton por el icono ⓘ. En un telefono NO HAY
 * raton: no existe el estado «encima sin tocar», asi que una burbuja que aparece al pasar por
 * encima o no aparece nunca o aparece al tocar y tapa justo el campo que se iba a rellenar. Lo que
 * si existe en movil es la hoja: se abre desde abajo, cubre lo de debajo, se lee entera y se cierra
 * de dos maneras distintas. Es el mismo contrato de la especificacion comun —una frase que dice que
 * poner y por que importa— con el gesto que este soporte sí tiene.
 *
 * ## Por que la hoja generica vive aqui
 *
 * El mismo velo + tirador + cabecera + «Listo» estaba escrito TRES veces en `form-controls.tsx`
 * —el selector de pais, el selector de opciones y el calendario de iOS— con las mismas medidas
 * copiadas a mano. La cuarta copia iba a ser esta. `BottomSheet` es esa hoja, una sola vez; la de
 * ayuda es un contenido dentro de ella.
 *
 * ## `accessibilityViewIsModal`
 *
 * Sin esto VoiceOver sigue recorriendo el formulario de DEBAJO de la hoja: la persona que abre la
 * ayuda de un campo se encuentra leyendo los otros campos sin saber que hay una hoja abierta. Lo
 * declara el contenedor de la hoja, no el `Modal`, porque es la vista que debe atrapar el foco.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ANCHO_COLUMNA, useTramo } from './responsive';
import { color, radius, shadow, space, stroke, touch } from '../theme/tokens';
import { toqueWeb } from './hit-slop';
import { Icon } from './icons';
import { AtlasText, Overline } from './primitives';

/* ------------------------------------------------------------------ la hoja */

export function BottomSheet({
  visible,
  titulo,
  onClose,
  cierre = 'Listo',
  evitarTeclado = false,
  children,
}: {
  visible: boolean;
  titulo: string;
  onClose: () => void;
  /** El texto del boton de la derecha. «Listo» cuando se elige algo; «Cerrar» cuando solo se lee. */
  cierre?: string;
  /**
   * Para las hojas con un campo de texto (el chat del asistente): en iOS el teclado sube DELANTE
   * del Modal y sin esto tapa el campo que se acaba de tocar. Es opt-in porque las hojas de solo
   * lectura no lo necesitan y el envoltorio cambia como se reparte el alto.
   */
  evitarTeclado?: boolean;
  children: React.ReactNode;
}) {
  /*
    Con aire a los lados, la hoja no ocupa la ventana entera: se estrecha a la columna de lectura y
    se redondea por los cuatro lados. Una hoja de 1.400 px que sube desde abajo se lee como una
    cortina, no como una ayuda sobre lo que se estaba mirando.
  */
  const estrecha = useTramo() !== 'telefono';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={evitarTeclado}
        style={styles.lienzo}
      >
        {/*
          El velo es un pulsable a pantalla completa y ADEMAS esta marcado como decorativo: tocar
          fuera cierra —es el gesto que la gente ya tiene aprendido— pero un lector de pantalla no
          tiene por que anunciar un rectangulo llamado «velo» antes del contenido de la hoja.
        */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={[styles.sheet, estrecha && styles.sheetEstrecha]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <AtlasText variant="h3" style={styles.sheetTitle}>
              {titulo}
            </AtlasText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={cierre} hitSlop={12} {...toqueWeb(12)}>
              <AtlasText variant="bodyStrong" tone="brand">
                {cierre}
              </AtlasText>
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * La hoja de ayuda de un campo: su nombre arriba y la explicacion debajo.
 *
 * El texto va en `body` y no en `caption` a proposito: es lo unico que hay en la hoja y es lo que
 * se abrio a leer. Un parrafo de 13 px en una hoja vacia se lee como una nota al pie de algo que no
 * esta.
 */
export function HelpSheet({
  visible,
  titulo,
  texto,
  onClose,
}: {
  visible: boolean;
  titulo: string;
  texto: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} titulo={titulo} onClose={onClose} cierre="Listo">
      <ScrollView style={styles.cuerpo} contentContainerStyle={styles.cuerpoContenido}>
        <AtlasText variant="body" tone="secondary">
          {texto}
        </AtlasText>
      </ScrollView>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ el disparador */

/**
 * El boton ⓘ.
 *
 * ## El tamano de toque y el tamano dibujado no son el mismo numero
 *
 * Dibujado mide 26 px —un icono de 18 con su respiro— porque al lado del nombre de un campo un
 * cuadrado de 48 px de alto separaria la etiqueta de su caja lo bastante como para que dejaran de
 * leerse juntas. Tocado mide 48: los 26 dibujados mas 11 de `hitSlop` por cada lado, que es el
 * minimo de `touch.minSize`. Es la misma distincion que ya hacen el ojo del PIN y el «Listo» de las
 * hojas.
 *
 * ## El nombre accesible
 *
 * `Ayuda: <etiqueta>`. Sin el nombre del campo, un formulario con doce campos se recorre con doce
 * botones llamados «Ayuda» y ninguno dice de que. Y va en el BOTON, no en la etiqueta del campo: si
 * entrara en el nombre accesible del control, cambiaria el nombre por el que las pruebas E2E y el
 * lector de pantalla encuentran el campo.
 */
export function HelpButton({ ayuda, etiqueta }: { ayuda: string; etiqueta: string }) {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setAbierta(true)}
        accessibilityRole="button"
        accessibilityLabel={`Ayuda: ${etiqueta}`}
        accessibilityHint="Abre una hoja con la explicación de este campo"
        hitSlop={HIT_SLOP}
        {...toqueWeb(HIT_SLOP)}
        style={styles.helpTarget}
        testID={`ayuda-${etiqueta}`}
      >
        <Icon name="info" size={18} tint={color.text.tertiary} />
      </Pressable>
      <HelpSheet visible={abierta} titulo={etiqueta} texto={ayuda} onClose={() => setAbierta(false)} />
    </>
  );
}

/** 26 dibujados + 11 por lado = los 48 de `touch.minSize`. */
const DIBUJADO = 26;
const HIT_SLOP = (touch.minSize - DIBUJADO) / 2;

/* ------------------------------------------------------------------ etiqueta y pie */

/**
 * La etiqueta de un control, una sola vez para toda la app.
 *
 * Estaba escrita SEIS veces —cuatro en `form-controls.tsx`, una en `fields.tsx` y otra en
 * `pin-field.tsx`— y no todas iguales: el PIN la dibujaba con `caption`, que es el estilo del texto
 * de ayuda de DEBAJO del campo. Un formulario donde el nombre del dato y su explicacion se dibujan
 * igual se lee como renglones de texto con rectangulos en medio.
 *
 * El asterisco va aparte y en color de marca, con su propia etiqueta accesible: gris y pegado al
 * final de la palabra no se ve, y sin nombre no significa nada para un lector de pantalla. Va
 * DENTRO del mismo nodo de texto que la etiqueta porque los recorridos de Maestro localizan los
 * campos por `text: 'Apellido *'`: separarlo en dos nodos los rompe.
 */
export function FieldLabel({
  label,
  required,
  ayuda,
  variante = 'label',
  trailing,
}: {
  label: string;
  required?: boolean;
  /** Que poner y por que importa. Sin esto no hay ⓘ, y el guardian `check-field-help` lo caza. */
  ayuda?: string;
  /** `overline` para los bloques que ya rotulaban con versalitas, como el importe de una compra. */
  variante?: 'label' | 'overline';
  /** Una accion mas a la derecha de la fila: el ojo del PIN. */
  trailing?: React.ReactNode;
}) {
  const texto = (
    <>
      {label}
      {required ? (
        <AtlasText variant={variante === 'overline' ? 'micro' : 'label'} tone="brand" accessibilityLabel="obligatorio">
          {' *'}
        </AtlasText>
      ) : null}
    </>
  );

  return (
    <View style={styles.labelRow}>
      {variante === 'overline' ? (
        <Overline>{texto}</Overline>
      ) : (
        <AtlasText variant="label" tone="secondary">
          {texto}
        </AtlasText>
      )}
      {ayuda ? <HelpButton ayuda={ayuda} etiqueta={label} /> : null}
      {trailing ? <View style={styles.labelSpacer} /> : null}
      {trailing}
    </View>
  );
}

/**
 * El pie de un control: el fallo y la pista, CONVIVIENDO.
 *
 * Los tres pies duplicados por la app hacian `error ? … : hint ? … : null`, asi que en cuanto un
 * campo fallaba desaparecia la unica linea que decia como rellenarlo — justo cuando hace falta. El
 * fallo va primero porque es lo que cambio; la pista sigue debajo porque sigue siendo verdad.
 */
export function FieldFoot({ error, hint }: { error?: string | null; hint?: string }) {
  if (!error && !hint) return null;
  return (
    <>
      {error ? (
        <AtlasText variant="caption" tone="danger">
          {error}
        </AtlasText>
      ) : null}
      {hint ? (
        <AtlasText variant="caption" tone="tertiary">
          {hint}
        </AtlasText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  labelSpacer: { flex: 1 },
  helpTarget: { padding: 4, alignItems: 'center', justifyContent: 'center' },

  // El envoltorio que reparte el alto entre velo y hoja. Es lo que `KeyboardAvoidingView`
  // encoge cuando sube el teclado; sin `flex: 1` la hoja no tendria contra que empujar.
  lienzo: { flex: 1, justifyContent: 'flex-end' },
  // El mismo velo que el recorrido guiado (`color.overlay.scrim`): negro puro al 55 % era un
  // segundo oscurecedor, mas claro y sin el tinte navy, en una app que ya tenia el suyo.
  backdrop: { flex: 1, backgroundColor: color.overlay.scrim },
  sheet: {
    backgroundColor: color.surface.sheet,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingBottom: space.xl,
    /*
      Nunca mas alta que la ventana. Con un telefono apaisado (388 px de alto) o un selector de
      cuarenta opciones, la hoja media mas que la pantalla y —como el velo es `flex: 1` y ella no
      cedia— salia por ARRIBA, con el titulo y el «Listo» fuera de la vista. Con tope y `flexShrink`
      es la lista de dentro la que se desplaza; en vertical, donde siempre cupo, no cambia nada.
    */
    maxHeight: '92%',
    flexShrink: 1,
    ...shadow.sheet,
  },
  sheetEstrecha: {
    width: '100%',
    maxWidth: ANCHO_COLUMNA,
    alignSelf: 'center',
    borderRadius: radius.xxl,
    marginBottom: space.xxl,
  },
  /*
    El tirador. No se arrastra —la hoja se cierra tocando fuera o con «Listo»— y aun asi vale la
    pena: es la senal con la que ambos sistemas operativos dicen «esto es una hoja que cubre lo de
    debajo, no una pantalla nueva». Sin el, la hoja aparecia como un bloque que sube desde el borde
    y no quedaba claro si volver era retroceder o cerrar.
  */
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.border.strong,
    alignSelf: 'center',
    marginTop: space.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: color.border.hairline,
  },
  sheetTitle: { flex: 1 },
  cuerpo: { maxHeight: 320, flexShrink: 1 },
  cuerpoContenido: { padding: space.lg, paddingBottom: space.xl },
});
