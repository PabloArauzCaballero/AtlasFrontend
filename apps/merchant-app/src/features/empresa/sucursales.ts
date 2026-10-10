/**
 * El PDF de «Sucursales» y las piezas de la fila de una sucursal que no son pantalla.
 * Fuente: `components/screens/MerchantStructureScreen.tsx` del portal web.
 */
import type { ResourceRow } from '@/api/types';
import { tablaPdf, type DocumentoPdf } from '@/features/pdf';
import { estadoBnplSucursal } from './cajas';

export function documentoSucursales(branchRows: readonly ResourceRow[]): DocumentoPdf {
  return {
    title: 'Sucursales del comercio',
    subtitle: `Portal del comercio · ${branchRows.length} sucursal(es)`,
    summary: [
      { label: 'Sucursales', value: branchRows.length },
      { label: 'Activas', value: branchRows.filter((fila) => String(fila.status) === 'ACTIVE').length },
      { label: 'Originan BNPL', value: branchRows.filter((fila) => Boolean(fila.canOriginateBnpl)).length },
    ],
    sections: [
      {
        title: 'Sucursales registradas',
        table: tablaPdf(
          [
            { key: 'name', label: 'Sucursal' },
            { key: 'city', label: 'Ciudad' },
            { key: 'address', label: 'Dirección' },
            { key: 'bnpl', label: 'BNPL' },
            { key: 'status', label: 'Estado' },
          ],
          branchRows.map((fila) => ({ ...fila, bnpl: estadoBnplSucursal(fila).texto })),
        ),
      },
    ],
  };
}

/** «Sin ciudad · Av. Principal», la línea de debajo del nombre en la lista. */
export function lineaDeUbicacion(branch: ResourceRow): string {
  return `${String(branch.city ?? 'Sin ciudad')}${branch.address ? ` · ${String(branch.address)}` : ''}`;
}

/** El cuerpo del alta (`formDataToPayload` con `name` obligatorio y `city`/`address` opcionales). */
export function cuerpoDeAlta(campos: { name: string; city: string; address: string }): Record<string, string> {
  const cuerpo: Record<string, string> = { name: campos.name.trim() };
  if (campos.city.trim()) cuerpo.city = campos.city.trim();
  if (campos.address.trim()) cuerpo.address = campos.address.trim();
  return cuerpo;
}

/** Las ciudades del select de la edición: la guardada se conserva aunque no esté en el catálogo. */
export function ciudadesParaEditar<T extends { valor: string; etiqueta: string }>(ciudades: readonly T[], guardada: unknown): { valor: string; etiqueta: string }[] {
  const actual = guardada ? String(guardada) : '';
  const lista: { valor: string; etiqueta: string }[] = [...ciudades];
  if (actual && !ciudades.some((opcion) => opcion.valor === actual)) lista.push({ valor: actual, etiqueta: `${actual} (valor anterior)` });
  return [{ valor: '', etiqueta: '— Elija la ciudad —' }, ...lista];
}
