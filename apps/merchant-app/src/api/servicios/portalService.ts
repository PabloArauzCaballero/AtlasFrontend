import { requireUuidPathParam } from '@/api/apiPath';
import { apiRequest } from '@/api/client';
import type { JsonObject, ResourceRow } from '@/api/types';

/**
 * Valida el identificador SÓLO cuando viene.
 *
 * Los endpoints del portal aceptan la cuenta como opcional a propósito: el comercio no la manda
 * —su alcance lo deriva el backend de sus membresías— y el staff interno sí debe mandarla. Enviar
 * una cadena vacía sería peor que no enviar nada: el backend la rechazaría por formato en vez de
 * derivar el alcance.
 */
function optionalUuid(value: string | undefined, description: string): string | undefined {
  return value ? requireUuidPathParam(value, description) : undefined;
}

export const portalService = {
  listPlans() {
    return apiRequest<ResourceRow[]>('/portal/plans');
  },
  createPlan(body: JsonObject) {
    return apiRequest<ResourceRow>('/portal/plans', { method: 'POST', body });
  },
  /** Cambia la tarifa. Alcanza a los comercios ya suscritos: la suscripción apunta al plan. */
  updatePlan(planId: string, body: JsonObject) {
    const id = requireUuidPathParam(planId, 'el UUID de la tarifa');
    return apiRequest<ResourceRow>(`/portal/plans/${id}`, { method: 'PATCH', body });
  },
  /** Catálogo de lo que Atlas factura. De sólo lectura: el precio se configura en la tarifa. */
  listBillingProducts(includeInactive = false) {
    return apiRequest<ResourceRow[]>('/portal/billing-products', {
      query: { includeInactive: includeInactive ? 'true' : 'false' },
    });
  },
  getSubscription(merchantAccountId?: string) {
    const id = optionalUuid(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow | null>('/portal/subscription', { query: { merchantAccountId: id } });
  },
  subscribe(body: JsonObject) {
    return apiRequest<ResourceRow>('/portal/subscription', { method: 'POST', body });
  },
  /** Lo que este comercio le debe a Atlas: la comision de cada venta. */
  commissions(merchantAccountId?: string) {
    const id = optionalUuid(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<{
      summary: { chargedTotal: string; owedToAtlas: string; settled: string; salesCharged: number };
      commissions: { id: string; purchaseId: string; amountCharged: string; amountOpen: string; currency: string; issuedAt: string; dueDate: string; status: string }[];
    }>('/portal/commissions', { query: { merchantAccountId: id } });
  },
  listBranches(accountId?: string) {
    const id = optionalUuid(accountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow[]>('/portal/branches', { query: { accountId: id } });
  },
  /**
   * Sobre qué comercios puede operar quien mira, según el SERVIDOR.
   *
   * El portal no puede deducirlo: lo hacía a partir de un valor que el propio navegador se guardó
   * al entrar, y cuando ese valor y el token no coincidían la pantalla se quedaba sin salida —se
   * creía comercio, no pintaba selector, y el backend le exigía una cuenta que nadie iba a poder
   * elegir—.
   */
  getScope() {
    return apiRequest<{
      isInternalOperator: boolean;
      requiresAccountSelection: boolean;
      accounts: { id: string; name: string }[];
    }>('/portal/scope');
  },
  getBilling(merchantAccountId?: string) {
    const id = optionalUuid(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow>('/portal/billing', { query: { merchantAccountId: id } });
  },
  /** Una factura del comercio con sus líneas, para descargarla desde el portal. */
  getBillingInvoice(invoiceId: string, merchantAccountId?: string) {
    const id = requireUuidPathParam(invoiceId, 'el UUID de la factura');
    const account = optionalUuid(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow>(`/portal/billing/invoices/${id}`, { query: { merchantAccountId: account } });
  },
  /*
   * Alta, edición y baja de sucursales por el propio comercio.
   *
   * Van por `/portal/*` y no por `/b2b/*`: el canal interno le devolvía 403 al comercio, que es por
   * lo que su pantalla de sucursales sólo sabía mirar. La cuenta la deriva el backend de sus
   * membresías; sólo el staff interno manda `merchantAccountId`, y sólo para los comercios que ya
   * puede ver.
   */
  createBranch(body: JsonObject) {
    return apiRequest<ResourceRow>('/portal/branches', { method: 'POST', body });
  },
  updateBranch(branchId: string, body: JsonObject) {
    const id = requireUuidPathParam(branchId, 'el UUID de la sucursal');
    return apiRequest<ResourceRow>(`/portal/branches/${id}`, { method: 'PATCH', body });
  },
  setBranchStatus(branchId: string, status: 'ACTIVE' | 'INACTIVE') {
    const id = requireUuidPathParam(branchId, 'el UUID de la sucursal');
    return apiRequest<ResourceRow>(`/portal/branches/${id}/status`, { method: 'PATCH', body: { status } });
  },
  listAdvertisers(merchantAccountId?: string) {
    const id = optionalUuid(merchantAccountId, 'el UUID de la cuenta merchant');
    return apiRequest<ResourceRow[]>('/portal/advertisers', { query: { merchantAccountId: id } });
  },
  listCampaigns(advertiserId: string) {
    const id = requireUuidPathParam(advertiserId, 'el UUID del anunciante');
    return apiRequest<ResourceRow[]>('/portal/campaigns', { query: { advertiserId: id } });
  },
  setCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED') {
    const id = requireUuidPathParam(campaignId, 'el UUID de la campaña');
    return apiRequest<ResourceRow>(`/portal/campaigns/${id}/status`, { method: 'PATCH', body: { status } });
  },
};
