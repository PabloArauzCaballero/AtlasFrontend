/**
 * Que build y que update esta ejecutando esta instalacion.
 *
 * Un tester que reporta «no me deja continuar» no sabe decir si tiene el binario de la semana
 * pasada o el update de esta manana, y sin ese dato el bug no se puede reproducir. Aqui se juntan
 * las cuatro cosas que lo identifican: version y numero de build del binario, `runtimeVersion`,
 * canal y update.
 *
 * Solo usa `expo-constants` y `expo-updates`, que ya viajan en el binario. NO usa `expo-application`
 * a proposito: es un modulo nativo nuevo, y un update que lo importara reventaria en las
 * instalaciones anteriores (mismo `runtimeVersion`, sin ese modulo) hasta que cada tester
 * reinstalara.
 *
 * No devuelve nada del usuario ni de la sesion: ni tokens, ni identificadores de cuenta.
 */
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { marca } from '../theme/marca';

export type OrigenDelCodigo = 'update' | 'binario' | 'desarrollo';

export type VersionApp = {
  version: string;
  /** Numero de build del binario (iOS `CFBundleVersion`, Android `versionCode`); `null` en web/Expo Go. */
  build: string | null;
  runtimeVersion: string | null;
  canal: string | null;
  updateId: string | null;
  updateCreadoEn: string | null;
  origen: OrigenDelCodigo;
};

/** Lo que se lee de las librerias, separado para poder probar el armado sin dispositivo. */
export type FuentesDeVersion = {
  version?: string;
  buildIos?: string | null;
  buildAndroid?: number | null;
  actualizacionesActivas: boolean;
  esLanzamientoEmbebido: boolean;
  runtimeVersion?: string | null;
  canal?: string | null;
  updateId?: string | null;
  creadoEn?: Date | null;
};

export function armarVersion(f: FuentesDeVersion): VersionApp {
  const origen: OrigenDelCodigo = !f.actualizacionesActivas ? 'desarrollo' : f.esLanzamientoEmbebido ? 'binario' : 'update';
  return {
    version: f.version ?? '0.0.0',
    build: f.buildIos ?? (f.buildAndroid != null ? String(f.buildAndroid) : null),
    runtimeVersion: f.runtimeVersion ?? null,
    canal: f.canal ?? null,
    // En un lanzamiento embebido `updateId` es el del bundle de fabrica: no es un update publicado.
    updateId: origen === 'update' ? (f.updateId ?? null) : null,
    updateCreadoEn: origen === 'update' && f.creadoEn ? f.creadoEn.toISOString() : null,
    origen,
  };
}

export function leerVersionApp(): VersionApp {
  return armarVersion({
    version: Constants.expoConfig?.version,
    buildIos: Constants.platform?.ios?.buildNumber ?? null,
    buildAndroid: Constants.platform?.android?.versionCode ?? null,
    actualizacionesActivas: Updates.isEnabled,
    esLanzamientoEmbebido: Updates.isEmbeddedLaunch,
    runtimeVersion: Updates.runtimeVersion,
    canal: Updates.channel,
    updateId: Updates.updateId,
    creadoEn: Updates.createdAt,
  });
}

const ORIGEN_LEGIBLE: Record<OrigenDelCodigo, string> = {
  update: 'actualización',
  binario: 'código de fábrica',
  desarrollo: 'desarrollo',
};

/** Una linea corta para la fila del perfil. */
export function resumenDeVersion(v: VersionApp): string {
  const partes = [`${marca.nombre} ${v.version}${v.build ? ` (${v.build})` : ''}`];
  if (v.canal) partes.push(v.canal);
  if (v.updateId) partes.push(`update ${v.updateId.slice(0, 8)}`);
  return partes.join(' · ');
}

/** El bloque completo que el tester pega en su reporte. Sin datos personales. */
export function textoParaSoporte(v: VersionApp): string {
  return [
    `${marca.nombre} ${v.version}${v.build ? ` (build ${v.build})` : ''}`,
    `Runtime: ${v.runtimeVersion ?? 'n/d'}`,
    `Canal: ${v.canal ?? 'n/d'}`,
    `Código en uso: ${ORIGEN_LEGIBLE[v.origen]}`,
    `Update: ${v.updateId ?? 'ninguno (código de fábrica)'}`,
    ...(v.updateCreadoEn ? [`Publicado: ${v.updateCreadoEn}`] : []),
  ].join('\n');
}
