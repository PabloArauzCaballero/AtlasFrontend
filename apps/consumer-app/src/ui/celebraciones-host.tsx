/**
 * El anfitrión de las celebraciones: montado UNA vez en el layout del área autenticada, mira el progreso en el momento
 * justo y, si hay algo nuevo, lo celebra encima de cualquier pantalla (`celebracion-logro.tsx`).
 *
 * Cuándo mira y cuándo muestra está razonado en `features/celebraciones.ts`. En corto: mira al abrir la app, al volver a
 * ella y cada vez que la persona llega a una pantalla tranquila (con un respiro entre miradas para no pedirle al servidor
 * el progreso en cada navegación); muestra sólo en pantallas tranquilas y con el recorrido guiado apagado.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as creditLineApi from '../api/endpoints/credit-line';
import { esRutaTranquila, pendientesDeCelebrar, type Logro, type Vistos } from '../features/celebraciones';
import { suscribirCelebraciones } from '../features/celebraciones-bus';
import { useSession } from '../session/session';
import { CartaDeInsignia } from './carta-de-insignia';
import { CelebracionDeLogro } from './celebracion-logro';
import { useTour } from './tour';

/** Entre miradas al servidor, como mínimo, para que navegar rápido no pida el progreso en cada paso. */
export const RESPIRO_MS = 20_000;
/** Lo que se espera tras llegar a un sitio tranquilo antes de celebrar: que la pantalla termine de entrar. */
export const ESPERA_MS = 900;

const clave = (customerId: string) => `atlas.logros.vistos.v1:${customerId}`;

async function leerVistos(customerId: string): Promise<Vistos | null> {
  try {
    const crudo = await AsyncStorage.getItem(clave(customerId));
    if (!crudo) return null;
    const v = JSON.parse(crudo) as Partial<Vistos>;
    return Array.isArray(v.insignias) ? { insignias: v.insignias.filter((x) => typeof x === 'string'), nivel: typeof v.nivel === 'string' ? v.nivel : null } : null;
  } catch {
    return null;
  }
}

async function guardarVistos(customerId: string, vistos: Vistos) {
  try {
    await AsyncStorage.setItem(clave(customerId), JSON.stringify(vistos));
  } catch {
    // Sin disco no se recuerda: lo peor es repetir una fiesta, nunca perder una insignia.
  }
}

const idDe = (l: Logro) => (l.tipo === 'insignia' ? `i:${l.insignia.code}` : `n:${l.nivel.id}`);

export function CelebracionesHost() {
  const { customerId } = useSession();
  const pathname = usePathname();
  const tour = useTour();
  const [cola, setCola] = useState<Logro[]>([]);
  const [mas, setMas] = useState(0);
  const [repeticion, setRepeticion] = useState<Logro | null>(null);
  const [carta, setCarta] = useState<Logro | null>(null);
  const [listo, setListo] = useState(false);
  const ultima = useRef(0);
  const enCurso = useRef(false);

  const revisar = useCallback(
    async (forzar = false) => {
      if (!customerId || enCurso.current) return;
      if (!forzar && Date.now() - ultima.current < RESPIRO_MS) return;
      enCurso.current = true;
      ultima.current = Date.now();
      try {
        const progress = await creditLineApi.getProgress(customerId);
        if (!progress?.experience?.badges) return;
        const { logros, masSinMostrar, siguiente } = pendientesDeCelebrar(progress, await leerVistos(customerId));
        // Se anota ANTES de mostrar: si la app se cierra a media fiesta, no se repite al volver.
        await guardarVistos(customerId, siguiente);
        if (logros.length > 0) {
          setCola((previa) => [...previa, ...logros.filter((l) => !previa.some((p) => idDe(p) === idDe(l)))]);
          setMas((previo) => previo + masSinMostrar);
        }
      } catch {
        // Sin red no hay celebración: se mirará de nuevo en la próxima pantalla tranquila.
      } finally {
        enCurso.current = false;
      }
    },
    [customerId],
  );

  // Al abrir la app (con un momento para que asiente), al volver a ella y cuando alguien lo pide.
  useEffect(() => {
    const t = setTimeout(() => void revisar(), 1800);
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void revisar();
    });
    const baja = suscribirCelebraciones({
      revisar: () => setTimeout(() => void revisar(true), 700),
      repetir: (logro) => setRepeticion(logro),
      carta: (logro) => setCarta(logro),
    });
    return () => {
      clearTimeout(t);
      suscripcion.remove();
      baja();
    };
  }, [revisar]);

  const tranquila = esRutaTranquila(pathname);
  // Al llegar a una pantalla tranquila: mirar si hay algo nuevo (por ejemplo, al volver de pagar o de comprar).
  useEffect(() => {
    if (tranquila) void revisar();
  }, [pathname, tranquila, revisar]);

  // Mostrar sólo tras un respiro en un sitio tranquilo, y nunca encima del recorrido guiado.
  const hayCola = cola.length > 0;
  useEffect(() => {
    if (!hayCola || !tranquila || tour.activo) {
      setListo(false);
      return;
    }
    const t = setTimeout(() => setListo(true), ESPERA_MS);
    return () => clearTimeout(t);
  }, [hayCola, tranquila, tour.activo, pathname]);

  if (carta && carta.tipo === 'insignia' && !repeticion)
    return (
      <CartaDeInsignia
        logro={carta}
        onCerrar={() => setCarta(null)}
        onRevivir={() => {
          setRepeticion(carta);
          setCarta(null);
        }}
      />
    );
  if (repeticion) return <CelebracionDeLogro logro={repeticion} posicion={{ actual: 1, total: 1 }} onCerrar={() => setRepeticion(null)} />;
  if (!hayCola || !listo) return null;
  return (
    <CelebracionDeLogro
      key={idDe(cola[0]!)}
      logro={cola[0]!}
      posicion={{ actual: 1, total: cola.length }}
      masSinMostrar={mas}
      onCerrar={() => {
        setCola((previa) => previa.slice(1));
        if (cola.length <= 1) setMas(0);
      }}
    />
  );
}
