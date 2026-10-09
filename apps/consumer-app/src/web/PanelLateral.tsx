/**
 * El panel derecho de acceso y registro: la mitad «de marca» de `login.html` y `registro.html`.
 *
 * En el acceso: la tarjeta de cuenta 3D que sigue al puntero y tres datos del producto (sin cifras de folleto ni citas de clientes: eran inventadas).
 * En el registro: la tarjeta y la lista de pasos con el activo en degradado, y nada mas —los chips
 * de «lo que ya está» y las cifras se retiraron el 2026-09-21 por repetir lo que la lista ya dice—.
 * Sólo web y sólo DOM; el aspecto vive en `estilo.ts` (`.auth__side`, `.steps`).
 */
import { Platform } from 'react-native';
import { color } from '../theme/tokens';
import { Tarjeta3D } from './Tarjeta3D';

export const PASOS_DEL_REGISTRO = [
  { ruta: '/registro', etiqueta: 'Tu cuenta' },
  { ruta: '/verificar-contacto', etiqueta: 'Verificar contacto' },
  { ruta: '/perfil', etiqueta: 'Datos personales' },
  { ruta: '/economia', etiqueta: 'Situación económica' },
  { ruta: '/domicilio', etiqueta: 'Domicilio' },
  { ruta: '/identidad', etiqueta: 'Carnet y selfie' },
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
      <div className="side__stats">
        <div>
          <b>Tu perfil</b>
          <span>Fija tu tasa y tu línea</span>
        </div>
        <div>
          <b>Mensuales</b>
          <span>Cuotas de tu crédito</span>
        </div>
        <div>
          <b>QR</b>
          <span>Compras en el comercio</span>
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
          <path d="M24 5 L43 43 H34 L24 21 L14 43 H5 Z" fill={color.brand.b400} />
          <path d="M17.5 31 H30.5 L34 38 H14 Z" fill={color.brand.b900} opacity=".55" />
        </svg>
        <span>Atlas</span>
      </a>
    </div>
  );
}
