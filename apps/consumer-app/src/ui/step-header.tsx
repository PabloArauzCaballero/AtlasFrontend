/**
 * La cabecera de un paso del alta.
 *
 * ## Por que existe
 *
 * El registro son seis pantallas de formulario, y cada una se abria con un titulo y nada mas: nada
 * decia en cual de las seis se estaba ni cuantas quedaban. Un formulario largo sin numero de paso
 * no se puede estimar, y lo que hace la gente cuando no puede estimar cuanto falta es dejarlo a
 * medias — que en un alta de credito significa un expediente abierto que nadie termina.
 *
 * ## Por que el numero Y la barra
 *
 * No dicen lo mismo. «Paso 3 de 6» es exacto y se lee; la barra se ve sin leer, y es lo que hace
 * que al pasar de pantalla se perciba que algo AVANZO. Con solo el numero, dos pasos seguidos se
 * distinguen por un digito que hay que buscar; con solo la barra, no se sabe cuantas pantallas
 * faltan.
 *
 * ## Por que la posicion y no el porcentaje del servidor
 *
 * Porque son dos cosas distintas y mezclarlas miente. El servidor calcula lo COMPLETADO —que puede
 * ir por detras si alguien salto un paso y volvio—; esto dice DONDE ESTA. Una barra que retrocede
 * al abrir el paso siguiente porque el anterior quedo incompleto no se lee como informacion, se lee
 * como un fallo.
 */
import { View, StyleSheet } from 'react-native';
import type { OnboardingSectionCode } from '../api/endpoints/onboarding';
import { SECTION_LABEL, stepPosition } from '../features/onboarding-map';
import { space } from '../theme/tokens';
import { ScreenHeader } from './layout';
import { ProgressBar } from './primitives';

export function StepHeader({
  code,
  title,
  subtitle,
  action,
}: {
  code: OnboardingSectionCode;
  /** El titulo de la pantalla. Por defecto, el que ya tiene el paso en el mapa del alta. */
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { step, total } = stepPosition(code);
  const label = SECTION_LABEL[code];

  return (
    <View style={styles.block}>
      <ScreenHeader
        eyebrow={`Paso ${step} de ${total}`}
        title={title ?? label.title}
        subtitle={subtitle ?? label.detail}
        onBack="auto"
        action={action}
      />
      <ProgressBar value={(step / total) * 100} label={`Paso ${step} de ${total} del registro`} />
    </View>
  );
}

const styles = StyleSheet.create({
  // La barra se pega a la cabecera: es parte de ella, no un bloque suelto entre el titulo y el
  // primer campo.
  block: { gap: space.sm },
});
