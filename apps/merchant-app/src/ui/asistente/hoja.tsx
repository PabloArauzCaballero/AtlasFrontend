/** Provisional: la hoja del asistente la porta su agente (`internal/assist/*`, superficie `merchant-portal`). */
import { BottomSheet } from '@cliente/ui/help-sheet';
import { AtlasText } from '@cliente/ui/primitives';

export function HojaDelAsistente({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} titulo="Asistente" onClose={onClose} cierre="Cerrar">
      <AtlasText variant="body">Muy pronto.</AtlasText>
    </BottomSheet>
  );
}
