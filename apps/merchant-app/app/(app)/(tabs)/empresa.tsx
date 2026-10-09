/** Mi empresa. Pantalla provisional del esqueleto (Fase 0): la llena su fase del plan. */
import { Screen, ScreenHeader } from '@cliente/ui/layout';
import { EmptyState } from '@cliente/ui/primitives';
import { BotonCuenta } from '@/ui/boton-cuenta';

export default function Pantalla() {
  return (
    <Screen>
      <ScreenHeader title="Mi empresa" subtitle="Expediente, ficha comercial, QR de cobro y sucursales." action={<BotonCuenta />} />
      <EmptyState icon="reloj" title="Muy pronto" detail="Esta sección llega en la próxima versión de la app." />
    </Screen>
  );
}
