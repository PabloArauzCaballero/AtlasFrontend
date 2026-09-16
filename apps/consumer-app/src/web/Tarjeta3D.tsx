/**
 * La tarjeta de cuenta de la landing (`.acard`): el objeto más reconocible de la marca.
 *
 * Canto que se enciende del lado de la luz, punto especular, reflejo del ambiente, grano y sombra
 * doble, todo atado a dos variables (`--rx`, `--ry`) que aquí salen del puntero: la tarjeta se
 * inclina hacia donde está el ratón y un halo lo sigue. Sin puntero (o sin hover) se mece sola.
 * Sólo web, sólo DOM; el aspecto entero vive en `estilo.ts`.
 */
import { useRef } from 'react';
import { Platform } from 'react-native';

export function Tarjeta3D({
  nombre,
  nivel,
  numero,
  className,
}: {
  /** Lo que va abajo a la izquierda. Sin nombre: «TU NOMBRE», como en el registro de la landing. */
  nombre?: string | null;
  nivel?: string | null;
  /** Los últimos cuatro dígitos, si los hay; si no, puntos. */
  numero?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (Platform.OS !== 'web') return null;

  const mover = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width;
    const y = (event.clientY - r.top) / r.height;
    el.style.setProperty('--rx', ((x - 0.5) * 2).toFixed(3));
    el.style.setProperty('--ry', ((y - 0.5) * 2).toFixed(3));
    el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    el.classList.add('lit');
    el.classList.remove('acard--sway');
  };
  const soltar = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0');
    el.style.setProperty('--ry', '0');
    el.classList.remove('lit');
    el.classList.add('acard--sway');
  };

  return (
    <div
      ref={ref}
      className={`acard acard--sway ${className ?? ''}`}
      onPointerMove={mover}
      onPointerLeave={soltar}
      aria-label={`Tarjeta Atlas de ${nombre ?? 'tu cuenta'}`}
    >
      <div className="acard__top">
        <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 5 L43 43 H34 L24 21 L14 43 H5 Z" fill="#7FEFD6" />
          <path d="M17.5 31 H30.5 L34 38 H14 Z" fill="#052033" opacity="0.55" />
        </svg>
        Atlas
      </div>
      <div className="acard__chip" />
      <div className="acard__no">•••• •••• •••• {numero ?? '••••'}</div>
      <div className="acard__bot">
        <span>{nombre?.trim() ? nombre : 'Tu nombre'}</span>
        <b>{nivel ?? 'Nivel 1'}</b>
      </div>
      <div className="acard__gloss" />
    </div>
  );
}
