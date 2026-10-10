/**
 * Soporte y tutoriales. Porte de `app/portal-comercio/soporte` (`MerchantSupportScreen`).
 *
 * Dos pestañas, como en la web, en `?tab=`: «Soporte» (casos y conversación) y «Tutoriales». Están
 * juntas porque son la misma pregunta —«no sé cómo seguir»— y obligar a decidir de antemano si lo
 * tuyo es una duda o un problema es justo lo que todavía no sabes.
 *
 * En la web «Abrir un caso» y «Hablar con soporte» van en la cabecera; aquí la cabecera ya lleva el
 * avatar de la cuenta y van al principio de la pestaña Soporte, que es también donde la web los
 * enseña (sólo en Soporte: abrir un caso desde Tutoriales no querría decir nada).
 */
import { useCallback, useState } from 'react';
import { Screen, ScreenHeader } from '@cliente/ui/layout';
import { useMerchantPartner } from '@/features/use-merchant-partner';
import { BotonCuenta } from '@/ui/boton-cuenta';
import { BarraDePestanas, Panel, usePestana } from '@/ui/pestanas';
import { CentroDeTutoriales } from '@/ui/soporte/centro-de-tutoriales';
import { VistaSoporte } from '@/ui/soporte/vista-soporte';

const PESTANAS = ['soporte', 'tutoriales'] as const;

export default function Pantalla() {
  const [pestana, elegirPestana] = usePestana(PESTANAS);
  const partner = useMerchantPartner();
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => {
    partner.recargar();
    setVuelta((v) => v + 1);
  }, [partner]);

  return (
    <Screen onRefresh={recargar} refreshing={false}>
      <ScreenHeader
        title="Soporte y tutoriales"
        subtitle="Habla con Atlas, sigue tus casos abiertos y repasa cómo se hace cada cosa."
        action={<BotonCuenta />}
      />
      <BarraDePestanas
        activa={pestana}
        onCambiar={elegirPestana}
        pestanas={[
          { id: 'soporte', etiqueta: 'Soporte', icono: 'chat' },
          { id: 'tutoriales', etiqueta: 'Tutoriales', icono: 'educacion' },
        ]}
      />
      <Panel visible={pestana === 'soporte'}>
        <VistaSoporte partner={partner} vuelta={vuelta} />
      </Panel>
      <Panel visible={pestana === 'tutoriales'}>
        <CentroDeTutoriales />
      </Panel>
    </Screen>
  );
}
