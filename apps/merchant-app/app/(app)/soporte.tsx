/**
 * Soporte y tutoriales. Porte de `app/portal-comercio/soporte` (`MerchantSupportScreen`).
 *
 * Dos pestañas, como en la web, en `?tab=`: «Soporte» (casos y conversación) y «Tutoriales». Están
 * juntas porque son la misma pregunta —«no sé cómo seguir»— y obligar a decidir de antemano si lo
 * tuyo es una duda o un problema es justo lo que todavía no sabes.
 *
 * En la web «Abrir un caso» y «Hablar con soporte» van en la cabecera; aquí van al principio de la
 * pestaña de casos, en una fila de dos (sólo ahí: abrir un caso desde Tutoriales no querría decir
 * nada). Es una pantalla apilada, abierta desde el botón flotante: cabecera con sólo el título y
 * volver. El `?tab=` sigue siendo `soporte` / `tutoriales`, como en la web.
 */
import { useCallback, useState } from 'react';
import { Screen, ScreenHeader } from '@cliente/ui/layout';
import { useMerchantPartner } from '@/features/use-merchant-partner';
import { AccionesDeCabecera } from '@/ui/acciones-de-cabecera';
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
      <ScreenHeader title="Soporte" onBack="auto" action={<AccionesDeCabecera cuenta={false} />} />
      <BarraDePestanas
        activa={pestana}
        onCambiar={elegirPestana}
        pestanas={[
          { id: 'soporte', etiqueta: 'Casos de soporte', corta: 'Casos' },
          { id: 'tutoriales', etiqueta: 'Tutoriales', corta: 'Tutoriales' },
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
