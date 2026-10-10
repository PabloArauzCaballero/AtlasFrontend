/**
 * Cartera y facturación: UNA pestaña, dos vistas hermanas.
 *
 * En la web son dos rutas (`/portal-comercio/cartera` y `/portal-comercio/facturacion`) unidas por
 * `CarteraFacturacionSwitch`, un selector de dos posiciones encima de cada una. Aquí es lo mismo en
 * una sola pantalla: el selector va arriba y la vista elegida viaja en el parámetro `vista` de la
 * ruta, como la web la lleva en la URL. Así un aviso o un enlace pueden aterrizar en «Consumo y
 * facturación» sin pasar por la cartera.
 *
 * Cada vista tiene sus propias pestañas (`?tab=`). No chocan porque sólo se monta la vista elegida y,
 * al cambiar de vista, la pestaña se olvida: `tab=creditos` no significa nada en facturación.
 *
 * El expediente lo resuelve esta pantalla UNA vez y lo reciben las dos vistas (ver
 * `use-merchant-partner.ts`): que la cartera hablara de un negocio y la facturación de otro, sin
 * decirlo, es justo lo que ese gancho existe para impedir.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Screen, ScreenHeader } from '@cliente/ui/layout';
import { useMerchantPartner } from '@/features/use-merchant-partner';
import { BotonCuenta } from '@/ui/boton-cuenta';
import { SelectorDeNegocio } from '@/ui/cartera/selector-de-negocio';
import { VistaCartera } from '@/ui/cartera/vista-cartera';
import { VistaFacturacion } from '@/ui/cartera/vista-facturacion';
import { BarraDePestanas } from '@/ui/pestanas';

type Vista = 'cartera' | 'facturacion';

export default function Pantalla() {
  const { vista: param } = useLocalSearchParams<{ vista?: string }>();
  const router = useRouter();
  const vista: Vista = param === 'facturacion' ? 'facturacion' : 'cartera';
  const partner = useMerchantPartner();
  const [vuelta, setVuelta] = useState(0);

  const elegirVista = useCallback((id: Vista) => router.setParams({ vista: id, tab: undefined }), [router]);
  const recargar = useCallback(() => {
    partner.recargar();
    setVuelta((v) => v + 1);
  }, [partner]);

  const subtitulo =
    vista === 'cartera'
      ? `Lo que le deben${partner.nombre ? ` a ${partner.nombre}` : ''}, con su detalle cuota a cuota y el calendario de cobros.`
      : 'Cada cobro con su comisión, lo que queda por cobrar y los cargos que Atlas le factura.';

  return (
    <Screen onRefresh={recargar} refreshing={false}>
      <ScreenHeader
        eyebrow="Cartera y facturación"
        title={vista === 'cartera' ? 'Mi cartera' : 'Consumo y facturación'}
        subtitle={subtitulo}
        action={<BotonCuenta />}
      />
      <BarraDePestanas<Vista>
        activa={vista}
        onCambiar={elegirVista}
        pestanas={[
          { id: 'cartera', etiqueta: 'Mi cartera', icono: 'billetera' },
          { id: 'facturacion', etiqueta: 'Consumo y facturación', icono: 'documento' },
        ]}
      />
      <SelectorDeNegocio partner={partner} />
      {vista === 'cartera' ? <VistaCartera partner={partner} vuelta={vuelta} /> : <VistaFacturacion partner={partner} vuelta={vuelta} />}
    </Screen>
  );
}
