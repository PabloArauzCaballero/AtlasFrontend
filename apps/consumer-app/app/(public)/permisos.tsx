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
 * Cada permiso tiene su tarjeta, su «Permitir» y su «Ahora no» (APP-12): el consentimiento es por
 * finalidad, no uno para las dos. «Ahora no» esta a la vista y no cuesta mas toques que aceptar. Quien lo pulsa abre su cuenta
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
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as contentApi from '../../src/api/endpoints/app-content';
import { pedirPermisoDeContactos } from '../../src/device/permissions';
import { pedirPermisoDeSegundoPlano, pedirPermisoDeUbicacion, permisosDeUbicacion } from '../../src/device/location';
import { guardarDecisionDeArranque, leerDecisionDeArranque } from '../../src/session/permisos-de-arranque';
import { useSession } from '../../src/session/session';
import { bitacora } from '../../src/features/bitacora';
import { decisionFinal, faltaPorDecidir, SIN_ELEGIR, type Eleccion, type Elecciones } from '../../src/features/decision-de-permisos';
import { LO_QUE_NO_HACEMOS_CON_LA_UBICACION, USOS_DE_LA_UBICACION } from '../../src/features/consentimiento-ubicacion';
import { space } from '../../src/theme/tokens';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { type IconName } from '../../src/ui/icons';
import { IndicadorDeToque } from '../../src/ui/indicador-de-toque';
import { AtlasText, Button, Card, CardHeader } from '../../src/ui/primitives';

/**
 * Lo que se pide, dicho en primera persona y sin eufemismos.
 *
 * `queNoHacemos` no es un adorno de confianza: es la mitad de la frase que hace que la otra mitad se
 * pueda creer. «Guardamos tus contactos» sin «no les escribimos» es justo lo que la gente teme, y
 * callarlo no lo hace menos cierto — lo hace mas sospechoso.
 */
type PiezaDePermiso = { clave: 'ubicacion' | 'contactos'; icono: IconName; titulo: string; para: string[]; queNoHacemos: string };

/**
 * La CLAVE con la que cada pieza vive en el catálogo (`app_content_entries`, superficie `legal`).
 *
 * Se declara aquí y no se compone sobre la marcha para que se pueda buscar en el repositorio: quien
 * abra el portal y vea `permisos.ubicacion` tiene que poder encontrar en un `grep` qué pantalla lo
 * pinta. Es lo mismo que hace la bienvenida con `eslogan`.
 */
const CLAVES = {
  cabecera: 'permisos.cabecera',
  ubicacion: 'permisos.ubicacion',
  contactos: 'permisos.contactos',
  aviso: 'permisos.aviso',
  siempre: 'permisos.siempre',
} as const;

const CABECERA_POR_DEFECTO = {
  antetitulo: 'Antes de empezar',
  titulo: 'Dos permisos, y para qué',
  subtitulo:
    'Atlas presta dinero sin pedirte garantías. Estas dos señales son parte de lo que nos permite hacerlo. Puedes decir que no y abrir tu cuenta igual.',
};

const AVISO_POR_DEFECTO =
  'Tu teléfono te va a preguntar por cada permiso. Si eliges «Siempre» en la ubicación, también la registramos con la app cerrada; si eliges «Mientras uso la app», solo mientras la tienes abierta. Puedes cambiarlo cuando quieras desde «Privacidad» o desde los ajustes de tu teléfono.';

const SIEMPRE_POR_DEFECTO = {
  antetitulo: 'Un paso más, opcional',
  titulo: '¿También con la app cerrada?',
  subtitulo:
    'Ya puedes seguir. Esto solo añade una señal más, y puedes decir que no sin que cambie nada de tu cuenta.',
  cuerpo:
    'Registramos tu ubicación cada cierto tiempo aunque no tengas la app abierta. Sirve para lo mismo: comprobar tu domicilio y detectar si alguien usa tu cuenta desde otro lugar.',
};

const [UBICACION_POR_DEFECTO, CONTACTOS_POR_DEFECTO]: [PiezaDePermiso, PiezaDePermiso] = [
  {
    clave: 'ubicacion',
    icono: 'ubicacion',
    titulo: 'Tu ubicación',
    para: [...USOS_DE_LA_UBICACION],
    queNoHacemos: LO_QUE_NO_HACEMOS_CON_LA_UBICACION,
  },
  {
    clave: 'contactos',
    icono: 'telefono',
    titulo: 'Tus contactos',
    para: [
      'Confirmar que el teléfono es de una persona real, con su propia agenda.',
      'Detectar varias cuentas distintas que se avalan entre sí.',
      'Poder ubicarte a través de tus contactos si perdemos contacto contigo.',
    ],
    queNoHacemos: 'No les escribimos, no les ofrecemos nada y no vendemos su información.',
  },
];

/**
 * Una pieza del catálogo aplicada sobre su valor por defecto.
 *
 * Cada campo se sustituye SOLO si viene con contenido. Una entrada creada a medias en el portal
 * —título escrito, viñetas todavía no— dejaría la tarjeta sin las razones por las que se pide el
 * permiso, que es justo lo que da sentido a la pantalla. Mejor mezclar que vaciar.
 */
function aplicar(pieza: PiezaDePermiso, entrada: contentApi.ContentEntry | undefined): PiezaDePermiso {
  if (!entrada) return pieza;
  const vinetas = entrada.bullets.map((vineta) => vineta.text).filter((texto) => texto.trim() !== '');
  return {
    clave: pieza.clave,
    icono: pieza.icono,
    titulo: entrada.title?.trim() || pieza.titulo,
    para: vinetas.length > 0 ? vinetas : pieza.para,
    queNoHacemos: entrada.body?.trim() || pieza.queNoHacemos,
  };
}

export default function Permisos() {
  const router = useRouter();
  const session = useSession();
  const [pidiendo, setPidiendo] = useState(false);
  /*
    Una elección POR PERMISO (APP-12): cada tarjeta tiene su «Permitir» y su «Ahora no». Ver
    `features/decision-de-permisos.ts`. `ubicacionPrevia`: ya consentida antes (desde el domicilio),
    no se vuelve a preguntar ni se retira desde aquí —retirar tiene su sitio: «Privacidad»—.
  */
  const [elecciones, setElecciones] = useState<Elecciones>(SIN_ELEGIR);
  const [pidiendoCual, setPidiendoCual] = useState<keyof Elecciones | null>(null);
  const [ubicacionPrevia, setUbicacionPrevia] = useState(false);

  useEffect(() => {
    let vivo = true;
    void Promise.all([leerDecisionDeArranque(), permisosDeUbicacion()])
      .then(([previa, vigentes]) => {
        if (!vivo || previa?.ubicacion !== true || !vigentes.primerPlano) return;
        setUbicacionPrevia(true);
        setElecciones((actual) => (actual.ubicacion === 'pendiente' ? { ...actual, ubicacion: 'concedido' } : actual));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  /*
    El segundo paso: ofrecer el «siempre» APARTE, y solo a quien concedio la ubicacion.

    Va en un paso propio porque en Android pedirlo no abre un dialogo: saca a la persona de la app y
    la deja en los Ajustes del sistema. Encadenarlo al primer boton la expulsaba en mitad del alta
    sin decirle por que, y dejaba el dialogo de contactos pidiendose por detras de los Ajustes.
  */
  const [paso, setPaso] = useState<'inicio' | 'siempre'>('inicio');
  const [concedido, setConcedido] = useState({ ubicacion: false, contactos: false });

  /*
    El texto lo manda el PORTAL, no esta pantalla.

    Lo que se pide aquí es el consentimiento para dos tratamientos, y esa redacción la escribe quien
    responde de ella —cumplimiento—, no quien compila la app. Cambiar una frase no puede costar una
    publicación en dos tiendas y semanas hasta que la última persona actualice: mientras tanto
    convivirían dos versiones distintas de lo que Atlas dice que hace con tus datos.

    Los valores por defecto se quedan en el código a propósito, y no son un adorno: esta pantalla se
    abre SIN sesión, a veces sin red y siempre antes de que nadie haya cargado nada. Una pantalla de
    permisos en blanco esperando al servidor sería peor que un texto de hace una versión.
  */
  const [cabecera, setCabecera] = useState(CABECERA_POR_DEFECTO);
  const [permisos, setPermisos] = useState<PiezaDePermiso[]>([UBICACION_POR_DEFECTO, CONTACTOS_POR_DEFECTO]);
  const [aviso, setAviso] = useState(AVISO_POR_DEFECTO);
  const [siempre, setSiempre] = useState(SIEMPRE_POR_DEFECTO);

  useEffect(() => {
    let cancelado = false;
    void contentApi.getContent('legal').then((entradas) => {
      if (cancelado || entradas.length === 0) return;
      const buscar = (clave: string) => entradas.find((entrada) => entrada.contentKey === clave);

      const encabezado = buscar(CLAVES.cabecera);
      if (encabezado) {
        setCabecera({
          // El antetítulo viaja en `metadata` porque no es ninguno de los tres campos con nombre
          // propio: no es el título ni el subtítulo, es la línea de contexto de encima.
          antetitulo:
            typeof encabezado.metadata.eyebrow === 'string' && encabezado.metadata.eyebrow.trim() !== ''
              ? encabezado.metadata.eyebrow
              : CABECERA_POR_DEFECTO.antetitulo,
          titulo: encabezado.title?.trim() || CABECERA_POR_DEFECTO.titulo,
          subtitulo: encabezado.subtitle?.trim() || CABECERA_POR_DEFECTO.subtitulo,
        });
      }

      setPermisos([
        aplicar(UBICACION_POR_DEFECTO, buscar(CLAVES.ubicacion)),
        aplicar(CONTACTOS_POR_DEFECTO, buscar(CLAVES.contactos)),
      ]);

      const piezaAviso = buscar(CLAVES.aviso);
      if (piezaAviso?.body?.trim()) setAviso(piezaAviso.body.trim());

      const piezaSiempre = buscar(CLAVES.siempre);
      if (piezaSiempre) {
        setSiempre({
          antetitulo:
            typeof piezaSiempre.metadata.eyebrow === 'string' && piezaSiempre.metadata.eyebrow.trim() !== ''
              ? piezaSiempre.metadata.eyebrow
              : SIEMPRE_POR_DEFECTO.antetitulo,
          titulo: piezaSiempre.title?.trim() || SIEMPRE_POR_DEFECTO.titulo,
          subtitulo: piezaSiempre.subtitle?.trim() || SIEMPRE_POR_DEFECTO.subtitulo,
          cuerpo: piezaSiempre.body?.trim() || SIEMPRE_POR_DEFECTO.cuerpo,
        });
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * El diálogo del sistema de UN permiso, y lo que conteste se queda como la elección de esa tarjeta.
   *
   * Se guarda lo que el sistema contestó, no lo que la persona pulsó aquí —que son cosas distintas
   * cuando alguien acepta en esta pantalla y luego niega el diálogo—. Nada se registra todavía: la
   * decisión se guarda y viaja al servidor al pulsar «Continuar», una fila por finalidad.
   */
  async function permitir(cual: keyof Elecciones) {
    setPidiendoCual(cual);
    try {
      const concedio = cual === 'ubicacion' ? await pedirPermisoDeUbicacion() : await pedirPermisoDeContactos();
      bitacora.permiso(cual, concedio ? 'concedido' : 'denegado');
      setElecciones((actual) => ({ ...actual, [cual]: concedio ? 'concedido' : 'denegado' }));
    } finally {
      setPidiendoCual(null);
    }
  }

  function omitir(cual: keyof Elecciones) {
    bitacora.permiso(cual, 'omitido');
    setElecciones((actual) => ({ ...actual, [cual]: 'omitido' }));
  }

  /**
   * Guarda las dos decisiones —la negativa también: es lo que cierra la sección— y sigue.
   *
   * No se comprueba si concedió para seguir: conceder uno y negar el otro es una decisión legítima y
   * frecuente, y la app funciona en los cuatro casos. El «siempre» se ofrece aparte y sólo a quien
   * tiene la ubicación concedida y todavía no el segundo plano.
   */
  async function continuar() {
    if (faltaPorDecidir(elecciones)) return;
    setPidiendo(true);
    try {
      const vigentes = await permisosDeUbicacion();
      const decision = decisionFinal(elecciones, vigentes.segundoPlano);
      await guardarDecisionDeArranque(decision);
      setConcedido({ ubicacion: decision.ubicacion, contactos: decision.contactos });
      // Dentro del alta hay sesion: la decision viaja al servidor AHORA, no en el proximo inicio.
      if (session.status === 'authenticated') await session.reactivarSeñales();
      if (decision.ubicacion && !vigentes.segundoPlano) {
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
      bitacora.permiso('ubicacion_siempre', siempre ? 'concedido' : 'denegado');
      await guardarDecisionDeArranque({ ...concedido, ubicacionSiempre: siempre });
      if (session.status === 'authenticated') await session.reactivarSeñales();
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
            {/* Dónde tocar: la mano baja sobre el botón que continúa, no sobre «No, gracias». */}
            <IndicadorDeToque testID="indicador-de-toque-siempre" />
            <Button
              label={enAndroid ? 'Abrir ajustes' : 'Permitir siempre'}
              onPress={() => void pedirSiempre()}
              loading={pidiendo}
            />
            <Button label="No, gracias" variant="ghost" onPress={salir} disabled={pidiendo} />
          </View>
        }
      >
        <ScreenHeader eyebrow={siempre.antetitulo} title={siempre.titulo} subtitle={siempre.subtitulo} />

        <Card>
          <CardHeader title="Qué cambia" icon="ubicacion" />
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            <AtlasText variant="body" tone="secondary">
              {siempre.cuerpo}
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
            {enAndroid
              ? 'Tu teléfono mostrará un aviso permanente mientras esté activo, para que sepas siempre que se está registrando. Puedes quitarlo cuando quieras.'
              : 'Puedes quitarlo cuando quieras desde «Privacidad» o desde los ajustes de tu teléfono.'}
          </AtlasText>
        </Card>
      </Screen>
    );
  }

  const falta = faltaPorDecidir(elecciones);

  return (
    <Screen
      footer={
        <Button
          label="Continuar"
          bitacora="continuar"
          onPress={() => void continuar()}
          loading={pidiendo}
          disabled={pidiendo || pidiendoCual !== null || falta !== null}
          blockedReason={falta}
        />
      }
    >
      <ScreenHeader eyebrow={cabecera.antetitulo} title={cabecera.titulo} subtitle={cabecera.subtitulo} />

      {permisos.map((permiso) => {
        const eleccion = elecciones[permiso.clave];
        return (
          <Card key={permiso.clave} testID={`permiso-${permiso.clave}`}>
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
            <Gap size="sm" />
            {eleccion === 'pendiente' ? (
              <View style={{ gap: space.xs }}>
                {/* Dónde tocar: la mano baja sobre el primer «Permitir» que falta. */}
                {permiso.clave === permisos.find((p) => elecciones[p.clave] === 'pendiente')?.clave ? (
                  <IndicadorDeToque testID={`indicador-de-toque-${permiso.clave}`} />
                ) : null}
                <Button
                  label={permiso.clave === 'ubicacion' ? 'Permitir mi ubicación' : 'Permitir mis contactos'}
                  bitacora="permitir"
                  onPress={() => void permitir(permiso.clave)}
                  loading={pidiendoCual === permiso.clave}
                  disabled={pidiendo || pidiendoCual !== null}
                />
                <Button
                  label="Ahora no"
                  bitacora="ahora_no"
                  variant="ghost"
                  onPress={() => omitir(permiso.clave)}
                  disabled={pidiendo || pidiendoCual !== null}
                />
              </View>
            ) : (
              <AtlasText variant="body" tone="secondary" testID={`permiso-${permiso.clave}-estado`}>
                {textoDeEleccion(permiso.clave, eleccion, ubicacionPrevia)}
              </AtlasText>
            )}
          </Card>
        );
      })}

      <Card tone="brand">
        <AtlasText variant="body" tone="secondary">
          {aviso}
        </AtlasText>
      </Card>
    </Screen>
  );
}

/** Lo que queda escrito en la tarjeta una vez decidida: qué se eligió y que se puede cambiar. */
function textoDeEleccion(clave: keyof Elecciones, eleccion: Eleccion, previa: boolean): string {
  const que = clave === 'ubicacion' ? 'tu ubicación' : 'tus contactos';
  if (eleccion === 'concedido') return previa && clave === 'ubicacion' ? 'Ya nos lo habías permitido.' : `Permitiste ${que}.`;
  if (eleccion === 'denegado') return `Tu teléfono no dio acceso a ${que}. Puedes cambiarlo en sus ajustes.`;
  return `No usaremos ${que}. Puedes cambiarlo en «Privacidad».`;
}
