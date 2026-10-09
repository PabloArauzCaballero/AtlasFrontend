/** Cartera y facturación. Pantalla provisional del esqueleto (Fase 0): la llena su fase del plan. */
import { Screen, ScreenHeader } from '@cliente/ui/layout';
import { EmptyState } from '@cliente/ui/primitives';
import { BotonCuenta } from '@/ui/boton-cuenta';

export default function Pantalla() {
  return (
    <Screen>
      <ScreenHeader title="Cartera y facturación" subtitle="Por cobrar, vencido, cobrado y tu facturación." action={<BotonCuenta />} />
      <EmptyState icon="reloj" title="Muy pronto" detail="Esta sección llega en la próxima versión de la app." />
    </Screen>
  );
}
