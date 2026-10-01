/**
 * Domicilio.
 *
 * La ubicacion se pide DESPUES de explicar para que sirve y solo cuando la persona la ofrece: es
 * opcional y el paso se puede completar sin ella. Pedir GPS al abrir la app, antes de que nada
 * tenga sentido, es la forma mas rapida de perder el permiso para siempre.
 */
import { Alert, Platform, StyleSheet, View, type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';
import { MapaPunto } from '../../src/ui/mapa-punto';
import {
  pedirPermisoDeSegundoPlano,
  pedirPermisoDeUbicacion,
  permisosDeUbicacion,
  posicionActual,
} from '../../src/device/location';
import { anotarEnHistorial, leerHistorial } from '../../src/device/historial-ubicaciones';
import { sitiosFrecuentes, type SitioFrecuente } from '../../src/features/sitios-frecuentes';
import { guardarDecisionDeArranque, leerDecisionDeArranque } from '../../src/session/permisos-de-arranque';
import { bitacora } from '../../src/features/bitacora';
import { TRUST_DOMICILIO } from '../../src/features/trust-copy';
import { TrustCardRemoto } from '../../src/features/use-contenido-remoto';

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

  /*
    Volver a este paso enseña lo ya guardado (pedido de Pablo, 2026-09-28). El servidor guarda los
    NOMBRES del catálogo; aquí se vuelven a sus códigos. Lo que no esté en el catálogo se queda vacío.
  */
  useEffect(() => {
    if (!session.customerId) return;
    let vivo = true;
    void onboardingApi
      .getAnswers(session.customerId)
      .then(({ address }) => {
        if (!vivo || !address) return;
        const dep = DEPARTAMENTOS.find((d) => d.nombre === address.department);
        if (!dep) return;
        const ciudad = ciudadesDe(dep.codigo).find((c) => c.nombre === address.city);
        const zona = ciudad ? zonasDe(ciudad.codigo).find((z) => z.nombre === address.zone) : undefined;
        setDepartment((actual) => actual ?? dep.codigo);
        if (ciudad) setCity((actual) => actual ?? ciudad.codigo);
        if (zona) setZone((actual) => actual || zona.codigo);
        if (address.addressLine) setAddressLine((actual) => actual || address.addressLine!);
        if (address.gps) setGps((actual) => actual ?? { lat: address.gps!.lat, lng: address.gps!.lng });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [session.customerId]);

  const ciudades = ciudadesDe(department);
  const canSubmit = Boolean(department) && Boolean(city) && !busy;

  // La ubicacion GPS no entra aqui a proposito: es opcional, y nombrarla como pendiente la
  // convertiria en obligatoria a ojos del cliente.
  const blockedReason = firstBlocker([
    [Boolean(department), 'Falta elegir tu departamento.'],
    [Boolean(city), 'Falta elegir tu ciudad.'],
  ]);

  /*
    El mapa pide la ubicacion al abrirse (pedido de Pablo, 2026-09-28).

    Tocar «Señalar mi casa en el mapa» es el momento en que la ubicacion tiene sentido para la
    persona, asi que ahi se piden los dos permisos, en orden: primero «mientras se usa» —para abrir
    el mapa sobre donde esta ahora—, y despues de elegir el punto el de «siempre», que enciende el
    rastreo y la primera medida (`session.reactivarSeñales`). Negar cualquiera de los dos no corta
    nada: el mapa abre igual, en Santa Cruz, y el domicilio se guarda sin coordenadas.
  */
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [centro, setCentro] = useState<{ lat: number; lng: number } | null>(null);

  /*
    Los sitios que la persona frecuenta, para marcarlos TODOS en el mapa.

    Salen de las posiciones que el telefono ya midio desde que concedio la ubicacion
    (`device/historial-ubicaciones.ts`): el sistema no entrega un historial a las apps, asi que lo
    unico que hay es lo que la app anoto. Antes el mapa abria vacio y la persona señalaba su casa
    «a ciegas», sin que se viera nada de lo que el telefono ya sabia de ella.
  */
  const [sitios, setSitios] = useState<SitioFrecuente[]>([]);
  const cargarSitios = useCallback(async () => {
    setSitios(sitiosFrecuentes(await leerHistorial()));
  }, []);
  useEffect(() => {
    void cargarSitios();
  }, [cargarSitios]);

  const abrirMapa = async () => {
    setLocationState('asking');
    const concedido = await pedirPermisoDeUbicacion();
    bitacora.permiso('ubicacion', concedido ? 'concedido' : 'denegado');
    if (concedido) {
      const actual = await posicionActual();
      if (actual) {
        setCentro({ lat: actual.lat, lng: actual.lng });
        // La posicion de AHORA tambien cuenta para los sitios que frecuenta.
        await anotarEnHistorial([{ lat: actual.lat, lng: actual.lng, at: actual.capturedAt }]);
      }
    }
    await cargarSitios();
    setLocationState(concedido ? 'granted' : 'denied');
    setMapaAbierto(true);
  };

  /*
    El «siempre», con el aviso delante. En Android el sistema no abre un dialogo: saca a la persona
    a los Ajustes (ver `device/location.ts`), y sin avisar parece que la app se rompio.
  */
  const pedirSiempre = () =>
    new Promise<void>((resolver) => {
      const aviso =
        Platform.OS === 'android'
          ? 'Para registrar tu ubicación también con la app cerrada, en la siguiente pantalla elige «Permitir todo el tiempo» y vuelve a Atlas.'
          : 'Para registrar tu ubicación también con la app cerrada, elige «Permitir siempre» cuando el teléfono te lo pregunte.';
      Alert.alert('Ubicación siempre', aviso, [
        { text: 'Ahora no', style: 'cancel', onPress: () => resolver() },
        {
          text: 'Continuar',
          onPress: () => {
            void (async () => {
              const siempre = await pedirPermisoDeSegundoPlano();
              bitacora.permiso('ubicacion_siempre', siempre ? 'concedido' : 'denegado');
              resolver();
            })();
          },
        },
      ]);
    });

  const elegirEnMapa = async (punto: { lat: number; lng: number }) => {
    setGps({ lat: punto.lat, lng: punto.lng });
    setMapaAbierto(false);
    if (Platform.OS === 'web') return;
    const permisos = await permisosDeUbicacion();
    if (!permisos.primerPlano) return;
    if (!permisos.segundoPlano) await pedirSiempre();
    // La decision viaja como consentimiento `location_tracking` y enciende las medidas: la del
    // momento y, con «siempre», la de segundo plano. La agenda se decide en su paso.
    const previa = await leerDecisionDeArranque();
    const vigentes = await permisosDeUbicacion();
    await guardarDecisionDeArranque({
      ubicacion: true,
      ubicacionSiempre: vigentes.segundoPlano,
      contactos: previa?.contactos ?? false,
      contactosSinDecidir: previa ? previa.contactosSinDecidir : true,
    });
    await session.reactivarSeñales();
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
          loading={locationState === 'asking'}
          onPress={() => void abrirMapa()}
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
            {locationState === 'denied'
              ? 'No diste permiso de ubicación: el mapa abre en Santa Cruz y puedes señalar tu casa a mano.'
              : 'El mapa abre donde estás ahora. Sirve para encontrar tu casa el día que haya que ir.'}
          </AtlasText>
        )}
        {sitios.length > 0 ? (
          <View style={styles.puntoGuardado}>
            <Icon name="ubicacion" size={14} tint={color.text.secondary} />
            <AtlasText variant="caption" tone="secondary">
              {sitios.length === 1
                ? 'Marcamos 1 sitio que frecuentas en el mapa.'
                : `Marcamos ${sitios.length} sitios que frecuentas en el mapa.`}
            </AtlasText>
          </View>
        ) : null}
      </View>

      <MapaPunto
        visible={mapaAbierto}
        inicial={gps}
        centro={centro}
        sitios={sitios}
        onCancelar={() => setMapaAbierto(false)}
        onElegir={(punto) => void elegirEnMapa(punto)}
      />

      {/* Al final del formulario: ver `ui/trust-card.tsx`. */}
      <TrustCardRemoto grupo="domicilio" base={TRUST_DOMICILIO} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapaBloque: { gap: space.sm },
  puntoGuardado: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
