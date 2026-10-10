/**
 * Las listas de opciones de «Mi empresa»: el rubro, la entidad bancaria y la ciudad.
 *
 * Es `services/domains.ts` + `hooks/useOptions.ts` de la web, reducido a lo que usa esta sección:
 *  - `domain:*` es vocabulario del negocio y lo publica el backend (`GET catalog/domains`). La
 *    pantalla no lleva su propia copia: el día que se añade un rubro, aparece solo.
 *  - `catalog:city` es la lista estática del ERP (`lib/catalogs.ts`).
 *
 * Un dominio que el backend no publica es un ERROR, no una lista vacía: un select obligatorio vacío
 * es un formulario imposible que no dice por qué (ver `useOptions` de la web). El fallo se devuelve
 * para pintarlo junto al campo; la web además lanza un aviso flotante.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiRequest, mensajeDeError } from '@/api/client';
import type { OpcionSelect } from '@cliente/ui/form-controls';
import { CIUDADES } from './importacion';

export interface DomainOption {
  code: string;
  label: string;
  help?: string;
}

export type FuenteDeOpciones = `domain:${string}` | 'catalog:city';

let memoria: Record<string, DomainOption[]> | null = null;
let enCurso: Promise<Record<string, DomainOption[]>> | null = null;

/** Todos los dominios. La primera llamada viaja; las demás esperan a esa o leen de memoria. */
export function cargarDominios(): Promise<Record<string, DomainOption[]>> {
  if (memoria) return Promise.resolve(memoria);
  if (!enCurso) {
    enCurso = apiRequest<{ domains: Record<string, DomainOption[]> }>('catalog/domains')
      .then((respuesta) => {
        if (!respuesta || typeof respuesta.domains !== 'object' || respuesta.domains === null) {
          throw new ApiError('No pudimos traer las listas de opciones. Recargue la página; si sigue igual, avísele a soporte.', 0);
        }
        memoria = respuesta.domains;
        return respuesta.domains;
      })
      .finally(() => {
        enCurso = null;
      });
  }
  return enCurso;
}

/** Olvida lo cargado: al tirar hacia abajo se vuelven a pedir, por si el backend publicó otras. */
export function olvidarDominios(): void {
  memoria = null;
}

export async function resolverOpciones(fuente: FuenteDeOpciones): Promise<OpcionSelect[]> {
  if (fuente === 'catalog:city') return CIUDADES.map((opcion) => ({ valor: opcion.value, etiqueta: opcion.label }));
  const nombre = fuente.slice('domain:'.length);
  const dominios = await cargarDominios();
  const dominio = dominios[nombre];
  if (!dominio) throw new Error(`El servidor no publica el dominio «${nombre}».`);
  return dominio.map((opcion) => ({ valor: opcion.code, etiqueta: opcion.label, ...(opcion.help ? { detalle: opcion.help } : {}) }));
}

export interface Opciones {
  opciones: OpcionSelect[];
  /** Por qué está vacía, cuando lo está por un fallo. `null` + vacía = catálogo vacío de verdad. */
  error: string | null;
  reintentar: () => void;
}

export function useOpciones(fuente: FuenteDeOpciones): Opciones {
  const [opciones, setOpciones] = useState<OpcionSelect[]>(() => (fuente === 'catalog:city' ? CIUDADES.map((o) => ({ valor: o.value, etiqueta: o.label })) : []));
  const [error, setError] = useState<string | null>(null);
  // Descarta respuestas de una carga anterior: un reintento rápido no puede quedarse con la vieja.
  const peticion = useRef(0);

  const cargar = useCallback(() => {
    const id = peticion.current + 1;
    peticion.current = id;
    setError(null);
    resolverOpciones(fuente)
      .then((resultado) => {
        if (peticion.current === id) setOpciones(resultado);
      })
      .catch((fallo: unknown) => {
        if (peticion.current !== id) return;
        setOpciones([]);
        setError(mensajeDeError(fallo, fallo instanceof Error ? fallo.message : 'No se pudieron cargar las opciones.'));
      });
  }, [fuente]);

  useEffect(() => {
    cargar();
    return () => {
      peticion.current += 1;
    };
  }, [cargar]);

  return { opciones, error, reintentar: cargar };
}

/** `withEmpty` de la web: la opción vacía delante, con su rótulo. */
export function conVacia(opciones: OpcionSelect[], etiqueta: string): OpcionSelect[] {
  return [{ valor: '', etiqueta }, ...opciones];
}
