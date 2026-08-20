/**
 * Domicilio.
 *
 * La ubicacion se pide DESPUES de explicar para que sirve y solo cuando la persona la ofrece: es
 * opcional y el paso se puede completar sin ella. Pedir GPS al abrir la app, antes de que nada
 * tenga sentido, es la forma mas rapida de perder el permiso para siempre.
 */
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { Field, OptionGroup } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, ErrorState } from '../../src/ui/primitives';

const DEPARTMENTS = [
  { value: 'Santa Cruz', label: 'Santa Cruz' },
  { value: 'La Paz', label: 'La Paz' },
  { value: 'Cochabamba', label: 'Cochabamba' },
  { value: 'Otro', label: 'Otro departamento' },
];

export default function Address() {
  const router = useRouter();
  const session = useSession();

  const [department, setDepartment] = useState<string | null>('Santa Cruz');
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracyMeters?: number } | null>(null);
  const [locationState, setLocationState] = useState<'idle' | 'asking' | 'denied' | 'granted'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const canSubmit = Boolean(department) && city.trim().length > 1 && !busy;

  // La ubicacion GPS no entra aqui a proposito: es opcional, y nombrarla como pendiente la
  // convertiria en obligatoria a ojos del cliente.
  const blockedReason = firstBlocker([
    [Boolean(department), 'Falta elegir tu departamento.'],
    [city.trim().length > 1, 'Falta tu ciudad.'],
  ]);

  const captureLocation = async () => {
    setLocationState('asking');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      // Denegar no rompe el flujo: se registra la decision y se sigue sin ubicacion.
      setLocationState('denied');
      return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setGps({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracyMeters: position.coords.accuracy ?? undefined,
    });
    setLocationState('granted');
  };

  const save = async () => {
    if (!session.customerId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.saveAddressPackage(session.customerId, {
        address: { countryCode: 'BOL', department: department!, city: city.trim(), zone: zone.trim() || undefined },
        gpsObservation: gps ?? undefined,
      });
      await session.refresh();
      router.replace('/(onboarding)/progreso');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;

  return (
    <Screen footer={<Button label="Guardar domicilio" onPress={save} loading={busy} disabled={!canSubmit} blockedReason={blockedReason} />}>
      <ScreenHeader title="Tu domicilio" subtitle="Donde vives actualmente." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <OptionGroup label="Departamento" value={department} onChange={setDepartment} options={DEPARTMENTS} />
      <Field label="Ciudad" value={city} onChangeText={setCity} placeholder="Santa Cruz de la Sierra" required />
      <Field label="Zona o barrio" value={zone} onChangeText={setZone} placeholder="Equipetrol" />

      <Card>
        <AtlasText variant="bodyStrong">Confirmar con tu ubicacion (opcional)</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          Nos ayuda a validar tu domicilio mas rapido. No compartimos tu ubicacion con comercios ni la usamos para
          seguirte.
        </AtlasText>

        {locationState === 'granted' && gps ? (
          <Badge label="ubicacion capturada" tone="success" />
        ) : locationState === 'denied' ? (
          <>
            <Badge label="permiso denegado" tone="warning" />
            <AtlasText variant="caption" tone="tertiary">
              Puedes continuar sin ubicacion. Si cambias de opinion, habilitala desde los ajustes del sistema.
            </AtlasText>
          </>
        ) : (
          <Button
            label="Usar mi ubicacion actual"
            variant="secondary"
            loading={locationState === 'asking'}
            onPress={captureLocation}
          />
        )}
      </Card>

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        La direccion exacta se guarda cifrada y solo se usa para verificacion y cobranza.
      </AtlasText>
    </Screen>
  );
}
