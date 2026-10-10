/**
 * «Negocio»: con cuál de sus expedientes sigue quien administra más de uno. Es el `FormField` que la
 * web pinta en «Consumo y facturación» (`name="partnerProfileId"`), con sus mismos textos.
 *
 * Aquí vale para las DOS vistas de la sección, y no sólo para facturación: la web de «Mi cartera» se
 * queda siempre con el primer expediente sin decirlo, y así una vista podía hablar de un negocio y
 * la de al lado de otro. Con un solo expediente no se pregunta nada.
 */
import { SelectField } from '@cliente/ui/form-controls';
import { Card } from '@cliente/ui/primitives';
import type { MerchantPartner } from '@/features/use-merchant-partner';

export function SelectorDeNegocio({ partner }: { partner: MerchantPartner }) {
  if (partner.expedientes.length <= 1) return null;
  return (
    <Card padding="tight">
      <SelectField
        label="Negocio"
        value={partner.partnerId || null}
        onChange={partner.elegir}
        hint="Tiene más de un expediente: los cobros y las cuotas son los del que elija aquí."
        ayuda="Expediente cuyos cobros y cuotas se muestran, si tienes más de uno."
        opciones={partner.expedientes.map((uno) => ({
          valor: uno.partnerId,
          etiqueta: uno.tradeName ?? uno.legalName ?? uno.partnerId,
        }))}
      />
    </Card>
  );
}
