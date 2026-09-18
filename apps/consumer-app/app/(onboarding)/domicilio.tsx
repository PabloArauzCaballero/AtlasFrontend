/**
 * Domicilio.
 *
 * La ubicacion se pide DESPUES de explicar para que sirve y solo cuando la persona la ofrece: es
 * opcional y el paso se puede completar sin ella. Pedir GPS al abrir la app, antes de que nada
 * tenga sentido, es la forma mas rapida de perder el permiso para siempre.
 */
import * as Location from 'expo-location';
import { StyleSheet, View, type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { color, space } from '../../src/theme/tokens';
import { firstBlocker } from '../../src/ui/blocked';
import { Icon } from '../../src/ui/icons';
import { IconField, SelectField } from '../../src/ui/form-controls';
import { DEPARTAMENTOS, ciudadesDe, nombreCiudad, nombreDepartamento, nombreZona, zonasDe } from '../../src/features/geografia';
import { Screen, useScrollToError } from '../../src/ui/layout';
import { StepHeader } from '../../src/ui/step-header';
import { AtlasText, Badge, Button, Card, CardHeader, ErrorState } from '../../src/ui/primitives';
import { MapaPunto } from '../../src/ui/mapa-punto';
import { AdjuntoDeApoyo } from '../../src/ui/adjunto-de-apoyo';
import { bitacora } from '../../src/features/bitacora';
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
  const [addressLine, setAddressLine] = useState('');
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
  /*
    El punto se SEÑALA en un mapa, no se pega como enlace.

    Antes había un campo donde pegar un enlace de Google Maps y un `fetch` que intentaba sacarle las
    coordenadas al enlace corto. Funcionaba, pero el trabajo lo hacía la persona: salir de Atlas,
    encontrar el botón de compartir, copiar, volver y pegar —y si el enlace no era de los que el
    lector entiende, un error que no se puede corregir sin repetir el viaje entero—.

    No se puede «abrir Google Maps y volver con el punto»: esa vuelta no existe en ninguna de las dos
    plataformas. Lo que sí se puede es traer el mapa aquí, que es lo que hace `MapaPunto`.
  */
  const [mapaAbierto, setMapaAbierto] = useState(false);

  const elegirEnMapa = (punto: { lat: number; lng: number }) => {
    setGps({ lat: punto.lat, lng: punto.lng });
    setMapaAbierto(false);
  };

  const save = async () => {
    if (!session.customerId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await bitacora.medirEnvio(() => onboardingApi.saveAddressPackage(session.customerId!, {
        address: {
          countryCode: 'BOL',
          // Al backend van los nombres, que es lo que su contrato acepta hoy; lo que se ha ganado es
          // que solo puedan ser los del catalogo.
          department: nombreDepartamento(department)!,
          city: nombreCiudad(department, city)!,
          zone: nombreZona(city, zone) ?? undefined,
          addressLine: addressLine.trim() || undefined,
        },
        gpsObservation: gps ?? undefined,
      }));
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
      <StepHeader code="address" title="Tu domicilio" subtitle="Dónde vives actualmente." />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      <SelectField
        label="Departamento"
        value={department}
        ayuda="El departamento donde vives ahora, no donde naciste ni donde te expidieron el carnet. De él dependen la ciudad y la zona que se ofrecen después, y también qué comercios tienes cerca."
        // sin-ayuda: los nueve departamentos de Bolivia son nombres propios; inventarles una explicación sería texto de relleno.
        opciones={DEPARTAMENTOS.map((departamento) => ({ valor: departamento.codigo, etiqueta: departamento.nombre }))}
        onChange={(elegido) => {
          setDepartment(elegido);
          // La ciudad elegida pertenecia al departamento anterior: mantenerla dejaria «Cochabamba,
          // Santa Cruz» en el expediente, que es peor que no tener ciudad. Y la zona pertenecia a
          // esa ciudad, asi que cae con ella.
          setCity(null);
          setZone('');
        }}
        placeholder="Elige tu departamento"
        required
      />
      <SelectField
        label="Ciudad"
        value={city}
        ayuda="La ciudad o el municipio donde está tu casa. Se elige de una lista y no se escribe a mano porque «Santa Cruz», «santa cruz» y «SCZ» son la misma ciudad para ti y tres distintas para nosotros."
        // sin-ayuda: las ciudades y municipios son nombres propios, igual que los departamentos.
        opciones={ciudades.map((ciudad) => ({ valor: ciudad.codigo, etiqueta: ciudad.nombre }))}
        onChange={(elegida) => {
          setCity(elegida);
          // La zona pertenece a la ciudad anterior: dejarla puesta guardaria una zona de otra ciudad.
          setZone('');
        }}
        placeholder="Elige tu ciudad"
        deshabilitadoPorque={department ? null : 'Elige primero tu departamento.'}
        required
      />
      {/*
        La zona depende de la CIUDAD, igual que la ciudad depende del departamento.

        Como texto libre entraban «Equipetrol», «equipetrol» y «Barrio Equipetrol Norte» para la
        misma zona, y la zona es justo el nivel al que se decide dónde abrir un comercio y a dónde
        llega la cobranza. Se deshabilita hasta que haya ciudad porque antes no hay lista que ofrecer.
      */}
      <SelectField
        label="Zona o barrio"
        value={zone || null}
        onChange={setZone}
        ayuda="La zona o el barrio donde vives dentro de esa ciudad. Es el nivel al que decidimos dónde abrir un comercio nuevo y a dónde va la cobranza si hiciera falta."
        // sin-ayuda: las zonas y barrios son nombres propios de cada ciudad.
        opciones={zonasDe(city).map((z) => ({ valor: z.codigo, etiqueta: z.nombre }))}
        placeholder="Elige tu zona"
        deshabilitadoPorque={city ? null : 'Elige primero tu ciudad.'}
      />

      {/*
        La calle y el numero: opcional, y con el motivo delante.

        Es el dato mas sensible de la pantalla y el unico que sirve para presentarse en una puerta,
        asi que se pide con su para-que a la vista y sin obligar. El servidor lo guarda cifrado —lo
        cifra el, no la app: una llave repartida a cada telefono deja de ser una llave—.
      */}
      <IconField icon="hogar"
        label="Calle y número (opcional)"
        value={addressLine}
        onChangeText={setAddressLine}
        placeholder="Av. San Martín 123, entre 2do y 3er anillo"
        hint="Se guarda cifrada. Solo se usa para verificar tu domicilio y para cobranza."
        ayuda="La calle, el número y una referencia para llegar. Ej.: «Av. San Martín 123, entre 2do y 3er anillo, portón verde». Es opcional y el servidor la guarda cifrada; solo sirve para confirmar que vives donde dices y, si dejaras de pagar, para presentarnos en la puerta."
        multiline
      />

      {/*
        El enlace de Maps es la alternativa al permiso de ubicacion, no un extra suyo: quien lo pega
        ya no necesita conceder GPS, y quien concede GPS no necesita pegarlo. Por eso comparten
        destino —`gps`— y por eso el estado se cuenta en el mismo sitio donde se escribe.
      */}
      {/*
        Un botón, no un campo de texto: lo que se pide es un punto, y un punto se señala.
      */}
      {/* La etiqueta con el mismo estilo que la de cualquier otro control de la pantalla: este bloque
          es un campo más del formulario, aunque lo que lo rellene sea un mapa y no un teclado. */}
      <View style={styles.mapaBloque}>
        <AtlasText variant="label" tone="secondary">
          Ubicación exacta (opcional)
        </AtlasText>
        <Button
          label={gps ? 'Cambiar el punto en el mapa' : 'Señalar mi casa en el mapa'}
          variant="secondary"
          haptic="none"
          onPress={() => setMapaAbierto(true)}
        />
        {gps ? (
          <View style={styles.puntoGuardado}>
            <Icon name="ubicacion" size={14} tint={color.feedback.success} />
            <AtlasText variant="amountMicro" tone="secondary">
              {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
            </AtlasText>
          </View>
        ) : (
          <AtlasText variant="caption" tone="tertiary">
            Sirve para encontrar tu casa el día que haya que ir. Puedes continuar sin esto.
          </AtlasText>
        )}
      </View>

      <MapaPunto
        visible={mapaAbierto}
        inicial={gps}
        onCancelar={() => setMapaAbierto(false)}
        onElegir={elegirEnMapa}
      />

      <Card tone={locationState === 'granted' && gps ? 'success' : 'default'}>
        <CardHeader
          icon="ubicacion"
          iconTone={locationState === 'granted' && gps ? 'success' : 'neutral'}
          title="Confirmar con tu ubicación (opcional)"
          detail="Nos ayuda a validar tu domicilio más rápido. No compartimos tu ubicación con comercios ni la usamos para seguirte."
          divider={false}
        />

        {locationState === 'granted' && gps ? (
          <Badge dot label="ubicación capturada" tone="success" />
        ) : locationState === 'denied' ? (
          <>
            <Badge dot label="permiso denegado" tone="warning" />
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
      {session.customerId ? (
        <AdjuntoDeApoyo
          customerId={session.customerId}
          kind="proof_of_address"
          titulo="Factura o preaviso de un servicio (opcional)"
          detalle="Luz, agua o gas a tu nombre o al de tu casa, de los últimos dos meses. Si no tienes, un comprobante de pago reciente. Sirve como prueba de domicilio."
          bitacora="subir_factura"
          origen="documento"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapaBloque: { gap: space.sm },
  puntoGuardado: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
