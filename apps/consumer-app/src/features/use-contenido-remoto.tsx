import { useEffect, useMemo, useState } from 'react';
import { getContent, type ContentEntry } from '../api/endpoints/app-content';
import { TrustCard, type TrustItem } from '../ui/trust-card';
import { TOUR_INICIO_STEPS } from './tour-inicio';
import { fusionarPrivacidad, fusionarTour, indexarPorClave, trustDesdeContenido, type PorClave } from './contenido-remoto';
import { PRIVACIDAD_DE_FABRICA } from './privacidad-copy';

/*
  Una petición por superficie y por arranque de la app, no una por pantalla: el alta monta cinco
  pantallas con la misma superficie `signup`, y el recorrido se pide desde tres sitios. `getContent`
  nunca lanza (devuelve `[]`), así que la promesa guardada no puede quedar rechazada.
*/
const PEDIDAS = new Map<string, Promise<ContentEntry[]>>();

export function contenidoDe(superficie: string): Promise<ContentEntry[]> {
  let pedida = PEDIDAS.get(superficie);
  if (!pedida) {
    pedida = getContent(superficie).then((entries) => {
      // Una respuesta vacía no se recuerda: si falló la red, la siguiente pantalla vuelve a intentarlo.
      if (entries.length === 0) PEDIDAS.delete(superficie);
      return entries;
    });
    PEDIDAS.set(superficie, pedida);
  }
  return pedida;
}

/** Sólo para pruebas: vuelve a pedir al servidor. */
export function olvidarContenidoPedido(): void {
  PEDIDAS.clear();
}

export function useContenido(superficie: string): ContentEntry[] {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  useEffect(() => {
    let cancelado = false;
    void contenidoDe(superficie).then((cargado) => {
      if (!cancelado) setEntries(cargado);
    });
    return () => {
      cancelado = true;
    };
  }, [superficie]);
  return entries;
}

export function useContenidoPorClave(superficie: string): PorClave {
  const entries = useContenido(superficie);
  return useMemo(() => indexarPorClave(entries), [entries]);
}

/** Los pasos del recorrido de Inicio, con el texto del portal donde lo haya. */
export function useTourInicio() {
  const porClave = useContenidoPorClave('tour');
  return useMemo(() => fusionarTour(TOUR_INICIO_STEPS, porClave), [porClave]);
}

/** Los textos de «Tus datos», con los del portal donde los haya. */
export function usePrivacidadCopy() {
  const porClave = useContenidoPorClave('privacy');
  return useMemo(() => fusionarPrivacidad(PRIVACIDAD_DE_FABRICA, porClave), [porClave]);
}

/** «Por qué te pedimos esto» de una pantalla del alta: lo del portal, o el texto de fábrica entero. */
export function TrustCardRemoto({ grupo, base }: { grupo: string; base: TrustItem[] }) {
  const entries = useContenido('signup');
  const items = useMemo(() => trustDesdeContenido(grupo, entries, base), [grupo, entries, base]);
  return <TrustCard items={items} />;
}
