/**
 * El estado de TU caso de verificacion.
 *
 * ## Por que es una pantalla y no una tarjeta al final del formulario
 *
 * Porque el veredicto llega DESPUES y a veces mucho despues. La tarjeta que habia al pie de
 * «Tu documento» solo podia enseñar el resultado si la persona seguia ahi cuando llegaba, y un caso
 * derivado a revision humana tarda horas: la tarjeta se quedaba en «lo esta revisando una persona»
 * y esa frase moria con la pantalla. Quien cerraba la app no tenia forma de volver a preguntarlo.
 *
 * Con una pantalla propia el caso tiene una direccion. Se entra al enviar, se puede volver desde el
 * indice del registro, y lo que se ve es el estado de AHORA y no el de hace media hora.
 *
 * ## Los dos botones del rechazo, y por que son dos
 *
 * Un rechazo sin salida es un callejon. La persona ve «no pudimos validar tu documento», que es
 * cierto y no le sirve de nada: no sabe si el problema es suyo —una foto movida— o nuestro, y no
 * tiene a quien preguntar.
 *
 * - **Intentar de nuevo** vuelve a la captura. Cubre el caso mayoritario, que es una foto mala, y lo
 *   cubre en el sitio donde se arregla.
 * - **Pedir ayuda** abre el canal de soporte real. Cubre el caso que la persona NO puede arreglar
 *   —un carnet legitimo que el motor no lee, un nombre que no coincide con el registro— y que sin
 *   este boton termina en abandono silencioso.
 *
 * El enlace de soporte viene del SERVIDOR (`app-content`, superficie `help`), igual que en la
 * pantalla de ayuda: el numero de WhatsApp no puede vivir en la app, porque corregirlo obligaria a
 * publicar en dos tiendas.
 *
 * ## Por que el sondeo se detiene
 *
 * Se pregunta cada dos segundos y se para a los veinte intentos. Pasado eso ya no es una espera: es
 * una pantalla que consume bateria y datos por si acaso. Queda el boton de actualizar, que es lo que
 * alguien que vuelve una hora despues necesita de verdad.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as contentApi from '../../src/api/endpoints/app-content';
import * as identityEngine from '../../src/api/endpoints/identity-engine';
import { describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { ContentActionButton } from '../../src/ui/content';
import { guardarLecturaDelCarnet } from '../../src/features/lectura-del-carnet';
import { Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, CardHeader, ErrorState, Skeleton } from '../../src/ui/primitives';

/** Cada cuanto se vuelve a preguntar, y cuantas veces. Ver la cabecera. */
const CADA_MS = 2_000;
const MAX_INTENTOS = 20;

type Estado = identityEngine.IdentityVerificationState;

/**
 * Lo que se le dice a la persona en cada estado.
 *
 * Esta escrito en terminos de LO QUE PUEDE HACER y no de lo que el sistema hizo. `VERIFIED`,
 * `IN_REVIEW` y `UNAVAILABLE` son estados de un tramite; «puedes seguir», «te avisamos» y «no
 * tienes que hacer nada» son instrucciones, que es lo que alguien delante de un telefono necesita.
 *
 * `UNAVAILABLE` **no es un rechazo** y no se pinta como uno. Significa que no se pudo preguntar, y
 * el documento sigue su camino normal: revision humana. Pintarlo en rojo le diria a alguien
 * perfectamente verificable que fallo, y le haria repetir unas fotos que estaban bien.
 */
const COPY: Record<Estado, { titulo: string; detalle: string; tono: 'success' | 'warning' | 'danger' | 'info' }> = {
  PENDING: {
    titulo: 'Estamos revisando tu documento',
    detalle: 'Tarda unos segundos. No cierres la app todavía.',
    tono: 'info',
  },
  VERIFIED: {
    titulo: 'Identidad verificada',
    detalle: 'Confirmamos que el documento es tuyo. Ya puedes continuar con tu registro.',
    tono: 'success',
  },
  IN_REVIEW: {
    titulo: 'Lo está revisando una persona',
    detalle:
      'Tu caso necesita una segunda mirada. Sigue con el registro: te avisamos en cuanto termine, normalmente el mismo día.',
    tono: 'warning',
  },
  REJECTED: {
    titulo: 'No pudimos validar tu documento',
    detalle:
      'Lo más común es que la foto salga movida, con reflejo o con el carnet cortado. Puedes volver a intentarlo, y si crees que hay un error escríbenos.',
    tono: 'danger',
  },
  UNAVAILABLE: {
    titulo: 'No pudimos verificarlo automaticamente',
    detalle: 'Tu documento quedó guardado y lo revisará una persona. No tienes que hacer nada más.',
    tono: 'info',
  },
};

/** Los motivos del motor, en palabras de la persona. Lo que no este aqui no se pinta. */
const MOTIVOS: Record<string, string> = {
  DOCUMENTO_NO_VALIDO: 'La imagen no parece un carnet de identidad boliviano vigente.',
  IDENTIDAD_NO_COINCIDE: 'La cara de la selfie y la del carnet no coinciden lo suficiente.',
  SOSPECHA_DE_FRAUDE: 'Encontramos algo en el documento que necesita comprobarse a mano.',
  REQUIERE_REVISION: 'Hace falta que una persona lo confirme.',
  IDENTIDAD_CONFIRMADA: 'Todo cuadra.',
};

export default function EstadoDeVerificacion() {
  const router = useRouter();
  const session = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [vista, setVista] = useState<identityEngine.IdentityVerificationView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [consultando, setConsultando] = useState(false);
  const [ayuda, setAyuda] = useState<contentApi.ContentEntry[]>([]);
  const intentos = useRef(0);

  const consultar = useCallback(async () => {
    if (!id) return;
    setConsultando(true);
    try {
      setVista(await identityEngine.getIdentityVerification(id));
      setError(null);
    } catch (caught) {
      setError(caught);
    } finally {
      setConsultando(false);
    }
  }, [id]);

  /*
    El sondeo vive en un `setTimeout` encadenado y no en un `setInterval`.

    Un intervalo dispara la peticion siguiente aunque la anterior no haya vuelto, y sobre una red
    lenta eso apila consultas hasta que todas contestan a la vez. Encadenando, la espera empieza
    cuando la respuesta llega.
  */
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    const ciclo = async () => {
      if (!vivo) return;
      await consultar();
      if (!vivo) return;
      intentos.current += 1;
      // El estado se relee del propio `setVista` en el render; aqui basta con parar cuando ya no
      // haya nada que esperar. `esFinal` lo decide en un solo sitio.
      temporizador = setTimeout(() => void ciclo(), CADA_MS);
    };
    void ciclo();

    return () => {
      vivo = false;
      if (temporizador) clearTimeout(temporizador);
    };
    // Solo al montar: el ciclo se detiene solo por `MAX_INTENTOS` y por el estado final.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /*
    Se para cuando el tramite termino o cuando se agotaron los intentos. Va en su propio efecto
    porque la condicion depende del ESTADO, y meterla en el ciclo obligaria a leer estado de React
    dentro de un `setTimeout`, que es donde se queda congelado el valor de la primera vuelta.
  */
  const terminado = vista !== null && identityEngine.esFinal(vista.status);
  useEffect(() => {
    if (terminado) intentos.current = MAX_INTENTOS;
  }, [terminado]);

  useEffect(() => {
    let cancelado = false;
    void contentApi.getContent('help').then((entradas) => {
      if (!cancelado) setAyuda(entradas);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const estado: Estado = vista?.status ?? 'PENDING';
  const copy = COPY[estado];
  const described = error ? describeError(error) : null;
  const motivo = vista?.reason ? MOTIVOS[vista.reason] : null;

  /*
    Lo leido del carnet se guarda al terminar el tramite, y el siguiente paso es CONFIRMARLO: por
    eso se sale a «tus datos» y no al indice. Sin lectura se sale igual: la pantalla pide los datos
    a mano.
  */
  useEffect(() => {
    if (terminado) void guardarLecturaDelCarnet(vista?.extracted);
  }, [terminado, vista?.extracted]);

  const seguir = () => {
    void session.refresh();
    router.replace('/(onboarding)/perfil');
  };

  return (
    <Screen
      footer={
        estado === 'REJECTED' ? (
          <>
            {/*
              «Intentar de nuevo» es el boton PRINCIPAL del rechazo: cubre el caso mayoritario —una
              foto mala— y lo cubre en el sitio donde se arregla. Se vuelve a la captura, no al
              indice del registro: mandar a alguien al indice le obliga a encontrar por su cuenta
              cual de los ocho pasos volvio a ponerse en rojo.
            */}
            <Button label="Intentar de nuevo" onPress={() => router.replace('/(onboarding)/identidad')} haptic="success" />
            <Button label="Seguir con el registro" variant="ghost" onPress={seguir} />
          </>
        ) : (
          <Button
            label={estado === 'VERIFIED' ? 'Continuar' : 'Seguir con el registro'}
            onPress={seguir}
            haptic="success"
          />
        )
      }
    >
      <ScreenHeader
        title="Estado de tu verificación"
        subtitle="Lo que sabemos ahora mismo de tu caso."
        onBack="auto"
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {!id ? (
        <Card>
          <CardHeader
            icon="alerta"
            iconTone="warning"
            title="No hay ningún caso que consultar"
            detail="Vuelve al paso del documento y envía tus fotos."
            divider={false}
          />
          <Button
            label="Ir a mi documento"
            variant="secondary"
            onPress={() => router.replace('/(onboarding)/identidad')}
          />
        </Card>
      ) : null}

      {id && !vista ? (
        <Card>
          <Skeleton height={23} width="60%" />
          <Skeleton height={1} />
          <Skeleton height={23} width="80%" />
        </Card>
      ) : null}

      {vista ? (
        <Card tone={estado === 'VERIFIED' ? 'success' : 'default'}>
          <CardHeader
            icon={estado === 'VERIFIED' ? 'check' : estado === 'REJECTED' ? 'alerta' : 'reloj'}
            iconTone={copy.tono === 'danger' ? 'danger' : copy.tono === 'success' ? 'success' : 'warning'}
            title={copy.titulo}
            detail={copy.detalle}
            trailing={<Badge dot label={etiqueta(estado)} tone={copy.tono === 'info' ? 'neutral' : copy.tono} />}
          />
          {motivo ? (
            <AtlasText variant="body" tone="secondary">
              {motivo}
            </AtlasText>
          ) : null}
          {/*
            El identificador del caso se enseña SIEMPRE, tambien cuando todo fue bien.

            Es lo que alguien tiene que poder leerle a quien le atienda. Sin el, «no me deja pasar»
            obliga a buscar el expediente por nombre y fecha, que es la conversacion que hace que un
            problema de dos minutos dure veinte.
          */}
          <AtlasText variant="caption" tone="tertiary" numberOfLines={1}>
            Caso {vista.verificationId}
          </AtlasText>
          <View>
            <Button
              label={consultando ? 'Actualizando…' : 'Actualizar estado'}
              variant="ghost"
              haptic="none"
              disabled={consultando}
              onPress={() => void consultar()}
            />
          </View>
        </Card>
      ) : null}

      {/*
        Pedir ayuda aparece SOLO en el rechazo.

        En los demas estados no hay nada que preguntar —o se paso, o hay que esperar— y un boton de
        soporte visible en todas las pantallas se convierte en ruido: cuando de verdad hace falta, ya
        nadie lo mira. Aqui es la segunda salida del unico estado que la necesita.
      */}
      {estado === 'REJECTED'
        ? ayuda.map((entrada) => (
            <Card key={entrada.contentKey}>
              <CardHeader
                icon="telefono"
                title={entrada.title ?? 'Pedir ayuda'}
                detail={entrada.subtitle ?? 'Escríbenos y lo miramos contigo.'}
                divider={false}
              />
              <ContentActionButton action={entrada.action} onScreen={(ruta) => router.push(ruta as never)} />
            </Card>
          ))
        : null}
    </Screen>
  );
}

function etiqueta(estado: Estado): string {
  if (estado === 'VERIFIED') return 'verificado';
  if (estado === 'REJECTED') return 'rechazado';
  if (estado === 'IN_REVIEW') return 'en revisión';
  if (estado === 'UNAVAILABLE') return 'pendiente';
  return 'procesando';
}
