/**
 * Cartera: UNA pestaña, dos vistas hermanas («Cartera» y «Facturación»).
 *
 * En la web son dos rutas (`/portal-comercio/cartera` y `/portal-comercio/facturacion`) unidas por
 * `CarteraFacturacionSwitch`, un selector de dos posiciones encima de cada una. Aquí es lo mismo en
 * una sola pantalla: el selector va justo bajo el título y la vista elegida viaja en el parámetro
 * `vista` de la ruta, como la web la lleva en la URL. Así un aviso o un enlace pueden aterrizar en
 * «Consumo y facturación» sin pasar por la cartera.
 *
 * Cada vista tiene sus propias pestañas (`?tab=`). No chocan porque sólo se monta la vista elegida y,
 * al cambiar de vista, la pestaña se olvida: `tab=creditos` no significa nada en facturación.
 *
 * Cabecera (Pablo, 2026-10-10): sólo el título, sin antetítulo ni párrafo. El «Descargar PDF» que
 * cada vista pintaba a lo ancho es el ícono de la cabecera, e imprime la vista abierta: cada vista
 * deja en `pdf` cómo armar su documento.
 *
 * El expediente lo resuelve esta pantalla UNA vez y lo reciben las dos vistas (ver
 * `use-merchant-partner.ts`): que la cartera hablara de un negocio y la facturación de otro, sin
 * decirlo, es justo lo que ese gancho existe para impedir.
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Screen, ScreenHeader } from '@cliente/ui/layout';
import { documentoCartera, documentoFacturacion } from '@/features/cartera/documentos';
import type { DocumentoPdf } from '@/features/pdf';
import { useMerchantPartner } from '@/features/use-merchant-partner';
import { AccionesDeCabecera } from '@/ui/acciones-de-cabecera';
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
  /* Cómo imprimir la vista abierta; la vista lo rellena en cuanto tiene datos. */
  const pdf = useRef<(() => DocumentoPdf) | null>(null);

  const elegirVista = useCallback(
    (id: Vista) => {
      pdf.current = null;
      router.setParams({ vista: id, tab: undefined });
    },
    [router],
  );
  const recargar = useCallback(() => {
    partner.recargar();
    setVuelta((v) => v + 1);
  }, [partner]);

  /* Al volver a la pantalla se releen los datos (la primera vez ya los pide cada vista al montarse). */
  const montada = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (montada.current) setVuelta((v) => v + 1);
      montada.current = true;
    }, []),
  );

  /* Sin datos todavía, el PDF sale con la estructura y las cifras en cero, como la web antes de cargar. */
  const documento = () => pdf.current?.() ?? (vista === 'cartera' ? documentoCartera(null, partner.nombre) : documentoFacturacion(null, [], []));

  return (
    <Screen onRefresh={recargar} refreshing={false} contentStyle={{ paddingBottom: 160 }}>
      <ScreenHeader title="Cartera" action={<AccionesDeCabecera pdf={documento} />} />
      <BarraDePestanas<Vista>
        activa={vista}
        onCambiar={elegirVista}
        pestanas={[
          { id: 'cartera', etiqueta: 'Mi cartera', corta: 'Cartera' },
          { id: 'facturacion', etiqueta: 'Consumo y facturación', corta: 'Facturación' },
        ]}
      />
      <SelectorDeNegocio partner={partner} />
      {vista === 'cartera' ? (
        <VistaCartera partner={partner} vuelta={vuelta} pdf={pdf} />
      ) : (
        <VistaFacturacion partner={partner} vuelta={vuelta} pdf={pdf} />
      )}
    </Screen>
  );
}
