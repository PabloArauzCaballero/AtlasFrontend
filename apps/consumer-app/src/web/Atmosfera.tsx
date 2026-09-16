/**
 * La atmósfera de la landing: aurora, grano y malla. Sólo web, sólo DOM.
 *
 * Tres halos difusos que derivan muy despacio, un grano fijo al 5 % y la malla del hero con máscara
 * radial. Es lo que separa «una pantalla oscura» de «un plano con profundidad» (playbook §5). Va
 * fija detrás de todo y no captura el puntero; a menos de 600 px no se pinta (la web es la app) y
 * con «movimiento reducido» la aurora se queda quieta. Todo el aspecto vive en `estilo.ts`.
 */
import { Platform } from 'react-native';

export function Atmosfera() {
  if (Platform.OS !== 'web') return null;
  return (
    <>
      <div className="aurora" aria-hidden="true">
        <span className="aurora__blob aurora__blob--1" />
        <span className="aurora__blob aurora__blob--2" />
        <span className="aurora__blob aurora__blob--3" />
      </div>
      <div className="mesh" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />
    </>
  );
}
