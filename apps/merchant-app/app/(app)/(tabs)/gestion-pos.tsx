/**
 * Gestión POS: lo que pasa en la caja, en una sola pantalla. Porte de `MerchantPosScreen` del portal
 * web (`app/portal-comercio/gestion-pos`), con sus tres pestañas: Solicitudes de compra, Comprobantes
 * por verificar (con los pagos iniciales arriba) e Historial.
 *
 * Eran dos entradas de menú en la web —«Solicitudes de compra» y «Comprobantes por verificar»— y son
 * los dos momentos de la MISMA operación: el cliente escanea y pide, el comercio acepta; el cliente
 * transfiere y avisa, el comercio confirma. Los contadores de cada pestaña existen por eso: desde
 * cualquiera se ve si en la otra hay algo esperando.
 *
 * El expediente se resuelve AQUÍ y una sola vez (`useMerchantPartner`): cuando cada pestaña lo
 * resolvía por su cuenta, dos pestañas contiguas podían estar hablando de comercios distintos.
 *
 * Lo que cambia respecto a la web, que tiene «Actualizar» y «Descargar PDF» en cada panel: tirar
 * hacia abajo recarga todas las pestañas, volver a la pantalla también, y decidir en una pestaña
 * recarga las demás —la fila decidida pasa al Historial— (ver `features/gestion-pos/recargas.ts`).
 * Los «Actualizar» se quitaron, y el PDF de la pestaña abierta es el ícono de la cabecera (Pablo,
 * 2026-10-10: la cabecera de cada panel era lo más grande de la pantalla para lo que menos se usa).
 *
 * El contador de «Comprobantes» suma las cuotas Y los pagos iniciales (la web sólo cuenta las
 * cuotas): ver `pendientesDeComprobantes`.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Screen, ScreenHeader } from '@cliente/ui/layout';
import { SkeletonLista } from '@cliente/ui/primitives';
import type { ComprobanteDePago, SolicitudDeCompra } from '@/api/servicios/merchantCreditService';
import { useMerchantPartner } from '@/features/use-merchant-partner';
import { documentoDeComprobantes, documentoDeSolicitudes } from '@/features/gestion-pos/documentos';
import { useRecargas } from '@/features/gestion-pos/recargas';
import { pendientesDeComprobantes } from '@/features/gestion-pos/tarjetas';
import { AccionesDeCabecera } from '@/ui/acciones-de-cabecera';
import { Aviso } from '@/ui/aviso';
import { PanelComprobantes } from '@/ui/gestion-pos/panel-comprobantes';
import { PanelHistorial } from '@/ui/gestion-pos/panel-historial';
import { PanelSolicitudes } from '@/ui/gestion-pos/panel-solicitudes';
import { BarraDePestanas, Panel, usePestana, type Pestana } from '@/ui/pestanas';
import { SelectorDeExpediente } from '@/ui/selector-de-expediente';

const PESTANAS = ['solicitudes', 'comprobantes', 'historial'] as const;
type IdPestana = (typeof PESTANAS)[number];

export default function GestionPos() {
  const partner = useMerchantPartner();
  const [pestana, elegirPestana] = usePestana<IdPestana>(PESTANAS);
  const recargas = useRecargas();
  const [refrescando, setRefrescando] = useState(false);
  const [pendientes, setPendientes] = useState<{ solicitudes: number | null; comprobantes: number | null; iniciales: number | null }>({
    solicitudes: null,
    comprobantes: null,
    iniciales: null,
  });
  /* Lo que lleva el PDF de cada pestaña: las filas que se ven, como el `BotonPdf` de cada panel de la web. */
  const [solicitudes, setSolicitudes] = useState<SolicitudDeCompra[]>([]);
  const [comprobantes, setComprobantes] = useState<ComprobanteDePago[]>([]);

  /*
   * Los contadores se guardan por separado y con `setState` funcional: las pestañas están montadas a
   * la vez y sus cargas terminan cuando terminan, así que la segunda en llegar no puede escribir
   * sobre el resultado de la primera.
   */
  const contarSolicitudes = useCallback((total: number) => {
    setPendientes((previo) => (previo.solicitudes === total ? previo : { ...previo, solicitudes: total }));
  }, []);
  const contarComprobantes = useCallback((total: number) => {
    setPendientes((previo) => (previo.comprobantes === total ? previo : { ...previo, comprobantes: total }));
  }, []);
  const contarIniciales = useCallback((total: number) => {
    setPendientes((previo) => (previo.iniciales === total ? previo : { ...previo, iniciales: total }));
  }, []);
  const cuentaComprobantes = pendientesDeComprobantes(pendientes.comprobantes, pendientes.iniciales);

  /* Tras decidir en una pestaña, las demás vuelven a pedir lo suyo (la que decidió ya se recargó). */
  const alDecidir = useCallback((origen: string) => void recargas.recargar(origen), [recargas]);

  const { recargar: recargarExpediente, error: errorExpediente } = partner;
  const refrescar = useCallback(async () => {
    setRefrescando(true);
    // Si el expediente no se pudo leer, tirar hacia abajo es la forma de reintentarlo.
    if (errorExpediente) recargarExpediente();
    await recargas.recargar();
    setRefrescando(false);
  }, [errorExpediente, recargarExpediente, recargas]);

  /*
   * Al VOLVER a la pantalla (no al entrar la primera vez: el montaje ya cargó). El cajero pasa por
   * Cartera o Soporte con el cliente delante, y la cola de hace dos minutos ya no es la de ahora.
   */
  const primeraVez = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primeraVez.current) {
        primeraVez.current = false;
        return;
      }
      void recargas.recargar();
    }, [recargas]),
  );

  const pestanas: Pestana<IdPestana>[] = [
    {
      id: 'solicitudes',
      etiqueta: 'Solicitudes de compra',
      corta: 'Solicitudes',
      ...(pendientes.solicitudes === null ? {} : { cuenta: pendientes.solicitudes }),
    },
    {
      id: 'comprobantes',
      etiqueta: 'Comprobantes por verificar',
      corta: 'Comprobantes',
      ...(cuentaComprobantes === null ? {} : { cuenta: cuentaComprobantes }),
    },
    // Lo ya respondido y todos los pagos, iniciales y de cuota (Pablo, 2026-10-08).
    { id: 'historial', etiqueta: 'Historial', corta: 'Historial' },
  ];

  /*
   * Mientras se averigua el expediente, la carga es de la PANTALLA, no de cada pestaña. En la web las
   * pestañas reciben `partnerId = ''` durante ese instante y enseñan su «No hay nada esperando»
   * hasta que llega; en un teléfono, con red lenta, ese vacío falso dura lo bastante para leerlo.
   */
  const resolviendoExpediente = partner.cargando && !partner.partnerId;

  /*
   * El PDF de la pestaña abierta, con lo que hay en ella. Sin filas no hay ícono (la web deja el
   * botón apagado); el Historial no tiene PDF en la web, así que aquí tampoco.
   */
  const nombre = partner.nombre;
  const pdf =
    pestana === 'solicitudes' && solicitudes.length
      ? () => documentoDeSolicitudes(solicitudes, nombre)
      : pestana === 'comprobantes' && comprobantes.length
        ? () => documentoDeComprobantes(comprobantes, nombre)
        : undefined;

  return (
    // El aire de abajo es para los botones flotantes (Mi empresa, Soporte, asistente): no tapan la última tarjeta.
    <Screen onRefresh={() => void refrescar()} refreshing={refrescando} contentStyle={{ paddingBottom: 160 }}>
      <ScreenHeader title="Gestión POS" action={<AccionesDeCabecera {...(pdf ? { pdf } : {})} />} />

      <SelectorDeExpediente partner={partner} />
      {partner.error ? <Aviso tono="danger">{partner.error}</Aviso> : null}

      {resolviendoExpediente ? (
        <SkeletonLista filas={2} alto={160} texto="Cargando…" pantalla />
      ) : (
        <>
          <BarraDePestanas pestanas={pestanas} activa={pestana} onCambiar={elegirPestana} />
          <Panel visible={pestana === 'solicitudes'}>
            <PanelSolicitudes
              partnerId={partner.partnerId}
              onCount={contarSolicitudes}
              onFilas={setSolicitudes}
              onDone={alDecidir}
              recargas={recargas}
            />
          </Panel>
          <Panel visible={pestana === 'comprobantes'}>
            <PanelComprobantes
              partnerId={partner.partnerId}
              onCount={contarComprobantes}
              onCountIniciales={contarIniciales}
              onFilas={setComprobantes}
              onDone={alDecidir}
              recargas={recargas}
            />
          </Panel>
          <Panel visible={pestana === 'historial'}>
            <PanelHistorial partnerId={partner.partnerId} recargas={recargas} />
          </Panel>
        </>
      )}
    </Screen>
  );
}
