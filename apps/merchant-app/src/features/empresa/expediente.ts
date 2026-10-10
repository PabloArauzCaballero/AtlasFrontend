/**
 * Lo que «Mi empresa» decide sin pantalla: qué se manda de un formulario, qué opciones lleva el
 * rubro, dónde se resuelve cada requisito y el PDF de la vista.
 *
 * Vive aparte de los componentes por lo mismo que en la web vive en `lib/`: es lo que se puede
 * equivocar en silencio —mandar un `""` que el contrato rechaza, pisar un rubro fuera de catálogo—
 * y desde aquí se prueba sin montar React. Fuente: `components/screens/PartnerDossierScreen.tsx` y
 * `PartnerDossierPanels.tsx` del portal web.
 */
import type { JsonObject } from '@/api/types';
import type { PartnerOnboardingState } from '@/api/servicios/partnerOnboardingService';
import { tablaPdf, type DocumentoPdf } from '@/features/pdf';
import type { OpcionSelect } from '@cliente/ui/form-controls';

/** Las pestañas de «Mi empresa», en el orden y con el `?tab=` de la web. */
export const PESTANAS_EMPRESA = ['estado', 'ficha', 'qr', 'sucursales'] as const;
export type PestanaEmpresa = (typeof PESTANAS_EMPRESA)[number];

/**
 * Los campos escritos, sin los vacíos.
 *
 * Se descarta la cadena vacía en vez de mandarla: los campos opcionales del contrato exigen un
 * mínimo de longitud, y un `""` se rechaza con un error que no describe lo que pasó —el usuario
 * simplemente no rellenó algo que no era obligatorio—.
 */
export function camposEscritos(campos: Record<string, string | null | undefined>): JsonObject {
  const payload: JsonObject = {};
  for (const [name, value] of Object.entries(campos)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed !== '') payload[name] = trimmed;
  }
  return payload;
}

/**
 * Las opciones de rubro, garantizando que la GUARDADA esté entre ellas: un select sin el valor
 * actual lo enseña como «Sin definir», y guardar la ficha sin tocarlo pisaría el bueno.
 */
export function opcionesDeRubro(actual: string | null, rubros: OpcionSelect[]): OpcionSelect[] {
  const opciones: OpcionSelect[] = [{ etiqueta: '— Sin definir —', valor: '' }, ...rubros];
  if (actual && !rubros.some((opcion) => opcion.valor === actual)) {
    opciones.push({ etiqueta: `${actual} (fuera de catálogo)`, valor: actual });
  }
  return opciones;
}

/** El tono de un estado de QR o de terminal (`toneForStatus` de la web). */
export function tonoDeEstado(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'pending_review' || status === 'registered') return 'warning';
  if (status === 'rejected' || status === 'suspended') return 'danger';
  return 'neutral';
}

/**
 * Dónde se resuelve cada requisito que NO se resuelve en «Estado del expediente»: otra pestaña de
 * esta misma pantalla. Sin el enlace, el aviso dice qué falta y no dónde darlo.
 */
export const DONDE_SE_RESUELVE: Record<string, { tab: PestanaEmpresa; label: string }> = {
  branch: { tab: 'sucursales', label: 'Sucursales' },
  business_qr: { tab: 'qr', label: 'Mi QR de cobro' },
  bank_qr: { tab: 'qr', label: 'Mi QR de cobro' },
};

/** «Falta 1 requisito…» / «Falta 3 requisitos…», como en la web. */
export function tituloDeHuecos(cuantos: number): string {
  return `Falta ${cuantos} ${cuantos === 1 ? 'requisito' : 'requisitos'} para enviar a revisión`;
}

/** Un correo con forma de correo: lo que comprueba el navegador en `type="email"` antes de enviar. */
export function pareceCorreo(texto: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(texto.trim());
}

/** El PDF de «Mi empresa», campo a campo como lo arma la web. */
export function documentoMiEmpresa(state: PartnerOnboardingState): DocumentoPdf {
  const branches = state.branches ?? [];
  return {
    title: 'Mi empresa',
    subtitle: `${state.profile.legalName} · NIT ${state.profile.taxId}`,
    summary: [
      { label: 'Estado', value: state.profile.onboardingStatus },
      { label: 'Sucursales', value: branches.length },
      { label: 'Terminales', value: (state.posTerminals ?? []).length },
      { label: 'QR registrados', value: (state.qrCodes ?? []).length },
    ],
    ...(state.gaps.length
      ? {
          notices: [
            {
              level: 'caution' as const,
              title: 'Expediente incompleto',
              text: `Faltan ${state.gaps.length} requisito(s) por cubrir antes de poder enviarlo a revisión.`,
            },
          ],
        }
      : {}),
    sections: [
      {
        title: 'Ficha comercial',
        fields: [
          { label: 'Razón social', value: state.profile.legalName },
          { label: 'Nombre comercial', value: state.profile.tradeName ?? '—' },
          { label: 'NIT', value: state.profile.taxId },
          { label: 'Rubro', value: state.profile.businessCategory ?? '—' },
          { label: 'Correo de contacto', value: state.profile.contactEmail },
          { label: 'Teléfono', value: state.profile.contactPhone ?? '—' },
        ],
      },
      {
        title: 'Sucursales',
        table: tablaPdf(
          [
            { key: 'branchCode', label: 'Código' },
            { key: 'name', label: 'Sucursal' },
            { key: 'addressLine', label: 'Dirección' },
          ],
          branches as unknown as Record<string, unknown>[],
        ),
      },
      {
        title: 'Terminales POS',
        table: tablaPdf(
          [
            { key: 'terminalSerial', label: 'Serial' },
            { key: 'manualCode', label: 'Código a mano' },
            { key: 'terminalAlias', label: 'Alias' },
            { key: 'status', label: 'Estado' },
          ],
          (state.posTerminals ?? []) as unknown as Record<string, unknown>[],
        ),
      },
    ],
  };
}
