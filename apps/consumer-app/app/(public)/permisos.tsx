/**
 * Los permisos, explicados ANTES de que el sistema pregunte.
 *
 * ## Por que existe esta pantalla y no se llama al dialogo directamente
 *
 * Porque iOS pregunta UNA sola vez. Un dialogo del sistema que sale nada mas abrir la app, sin que
 * la persona sepa que se le esta pidiendo ni para que, se contesta que no — y a partir de ahi la
 * unica salida es un viaje a los ajustes que nadie hace. Esta pantalla es la que convierte «Atlas
 * quiere acceder a tus contactos» en una decision informada.
 *
 * Es tambien la que hace defendible lo que viene detras. El dialogo del sistema solo prueba que
 * alguien pulso «Permitir» en una caja que redacta Apple; no dice que se le prometio a cambio. Lo
 * que se lee aqui es lo que despues se registra como consentimiento —texto versionado, fecha,
 * canal, dispositivo— en `privacy.customer_consents`.
 *
 * ## Se puede decir que no, y se dice que se puede
 *
 * «Ahora no» esta a la vista y no cuesta mas toques que aceptar. Quien lo pulsa abre su cuenta
 * igual: lo unico que cambia es que su expediente tiene menos evidencia, y el motor pondera la
 * ausencia como menos informacion, nunca como informacion en contra. Una pantalla de permisos sin
 * salida no es una pantalla de permisos, es un peaje.
 *
 * ## La negativa TAMBIEN se guarda
 *
 * Se guarda la decision, diga lo que diga. Sin eso volveriamos a sacar esta pantalla en cada
 * arranque a quien ya dijo que no, y ademas no se podria distinguir «dijo que no» de «esta version
 * de la app todavia no lo preguntaba» — que son dos cosas muy distintas en un expediente.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { pedirPermisoDeContactos } from '../../src/device/permissions';
import { pedirPermisoDeSegundoPlano, pedirPermisoDeUbicacion } from '../../src/device/location';
import { guardarDecisionDeArranque } from '../../src/session/permisos-de-arranque';
import { space } from '../../src/theme/tokens';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { type IconName } from '../../src/ui/icons';
import { AtlasText, Button, Card, CardHeader } from '../../src/ui/primitives';

/**
 * Lo que se pide, dicho en primera persona y sin eufemismos.
 *
 * `queNoHacemos` no es un adorno de confianza: es la mitad de la frase que hace que la otra mitad se
 * pueda creer. «Guardamos tus contactos» sin «no les escribimos» es justo lo que la gente teme, y
 * callarlo no lo hace menos cierto — lo hace mas sospechoso.
 */
const PERMISOS: { icono: IconName; titulo: string; para: string[]; queNoHacemos: string }[] = [
  {
    icono: 'ubicacion',
    titulo: 'Tu ubicación',
    para: [
      'Comprobar que el domicilio que declaras es donde realmente estás.',
      'Avisarte si alguien usa tu cuenta desde otro lugar.',
      'Detectar ubicaciones simuladas, la señal más común de una solicitud falsa.',
    ],
    queNoHacemos: 'No la compartimos con los comercios ni la usamos para publicidad.',
  },
  {
    icono: 'telefono',
    titulo: 'Tus contactos',
    para: [
      'Verificar que las referencias que das son personas con las que hablas.',
      'Detectar varias cuentas distintas que se avalan entre sí.',
      'Poder ubicarte a través de tus referencias si perdemos contacto contigo.',
    ],
    queNoHacemos: 'No les escribimos, no les ofrecemos nada y no vendemos su información.',
  },
];

export default function Permisos() {
  const router = useRouter();
  const [pidiendo, setPidiendo] = useState(false);
  /*
    El segundo paso: ofrecer el «siempre» APARTE, y solo a quien concedio la ubicacion.

    Va en un paso propio porque en Android pedirlo no abre un dialogo: saca a la persona de la app y
    la deja en los Ajustes del sistema. Encadenarlo al primer boton la expulsaba en mitad del alta
    sin decirle por que, y dejaba el dialogo de contactos pidiendose por detras de los Ajustes.
  */
  const [paso, setPaso] = useState<'inicio' | 'siempre'>('inicio');
  const [concedido, setConcedido] = useState({ ubicacion: false, contactos: false });

  /**
   * Los dos dialogos que SI son dialogos, en orden, y lo que salga se guarda.
   *
   * No se comprueba si concedio para seguir: conceder uno y negar el otro es una decision legitima y
   * frecuente, y la app funciona en los cuatro casos. Lo que se guarda es lo que el sistema
   * contesto, no lo que la persona pulso aqui — que son cosas distintas cuando alguien acepta en
   * esta pantalla y luego niega el dialogo.
   */
  async function aceptar() {
    setPidiendo(true);
    try {
      const ubicacion = await pedirPermisoDeUbicacion();
      const contactos = await pedirPermisoDeContactos();
      await guardarDecisionDeArranque({ ubicacion, ubicacionSiempre: false, contactos });
      setConcedido({ ubicacion, contactos });
      if (ubicacion) {
        setPaso('siempre');
        return;
      }
    } finally {
      setPidiendo(false);
    }
    salir();
  }

  /**
   * El «siempre», pedido a proposito y avisando de lo que va a pasar.
   *
   * Lo guardado se actualiza con lo que conteste, pero NO es lo que decide si el rastreo de segundo
   * plano se enciende: eso lo lee del sistema `session/device-signals.ts`, porque en iOS este
   * dialogo se resuelve despues de que la promesa retorne y aqui todavia dice que no.
   */
  async function pedirSiempre() {
    setPidiendo(true);
    try {
      const siempre = await pedirPermisoDeSegundoPlano();
      await guardarDecisionDeArranque({ ...concedido, ubicacionSiempre: siempre });
    } finally {
      setPidiendo(false);
      salir();
    }
  }

  /*
    A la raiz, no a la bienvenida.

    `app/index.tsx` es quien decide a que area entra la persona segun el estado REAL de su cuenta.
    Mandarla a la bienvenida desde aqui daria por hecho que no tiene sesion, y quien reinstala la app
    con sesion valida —o quien actualiza a esta version— la tiene.
  */
  function salir() {
    router.replace('/');
  }

  async function ahoraNo() {
    await guardarDecisionDeArranque({ ubicacion: false, ubicacionSiempre: false, contactos: false });
    salir();
  }

  if (paso === 'siempre') {
    /*
      El segundo paso, que en Android dice EXACTAMENTE lo que va a pasar.

      «Se abrirán los ajustes de tu teléfono» no es un tecnicismo que se pueda callar: el sistema
      saca a la persona de la app, y quien no lo espera cree que algo se rompió. En iOS es un
      diálogo más y por eso el texto cambia.
    */
    const enAndroid = Platform.OS === 'android';
    return (
      <Screen
        footer={
          <View style={{ gap: space.sm }}>
            <Button
              label={enAndroid ? 'Abrir ajustes' : 'Permitir siempre'}
              onPress={() => void pedirSiempre()}
              loading={pidiendo}
            />
            <Button label="No, gracias" variant="ghost" onPress={salir} disabled={pidiendo} />
          </View>
        }
      >
        <ScreenHeader
          eyebrow="Un paso más, opcional"
          title="¿También con la app cerrada?"
          subtitle="Ya puedes seguir. Esto solo añade una señal más, y puedes decir que no sin que cambie nada de tu cuenta."
        />

        <Card>
          <CardHeader title="Qué cambia" icon="ubicacion" />
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            <AtlasText variant="body" tone="secondary">
              Registramos tu ubicación cada cierto tiempo aunque no tengas la app abierta. Sirve para
              lo mismo: comprobar tu domicilio y detectar si alguien usa tu cuenta desde otro lugar.
            </AtlasText>
            {enAndroid ? (
              <AtlasText variant="body" tone="secondary">
                Tu teléfono no permite concederlo desde aquí: al continuar se abren los ajustes de
                Android y tienes que elegir «Permitir todo el tiempo». Después vuelve a Atlas.
              </AtlasText>
            ) : null}
          </View>
          <Gap size="sm" />
          <AtlasText variant="caption" tone="tertiary">
            Android te mostrará un aviso permanente mientras esté activo, para que sepas siempre que
            se está registrando. Puedes quitarlo cuando quieras.
          </AtlasText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button label="Permitir" onPress={() => void aceptar()} loading={pidiendo} />
          <Button label="Ahora no" variant="ghost" onPress={() => void ahoraNo()} disabled={pidiendo} />
        </View>
      }
    >
      <ScreenHeader
        eyebrow="Antes de empezar"
        title="Dos permisos, y para qué"
        subtitle="Atlas presta dinero sin pedirte garantías. Estas dos señales son parte de lo que nos permite hacerlo. Puedes decir que no y abrir tu cuenta igual."
      />

      {PERMISOS.map((permiso) => (
        <Card key={permiso.titulo}>
          <CardHeader title={permiso.titulo} icon={permiso.icono} />
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            {permiso.para.map((linea) => (
              <View key={linea} style={{ flexDirection: 'row', gap: space.sm }}>
                <AtlasText variant="body" tone="secondary">
                  ·
                </AtlasText>
                <AtlasText variant="body" tone="secondary" style={{ flex: 1 }}>
                  {linea}
                </AtlasText>
              </View>
            ))}
          </View>
          <Gap size="sm" />
          <AtlasText variant="caption" tone="tertiary">
            {permiso.queNoHacemos}
          </AtlasText>
        </Card>
      ))}

      <Card tone="brand">
        <AtlasText variant="body" tone="secondary">
          Tu teléfono te va a preguntar por cada permiso. Si eliges «Siempre» en la ubicación,
          también la registramos con la app cerrada; si eliges «Mientras uso la app», solo mientras
          la tienes abierta. Puedes cambiarlo cuando quieras desde «Privacidad» o desde los ajustes
          de tu teléfono.
        </AtlasText>
      </Card>
    </Screen>
  );
}
