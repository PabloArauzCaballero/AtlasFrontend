/**
 * Domicilio.
 *
 * La ubicacion se pide DESPUES de explicar para que sirve y solo cuando la persona la ofrece: es
 * opcional y el paso se puede completar sin ella. Pedir GPS al abrir la app, antes de que nada
 * tenga sentido, es la forma mas rapida de perder el permiso para siempre.
 */
import * as Location from 'expo-location';
import { type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { Field } from '../../src/ui/fields';
import { SelectField } from '../../src/ui/form-controls';
import { DEPARTAMENTOS, ciudadesDe, nombreCiudad, nombreDepartamento } from '../../src/features/geografia';
import { coordenadasDeEnlace } from '../../src/features/maps-link';
import { Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, ErrorState } from '../../src/ui/primitives';
import { TRUST_DOMICILIO } from '../../src/features/trust-copy';
import { TrustCard } from '../../src/ui/trust-card';

export default function Address() {
  const router = useRouter();
  const session = useSession();

  /*
    Se guardan los CODIGOS del catalogo, no los nombres.

    El nombre se resuelve al enviar. Asi, el dia que la lista venga del backend, lo unico que cambia
    es de donde sale `DEPARTAMENTOS`: la pantalla nunca ha conocido los textos.
  */
  const [department, setDepartment] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [zone, setZone] = useState('');
  const [enlace, setEnlace] = useState('');
  const [enlaceEstado, setEnlaceEstado] = useState<'vacio' | 'leyendo' | 'ok' | 'no-entendido'>('vacio');
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracyMeters?: number } | null>(null);
  const [locationState, setLocationState] = useState<'idle' | 'asking' | 'denied' | 'granted'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const ciudades = ciudadesDe(department);
  const canSubmit = Boolean(department) && Boolean(city) && !busy;

  // La ubicacion GPS no entra aqui a proposito: es opcional, y nombrarla como pendiente la
  // convertiria en obligatoria a ojos del cliente.
  const blockedReason = firstBlocker([
    [Boolean(department), 'Falta elegir tu departamento.'],
    [Boolean(city), 'Falta elegir tu ciudad.'],
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

  /*
    El enlace de Maps se convierte en el MISMO dato que el GPS: una observacion de coordenadas.

    No es un campo nuevo en el expediente ni un texto que alguien tenga que abrir a mano; es la
    ubicacion, obtenida por otra via. Quien rellena el alta desde el trabajo no puede darla con el
    boton de «usar mi ubicacion» —diria donde esta, no donde vive— y en cambio pega un enlace de
    Maps sin pensarlo, porque es como ya comparte su direccion todos los dias.
  */
  const leerEnlace = async (texto: string) => {
    setEnlace(texto);
    if (!texto.trim()) {
      setEnlaceEstado('vacio');
      return;
    }
    setEnlaceEstado('leyendo');
    const punto = await coordenadasDeEnlace(texto);
    if (!punto) {
      setEnlaceEstado('no-entendido');
      return;
    }
    setGps({ lat: punto.lat, lng: punto.lng });
    setEnlaceEstado('ok');
  };

  const save = async () => {
    if (!session.customerId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.saveAddressPackage(session.customerId, {
        address: {
          countryCode: 'BOL',
          // Al backend van los nombres, que es lo que su contrato acepta hoy; lo que se ha ganado es
          // que solo puedan ser los del catalogo.
          department: nombreDepartamento(department)!,
          city: nombreCiudad(department, city)!,
          zone: zone.trim() || undefined,
        },
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

  // El fallo se pinta arriba y el boton esta abajo: hay que llevar la vista hasta el.

  const scroll = useRef<ScrollView>(null);

  useScrollToError(error, scroll);

  return (
    <Screen scrollRef={scroll} footer={<Button label="Guardar domicilio" onPress={save} loading={busy} disabled={!canSubmit} blockedReason={blockedReason} />}>
      <ScreenHeader title="Tu domicilio" subtitle="Dónde vives actualmente." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <SelectField
        label="Departamento"
        value={department}
        opciones={DEPARTAMENTOS.map((departamento) => ({ valor: departamento.codigo, etiqueta: departamento.nombre }))}
        onChange={(elegido) => {
          setDepartment(elegido);
          // La ciudad elegida pertenecia al departamento anterior: mantenerla dejaria «Cochabamba,
          // Santa Cruz» en el expediente, que es peor que no tener ciudad.
          setCity(null);
        }}
        placeholder="Elige tu departamento"
        required
      />
      <SelectField
        label="Ciudad"
        value={city}
        opciones={ciudades.map((ciudad) => ({ valor: ciudad.codigo, etiqueta: ciudad.nombre }))}
        onChange={setCity}
        placeholder="Elige tu ciudad"
        deshabilitadoPorque={department ? null : 'Elige primero tu departamento.'}
        required
      />
      <Field label="Zona o barrio" value={zone} onChangeText={setZone} placeholder="Equipetrol" />

      {/*
        El enlace de Maps es la alternativa al permiso de ubicacion, no un extra suyo: quien lo pega
        ya no necesita conceder GPS, y quien concede GPS no necesita pegarlo. Por eso comparten
        destino —`gps`— y por eso el estado se cuenta en el mismo sitio donde se escribe.
      */}
      <Field
        label="Enlace de Google Maps (opcional)"
        value={enlace}
        onChangeText={leerEnlace}
        placeholder="https://maps.app.goo.gl/…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint={
          enlaceEstado === 'leyendo'
            ? 'Abriendo el enlace…'
            : enlaceEstado === 'ok'
              ? 'Ubicación tomada del enlace.'
              : 'Comparte tu casa desde Google Maps y pega aquí el enlace.'
        }
        error={enlaceEstado === 'no-entendido' ? 'No pudimos leer una ubicación de ese enlace.' : null}
      />

      <Card>
        <AtlasText variant="bodyStrong">Confirmar con tu ubicación (opcional)</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          Nos ayuda a validar tu domicilio más rápido. No compartimos tu ubicación con comercios ni la usamos para
          seguirte.
        </AtlasText>

        {locationState === 'granted' && gps ? (
          <Badge label="ubicación capturada" tone="success" />
        ) : locationState === 'denied' ? (
          <>
            <Badge label="permiso denegado" tone="warning" />
            <AtlasText variant="caption" tone="tertiary">
              Puedes continuar sin ubicación. Si cambias de opinión, habilítala desde los ajustes del sistema.
            </AtlasText>
          </>
        ) : (
          <Button
            label="Usar mi ubicación actual"
            variant="secondary"
            loading={locationState === 'asking'}
            onPress={captureLocation}
          />
        )}
      </Card>
      {/* Al final del formulario: ver `ui/trust-card.tsx`. */}
      <TrustCard items={TRUST_DOMICILIO} />
    </Screen>
  );
}
