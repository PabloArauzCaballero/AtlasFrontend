/**
 * Ajustes del perfil que solo existen en el telefono:
 *
 * - **Ubicación con la app cerrada** (APP-11): el rastreo de fondo, que caduca solo a los 30 dias y
 *   que aqui se apaga antes o se renueva.
 *
 * Viven aparte de `perfil.tsx` para que la pantalla siga siendo un indice de filas y no un sitio
 * donde se mezcla la regla de cada cosa. La regla esta en
 * `features/rastreo-plazo.ts`. El bloqueo con Face ID / PIN (APP-13) ya no es un ajuste: ver `features/bloqueo-local.ts`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { detenerRastreoEnSegundoPlano, iniciarRastreoEnSegundoPlano, permisosDeUbicacion } from '../device/location';
import {
  estadoDelRastreoDeFondo,
  guardarPreferenciaDeRastreo,
  type EstadoDelRastreoDeFondo,
} from '../device/preferencia-rastreo';
import { Switch } from './fields';
import { Divider, ListRow } from './primitives';

const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });

export function FilaUbicacionDeFondo() {
  const [estado, setEstado] = useState<EstadoDelRastreoDeFondo | null>(null);
  const [soloConLaAppAbierta, setSoloConLaAppAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const leer = useCallback(async () => {
    const actual = await estadoDelRastreoDeFondo();
    setEstado(actual);
    // Sin consentimiento la fila no se pinta: ni se pregunta al sistema.
    if (actual.consentido) setSoloConLaAppAbierta(!(await permisosDeUbicacion()).segundoPlano);
  }, []);

  useEffect(() => {
    void leer();
  }, [leer]);

  const cambiar = async (siguiente: boolean) => {
    if (guardando) return;
    setGuardando(true);
    try {
      await guardarPreferenciaDeRastreo(siguiente);
      if (!siguiente) {
        await detenerRastreoEnSegundoPlano();
      } else if (!(await iniciarRastreoEnSegundoPlano())) {
        const permisos = await permisosDeUbicacion();
        if (!permisos.segundoPlano) {
          Alert.alert(
            'Falta un permiso del teléfono',
            'Para registrar tu ubicación con la app cerrada, tu teléfono tiene que permitirla «Siempre». Puedes cambiarlo en los ajustes.',
            [
              { text: 'Ahora no', style: 'cancel' },
              { text: 'Abrir ajustes', onPress: () => void Linking.openSettings() },
            ],
          );
        }
      }
      await leer();
    } finally {
      setGuardando(false);
    }
  };

  if (Platform.OS === 'web' || !estado?.consentido) return null;
  const ahora = Date.now();
  const subtitulo = estado.vigente
    ? soloConLaAppAbierta
      ? 'Tu teléfono sólo la permite con la app abierta.'
      : `Como mucho cada 15 minutos, hasta el ${fecha(estado.venceEn ?? ahora)}.`
    : estado.venceEn !== null && estado.venceEn <= ahora
      ? `Se apagó sola el ${fecha(estado.venceEn)}. Actívala para otros 30 días.`
      : 'Apagada. Con la app abierta la seguimos registrando.';
  return (
    <>
      <Divider inset />
      <ListRow
        icon="ubicacion"
        title="Ubicación con la app cerrada"
        subtitle={subtitulo}
        right={
          <Switch
            value={estado.vigente}
            onValueChange={(siguiente) => void cambiar(siguiente)}
            disabled={guardando}
            accessibilityLabel="Registrar la ubicación con la app cerrada"
            ayuda="Con la app cerrada registramos tu ubicación como mucho cada 15 minutos, para comprobar tu domicilio y detectar usos indebidos de tu cuenta. Se apaga sola a los 30 días; activarla de nuevo la renueva otros 30. Para dejar de compartir tu ubicación del todo, ve a «Tus datos»."
          />
        }
      />
    </>
  );
}
