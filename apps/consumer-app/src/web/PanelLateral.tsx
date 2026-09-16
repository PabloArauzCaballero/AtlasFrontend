/**
 * El panel derecho de acceso y registro: la mitad «de marca» de `login.html` y `registro.html`.
 *
 * Tarjeta de cuenta 3D que sigue al puntero, una cita y tres cifras; en el registro, además, la
 * lista de pasos con el activo en degradado y los chips de lo que ya está listo. Sólo web y sólo
 * DOM; el aspecto vive en `estilo.ts` (`.auth__side`, `.steps`, `.ready`).
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
      <span className="side__lbl">Tu cuenta Atlas</span>
      <Tarjeta3D nombre={nombre} nivel={nivel} />
      <p className="side__quote">“Compré la nevera que necesitaba sin descuadrar el mes. Las cuotas caen justo después de cobrar.”</p>
      <div className="side__who">
        <span className="nav__avatar" aria-hidden="true">
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
      <ol className="steps" aria-label="Pasos del registro">
        {PASOS_DEL_REGISTRO.map((p, i) => (
          <li key={p.ruta} className={i === indice ? 'on' : i < indice ? 'ok' : undefined}>
            <b>{i < indice ? '✓' : i + 1}</b>
            {p.etiqueta}
          </li>
        ))}
      </ol>
      <div>
        <span className="side__lbl">Lo que ya está</span>
        <ul className="ready" style={{ marginTop: '.6rem' }}>
          {PASOS_DEL_REGISTRO.slice(0, Math.max(indice, 0)).map((p) => (
            <li key={p.ruta} className="ok">
              {p.etiqueta}
            </li>
          ))}
          {indice === 0 ? <li>Nada todavía: empieza por tu cuenta</li> : null}
        </ul>
      </div>
      <div className="side__stats">
        <div>
          <b>2 min</b>
          <span>Para abrir la cuenta</span>
        </div>
        <div>
          <b>0</b>
          <span>Papeles</span>
        </div>
        <div>
          <b>24 h</b>
          <span>Respuesta al expediente</span>
        </div>
      </div>
    </aside>
  );
}

/** Cabecera de la columna del formulario: marca + volver al sitio, como en `login.html`. */
export function CabeceraDeAcceso({ volverA = 'https://atlas.bo', etiqueta = 'Volver al sitio' }: { volverA?: string; etiqueta?: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <div className="auth__top">
      <a href="/bienvenida" className="brand" aria-label="Atlas">
        <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 5 L43 43 H34 L24 21 L14 43 H5 Z" fill="#2BE0A8" />
          <path d="M17.5 31 H30.5 L34 38 H14 Z" fill="#052033" opacity=".55" />
        </svg>
        <span>Atlas</span>
      </a>
      <a href={volverA} className="auth__back">
        ← {etiqueta}
      </a>
    </div>
  );
}
