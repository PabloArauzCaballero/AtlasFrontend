/**
 * Crear UNA sucursal importada, por el mismo camino que un alta a mano: sucursal en el ERP,
 * declarada en el expediente y cada caja registrada en ella. Es el `submit` de
 * `ImportarSucursalesModal` de la web.
 *
 * **Reintentar no duplica.** Lo que ya existe se reutiliza —la sucursal por su nombre, la caja por
 * su serial— y sólo se crea lo que falta, así que tras un fallo a medias basta corregir el Excel y
 * volver a subirlo entero.
 */
import { mensajeDeError } from '@/api/client';
import { partnerOnboardingService } from '@/api/servicios/partnerOnboardingService';
import { portalService } from '@/api/servicios/portalService';
import type { JsonObject, ResourceRow } from '@/api/types';
import { codigoDeExpediente, crearCajas } from './cajas';
import { plano } from './importacion';

export async function importarSucursal(payload: JsonObject, contexto: { partnerId: string; accountId: string | undefined }): Promise<unknown> {
  const { partnerId, accountId } = contexto;
  if (!partnerId) {
    // Antes de crear NADA: sin expediente la sucursal quedaría en el ERP sin poder tener caja ni QR.
    throw new Error('Abre primero el expediente de tu empresa (pestaña «Estado del expediente»): de él cuelgan las cajas y sus QR.');
  }
  const nombre = String(payload.name ?? '').trim();
  const cajas = ((payload.cajas as JsonObject[] | undefined) ?? []).filter((caja) => String(caja.terminalSerial ?? '').trim());

  // Se relee en cada sucursal: las anteriores del mismo archivo ya cambiaron el estado.
  const existentes = (await portalService.listBranches(accountId)) as ResourceRow[];
  let sucursal: ResourceRow | undefined = existentes.find((fila) => plano(fila.name) === plano(nombre));
  if (!sucursal) {
    sucursal = await portalService.createBranch({
      name: nombre,
      ...(payload.city ? { city: String(payload.city) } : {}),
      ...(payload.address ? { address: String(payload.address) } : {}),
    });
  }
  const erpBranchId = String(sucursal.id);

  let estado = await partnerOnboardingService.getState(partnerId);
  let local = estado.branches.find((fila) => fila.erpBranchId === erpBranchId);
  if (!local) {
    local = await partnerOnboardingService.registerBranch(partnerId, {
      erpBranchId,
      branchCode: codigoDeExpediente(erpBranchId),
      name: nombre,
      ...(payload.city ? { city: String(payload.city) } : {}),
      ...(payload.address ? { addressLine: String(payload.address) } : {}),
    });
  }
  const branchId = local.branchId;

  // Sin seriales en el archivo manda «Cantidad de cajas» (1 si está vacía): se crean las que falten.
  if (cajas.length === 0) {
    const cajasDelLocal = estado.posTerminals.filter((pos) => pos.branchId === branchId);
    const deseadas = Number.isFinite(Number(payload.cantidadCajas)) && String(payload.cantidadCajas ?? '') !== '' ? Number(payload.cantidadCajas) : 1;
    const faltan = Math.max(0, deseadas - cajasDelLocal.length);
    if (faltan > 0) {
      await crearCajas({ partnerId, branchId, erpBranchId, nombreSucursal: nombre, cantidad: faltan, existentes: cajasDelLocal });
    }
  }

  const yaRegistradas = new Set(estado.posTerminals.map((pos) => plano(pos.terminalSerial)));
  for (const caja of cajas) {
    const serial = String(caja.terminalSerial).trim();
    if (yaRegistradas.has(plano(serial))) continue;
    const alias = String(caja.terminalAlias ?? '').trim();
    try {
      await partnerOnboardingService.registerPosTerminal(partnerId, branchId, {
        terminalSerial: serial,
        ...(alias ? { terminalAlias: alias } : {}),
      });
    } catch (error) {
      throw new Error(
        `«${nombre}» quedó registrada, pero la caja ${serial} no: ${mensajeDeError(error, 'error desconocido')}. ` +
          'Corrige el serial y vuelve a subir el archivo: lo que ya existe no se repite.',
      );
    }
    yaRegistradas.add(plano(serial));
  }
  estado = await partnerOnboardingService.getState(partnerId);
  return estado;
}
