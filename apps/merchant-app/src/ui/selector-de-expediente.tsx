/**
 * `MerchantPartnerPicker` de la web: sólo aparece si el usuario tiene más de un expediente, y deja
 * claro que TODO lo de la sección es del expediente elegido.
 */
import { SelectField } from '@cliente/ui/form-controls';
import type { MerchantPartner } from '@/features/use-merchant-partner';
import { Aviso } from './aviso';

export function SelectorDeExpediente({ partner }: { partner: MerchantPartner }) {
  if (partner.expedientes.length <= 1) return null;
  return (
    <Aviso tono="info" titulo="Su usuario tiene varios expedientes">
      <SelectField
        label="Todo lo de esta pantalla es del expediente elegido"
        value={partner.partnerId || null}
        onChange={partner.elegir}
        opciones={partner.expedientes.map((perfil) => ({
          valor: perfil.partnerId,
          etiqueta: perfil.tradeName ?? perfil.legalName ?? `Expediente ${perfil.partnerId}`,
          detalle: `Expediente ${perfil.partnerId} · estado ${perfil.status}`,
        }))}
      />
    </Aviso>
  );
}
