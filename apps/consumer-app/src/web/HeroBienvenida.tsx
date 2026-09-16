/**
 * La bienvenida en escritorio: el hero de `index.html`, con la app de verdad dentro del teléfono.
 *
 * Titular a dos líneas con la última palabra en degradado, etiqueta con punto, dos acciones
 * (píldora primaria y de línea), fila de cifras, y a la derecha un teléfono con **la propia web a
 * 390 px** en un iframe —no una imagen— con la tarjeta 3D delante y dos insignias flotantes. Debajo,
 * los cuatro pasos del carrusel del teléfono como tarjetas. Sólo web y sólo desde 1024 px; por
 * debajo se muestra la bienvenida del teléfono. El aspecto vive en `estilo.ts` (`.hero`, `.pasos`).
 */
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { Tarjeta3D } from './Tarjeta3D';

export type PasoDeBienvenida = { titulo: string; cuerpo: string };

export function HeroBienvenida({ pasos }: { pasos: readonly PasoDeBienvenida[] }) {
  const router = useRouter();
  if (Platform.OS !== 'web') return null;

  const ir = (href: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    router.navigate(href as never);
  };

  return (
    <main className="portada">
      <section className="hero" aria-label="Bienvenida">
        <div className="wrap hero__grid">
          <div>
            <a href="/registro" className="tag" onClick={ir('/(onboarding)/registro')}>
              <span className="tag__dot" />
              Sube de nivel y paga menos inicial →
            </a>
            <h1 className="hero__title">
              Compra ahora, paga <em>después</em>.
            </h1>
            <p className="hero__lead">
              Crédito aprobado en segundos para comprar en cientos de tiendas aliadas. Pagas una inicial y el resto en{' '}
              <b>3 cuotas quincenales</b>, con <b>0% de intereses</b>.
            </p>
            <div className="hero__cta">
              <a href="/registro" className="btn btn--primary" onClick={ir('/(onboarding)/registro')}>
                Crear mi cuenta →
              </a>
              <a href="/ingresar" className="btn btn--line" onClick={ir('/(auth)/ingresar')}>
                Ya tengo cuenta
              </a>
            </div>
            <div className="hero__stats">
              <div>
                <b>60s</b>
                <span>Aprobación</span>
              </div>
              <div>
                <b>0%</b>
                <span>Intereses</span>
              </div>
              <div>
                <b>500+</b>
                <span>Comercios</span>
              </div>
            </div>
          </div>
          <div className="hero__visual" aria-hidden="true">
            <div className="hero__badge hero__badge--ok">
              <i>✓</i>
              <div>
                Aprobado
                <small>en 42 segundos</small>
              </div>
            </div>
            <div className="hero__badge hero__badge--bs">Bs</div>
            <div className="phone">
              <div className="phone__notch" />
              {/* La app real, a 390 px: lo que ve quien la abre en el teléfono. */}
              <iframe title="La app Atlas" src="/bienvenida?marco=telefono" loading="lazy" tabIndex={-1} />
            </div>
            <div className="hero__card">
              <Tarjeta3D nombre="V. Méndez" nivel="Nivel 3" numero="4821" />
            </div>
          </div>
        </div>
      </section>
      <section className="pasos" aria-label="Cómo funciona">
        {pasos.map((paso, i) => (
          <article className="paso" key={paso.titulo}>
            <i>{i + 1}</i>
            <h3>{paso.titulo}</h3>
            <p>{paso.cuerpo}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
