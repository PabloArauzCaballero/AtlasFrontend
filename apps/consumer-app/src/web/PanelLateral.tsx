/**
 * El panel derecho de acceso y registro: la mitad «de marca» de `login.html` y `registro.html`.
 *
 * En el acceso: la tarjeta de cuenta 3D que sigue al puntero, una cita de cliente y tres cifras.
 * En el registro: la tarjeta y la lista de pasos con el activo en degradado, y nada mas —los chips
 * de «lo que ya está» y las cifras se retiraron el 2026-09-21 por repetir lo que la lista ya dice—.
 * Sólo web y sólo DOM; el aspecto vive en `estilo.ts` (`.auth__side`, `.steps`).
 */
import { Platform } from 'react-native';
import { Tarjeta3D } from './Tarjeta3D';

export const PASOS_DEL_REGISTRO = [
  { ruta: '/registro', etiqueta: 'Tu cuenta' },
  { ruta: '/verificar-contacto', etiqueta: 'Verificar contacto' },
  { ruta: '/perfil', etiqueta: 'Datos personales' },
  { ruta: '/economia', etiqueta: 'Situación económica' },
  { ruta: '/domicilio', etiqueta: 'Domicilio' },
  { ruta: '/identidad', etiqueta: 'Carnet y selfie' },
  { ruta: '/referencias', etiqueta: 'Referencias' },
  { ruta: '/revision', etiqueta: 'Revisión' },
] as const;

export function PanelDeAcceso({ nombre, nivel }: { nombre?: string | null; nivel?: string | null }) {
  if (Platform.OS !== 'web') return null;
  return (
    <aside className="auth__side" aria-label="Tu cuenta Atlas">
      {/*
        Sin rotulo encima de la tarjeta: un antetitulo en versalitas para presentar un objeto que se
        explica solo es una linea de texto que hay que leer para no enterarse de nada.
      */}
      <Tarjeta3D nombre={nombre} nivel={nivel} />
      <p className="side__quote">“Compré la nevera que necesitaba sin descuadrar el mes. Las cuotas caen justo después de cobrar.”</p>
      <div className="side__who">
        {/*
          La inicial sobre una superficie neutra, no sobre un disco de degradado de marca.

          Un circulo verde macizo donde deberia ir una cara es el acabado que delata un hueco sin
          rellenar: se lee como el avatar por defecto de una plantilla, no como una persona. Neutro y
          con la inicial en el color de marca dice lo mismo sin fingir una foto que no existe.
        */}
        <span className="side__ini" aria-hidden="true">
          V
        </span>
        <div>
          <b>Valeria M.</b>
          <span>Nivel 3 · Santa Cruz</span>
        </div>
      </div>
      <div className="side__stats">
        <div>
          <b>0%</b>
          <span>Intereses</span>
        </div>
        <div>
          <b>3</b>
          <span>Cuotas quincenales</span>
        </div>
        <div>
          <b>500+</b>
          <span>Comercios</span>
        </div>
      </div>
    </aside>
  );
}

export function PanelDelRegistro({ pathname, nombre }: { pathname: string; nombre?: string | null }) {
  if (Platform.OS !== 'web') return null;
  const indice = Math.max(
    0,
    PASOS_DEL_REGISTRO.findIndex((p) => pathname.endsWith(p.ruta)),
  );
  return (
    <aside className="auth__side" aria-label="Tu registro">
      <span className="side__lbl">Tu cuenta se arma a la vista</span>
      <Tarjeta3D nombre={nombre} nivel="Nivel 1" />
      {/*
        La lista de pasos, y NADA MAS que la lista de pasos.

        Debajo habia dos bloques que decian lo mismo con otra forma: unos chips «Lo que ya está» —que
        repiten, uno a uno, los pasos que la lista de arriba ya marca con su palomita— y tres cifras
        de folleto. Seis bloques apilados en una columna cuyo trabajo es que no se pierda el hilo de
        un formulario: el panel acababa pesando mas que el paso que hay que rellenar, que es lo unico
        que hay que hacer en esta pantalla. Una sola manera de contar el avance, y es esta.
      */}
      <ol className="steps" aria-label="Pasos del registro">
        {PASOS_DEL_REGISTRO.map((p, i) => (
          <li key={p.ruta} className={i === indice ? 'on' : i < indice ? 'ok' : undefined}>
            <b>{i < indice ? '✓' : i + 1}</b>
            {p.etiqueta}
          </li>
        ))}
      </ol>
      <p className="side__nota">
        Puedes salir y seguir después: lo que envías queda guardado en tu cuenta.
      </p>
    </aside>
  );
}

/**
 * Cabecera de la columna del formulario: la marca, y nada mas.
 *
 * Llevaba ademas un «← Volver a la bienvenida» arriba a la derecha. Eran TRES formas de volver en la
 * misma pantalla y a menos de un palmo: ese enlace, la marca —que ya lleva a la bienvenida— y el
 * boton redondo de la propia pantalla, que es el unico de los tres que sabe volver AL PASO ANTERIOR
 * del registro y no al principio. Tres puertas para una salida no dan libertad, dan que pensar; y la
 * que se quita es la que peor informa. La marca sigue llevando a la portada.
 */
export function CabeceraDeAcceso() {
  if (Platform.OS !== 'web') return null;
  return (
    <div className="auth__top">
      <a href="/bienvenida" className="brand" aria-label="Atlas, ir a la portada">
        <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 5 L43 43 H34 L24 21 L14 43 H5 Z" fill="#2BE0A8" />
          <path d="M17.5 31 H30.5 L34 38 H14 Z" fill="#052033" opacity=".55" />
        </svg>
        <span>Atlas</span>
      </a>
    </div>
  );
}
