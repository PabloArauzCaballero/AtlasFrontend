/**
 * La cáscara de escritorio: la barra superior de la landing, para el área de cliente.
 *
 * Marca a la izquierda, menú central con la píldora que persigue al destino activo (los mismos
 * cinco de las pestañas del teléfono), chip de cuenta y «Escanear QR» como acción primaria a la
 * derecha, y un pie sobrio. Sólo web y sólo desde 600 px: por debajo, las pestañas del teléfono.
 * El aspecto entero vive en `estilo.ts` (`.nav`, `.pie`).
 */
import { LETRA_A, LIENZO_SIMBOLO } from '../ui/marca-letra';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSession } from '../session/session';
import { color, marca } from '../theme/tokens';

const DESTINOS = [
  { href: '/', etiqueta: 'Inicio' },
  { href: '/escanear', etiqueta: 'Escanear' },
  { href: '/pagos', etiqueta: 'Pagos' },
  { href: '/avisos', etiqueta: 'Avisos' },
  { href: '/perfil', etiqueta: 'Perfil' },
] as const;

function inicialDe(nombre: string | null | undefined, identificador: string | null | undefined): string {
  const base = (nombre ?? identificador ?? 'A').trim();
  return (base[0] ?? 'A').toUpperCase();
}

export function BarraSuperior() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const menu = useRef<HTMLElement>(null);

  const nombre = session.me?.profile?.firstName ?? session.profile?.displayName ?? null;
  const identificador = session.profile?.identifier ?? null;

  /*
    La píldora se mueve hasta el enlace activo: se mide en el DOM y se escribe como variables CSS.
    Se vuelve a medir al cambiar el tamaño de la ventana, porque en tableta el menú pasa a su propia
    fila y los enlaces cambian de sitio (un solo oyente, sin medir en cada render).
  */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const contenedor = menu.current;
    if (!contenedor) return;
    const colocar = () => {
      const activo = contenedor.querySelector<HTMLElement>('[aria-current="page"]');
      if (!activo) {
        contenedor.style.setProperty('--po', '0');
        return;
      }
      contenedor.style.setProperty('--px', `${activo.offsetLeft}px`);
      contenedor.style.setProperty('--pw', `${activo.offsetWidth}px`);
      contenedor.style.setProperty('--po', '1');
    };
    colocar();
    window.addEventListener('resize', colocar);
    return () => window.removeEventListener('resize', colocar);
  }, [pathname]);

  if (Platform.OS !== 'web') return null;

  const ir = (href: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    router.navigate(href as never);
  };

  return (
    <header className="nav" role="banner">
      <div className="nav__inner">
        <a href="/" className="brand" onClick={ir('/')} aria-label="Atlas — inicio">
          <svg width="34" height="34" viewBox={LIENZO_SIMBOLO} aria-hidden="true">
            <defs>
              <linearGradient id="nav-marca" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={color.brand.b500} />
                <stop offset=".55" stopColor={color.brand.b400} />
                <stop offset="1" stopColor={color.brand.b300} />
              </linearGradient>
            </defs>
            <path d={LETRA_A.silueta} fill="url(#nav-marca)" />
            <path d={LETRA_A.travesano} fill={color.brand.b900} opacity=".55" />
          </svg>
          <span>{marca.nombre}</span>
        </a>

        <nav className="nav__menu" ref={menu} aria-label="Secciones">
          <span className="nav__pill" aria-hidden="true" />
          {DESTINOS.map((d) => (
            <a
              key={d.href}
              href={d.href}
              className="nav__link"
              aria-current={pathname === d.href ? 'page' : undefined}
              onClick={ir(d.href)}
            >
              {d.etiqueta}
            </a>
          ))}
        </nav>

        <a href="/perfil" className="nav__cuenta" onClick={ir('/perfil')} aria-label="Tu cuenta">
          <span className="nav__avatar" aria-hidden="true">
            {inicialDe(nombre, identificador)}
          </span>
          <span>{nombre ?? 'Tu cuenta'}</span>
        </a>
        <a href="/escanear" className="nav__cta" onClick={ir('/escanear')}>
          Escanear QR
        </a>
        <button type="button" className="nav__salir" onClick={() => void session.signOut()}>
          Salir
        </button>
      </div>
    </header>
  );
}

export function Pie() {
  if (Platform.OS !== 'web') return null;
  const anio = new Date().getFullYear();
  return (
    <footer className="pie">
      <span>© {anio} Atlas · Santa Cruz, Bolivia</span>
      <span>
        <a href="/privacidad">Privacidad</a> · <a href="/politica-mora">Política de mora</a> · <a href="/ayuda">Ayuda</a>
      </span>
    </footer>
  );
}
