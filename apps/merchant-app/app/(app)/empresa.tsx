/**
 * Mi empresa: `app/portal-comercio/expediente` → `PartnerDossierScreen` del portal web.
 *
 * Los datos del negocio, dónde opera, con qué cobra y el QR que escanean sus clientes, en cuatro
 * pestañas —Estado del expediente · Ficha comercial · Mi QR de cobro · Sucursales— con el `?tab=` de
 * la web (`usePestana`), así un aviso que dice «resuélvelo en Sucursales» aterriza en Sucursales.
 *
 * ## Un expediente para las cuatro
 *
 * El expediente lo resuelve ESTA pantalla una vez (`useMerchantPartner`, el aprobado primero) y se lo
 * pasa a sus pestañas. Cuando cada una lo resolvía por su cuenta, dos pestañas contiguas podían
 * hablar de comercios distintos sin decirlo.
 *
 * ## Las cuatro pestañas se pintan SIEMPRE
 *
 * También sin expediente: cada una dice lo que le falta en vez de desaparecer. Las sucursales son del
 * ERP y existen aunque el expediente no; lo que falta es el QR de sus cajas, y lo dice cada una.
 *
 * ## El PDF es el de la pestaña abierta
 *
 * Como en la web, cada pestaña tiene su documento (Estado y Ficha: la empresa; QR: sus QR;
 * Sucursales: la lista). El ícono de la cabecera descarga el de la pestaña activa; las pestañas con
 * datos propios lo registran con `onPdf` en cuanto tienen algo que imprimir.
 *
 * ## Lo que cambia en una pestaña lo ven las demás
 *
 * Subir el QR cierra el requisito `bank_qr`, y declarar una sucursal o darle cajas cierra `branch`.
 * Las pestañas hijas avisan al terminar (`onDone`) y aquí se relee el expediente: sin eso, «Estado»
 * seguía diciendo que faltaba lo que se acababa de subir en la pestaña de al lado.
 */
import { useCallback, useEffect, useState } from 'react';
import { Screen, ScreenHeader } from '@cliente/ui/layout';
import { EmptyState } from '@cliente/ui/primitives';
import { SIN_EXPEDIENTE } from '@/api/avisosDelComercio';
import { partnerOnboardingService, type PartnerOnboardingState } from '@/api/servicios/partnerOnboardingService';
import type { JsonObject } from '@/api/types';
import { mensajeDe } from '@/features/empresa/errores';
import { documentoMiEmpresa, PESTANAS_EMPRESA } from '@/features/empresa/expediente';
import type { DocumentoPdf } from '@/features/pdf';
import { olvidarDominios, useOpciones } from '@/features/empresa/opciones';
import { useMerchantPartner } from '@/features/use-merchant-partner';
import { Aviso, type TonoAviso } from '@/ui/aviso';
import { AccionesDeCabecera } from '@/ui/acciones-de-cabecera';
import { EstadoDelExpediente, type ExpedientePropio } from '@/ui/empresa/estado-del-expediente';
import { FichaComercial } from '@/ui/empresa/ficha-comercial';
import { QrDeCobro } from '@/ui/empresa/qr-de-cobro';
import { Sucursales } from '@/ui/empresa/sucursales';
import { BarraDePestanas, Panel, usePestana, type Pestana } from '@/ui/pestanas';
import { SelectorDeExpediente } from '@/ui/selector-de-expediente';

const PESTANAS: Pestana<(typeof PESTANAS_EMPRESA)[number]>[] = [
  { id: 'estado', etiqueta: 'Estado del expediente', corta: 'Estado' },
  { id: 'ficha', etiqueta: 'Ficha comercial', corta: 'Ficha' },
  { id: 'qr', etiqueta: 'Mi QR de cobro', corta: 'QR' },
  { id: 'sucursales', etiqueta: 'Sucursales', corta: 'Sucursales' },
];

type Generador = (() => DocumentoPdf) | null;

export default function MiEmpresa() {
  const partner = useMerchantPartner();
  const { partnerId } = partner;
  const [pestana, elegirPestana] = usePestana(PESTANAS_EMPRESA);
  // El rubro lo publica el backend (AtlasBackend es su dueño): la pantalla no lleva su propia copia.
  const rubros = useOpciones('domain:crm.merchantCategory');

  const [state, setState] = useState<PartnerOnboardingState | null>(null);
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: TonoAviso; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  /** Sube al tirar hacia abajo: las pestañas con datos propios (QR, sucursales) los vuelven a pedir. */
  const [vuelta, setVuelta] = useState(0);
  /* El PDF de las pestañas con datos propios. Va envuelto en un objeto: un setState con una función la ejecutaría. */
  const [pdfQr, setPdfQr] = useState<{ generar: Generador }>({ generar: null });
  const [pdfSucursales, setPdfSucursales] = useState<{ generar: Generador }>({ generar: null });
  const registrarPdfQr = useCallback((generar: Generador) => setPdfQr({ generar }), []);
  const registrarPdfSucursales = useCallback((generar: Generador) => setPdfSucursales({ generar }), []);

  /*
    Un expediente distinto no hereda el estado del anterior: se vacía antes de pedir el nuevo, o la
    ficha de un comercio se pintaría unos instantes con los datos del otro.
  */
  useEffect(() => {
    setState(null);
  }, [partnerId]);

  const recargarEstado = useCallback(async () => {
    if (!partnerId) return;
    setCargandoEstado(true);
    try {
      setState(await partnerOnboardingService.getState(partnerId));
      setErrorEstado(null);
    } catch (fallo) {
      setErrorEstado(mensajeDe(fallo, 'No se pudo cargar tu empresa.'));
    } finally {
      setCargandoEstado(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void recargarEstado();
  }, [recargarEstado]);

  /*
    `null` mientras no se sabe si este usuario ya tiene expediente. Distinguirlo de «no tiene» es lo
    que evita ofrecer ABRIR expediente a un comercio que lleva meses operando. Un fallo al preguntar
    NO es «no tiene»: se queda en `buscando` y se explica el error.
  */
  const expedientePropio: ExpedientePropio = partnerId ? 'encontrado' : !partner.cargando && partner.error === SIN_EXPEDIENTE ? 'sin-expediente' : 'buscando';
  const falloAlBuscar = !partner.cargando && partner.error && partner.error !== SIN_EXPEDIENTE ? partner.error : null;

  /** Toda acción termina releyendo el estado: el embudo tiene que reflejar lo que acaba de pasar. */
  const run = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      setBusy(true);
      setFeedback(null);
      try {
        await action();
        await recargarEstado();
        setFeedback({ tone: 'success', text: `${label}: listo.` });
      } catch (error) {
        setFeedback({ tone: 'danger', text: mensajeDe(error, `${label}: no se pudo completar.`) });
      } finally {
        setBusy(false);
      }
    },
    [recargarEstado],
  );

  const abrirExpediente = async (payload: JsonObject) => {
    setBusy(true);
    setFeedback(null);
    try {
      const profile = await partnerOnboardingService.start(payload);
      partner.elegir(profile.partnerId);
      partner.recargar();
      setFeedback({ tone: 'success', text: `Expediente ${profile.partnerId} abierto.` });
    } catch (error) {
      // El 409 por NIT repetido trae el identificador del expediente que ya existe: se enseña tal cual.
      setFeedback({ tone: 'danger', text: mensajeDe(error, 'No se pudo abrir el expediente.') });
    } finally {
      setBusy(false);
    }
  };

  const refrescar = async () => {
    setRefrescando(true);
    olvidarDominios();
    rubros.reintentar();
    partner.recargar();
    setVuelta((v) => v + 1);
    await recargarEstado();
    setRefrescando(false);
  };

  const recargarDesdeHija = useCallback(() => {
    void recargarEstado();
  }, [recargarEstado]);

  const pdf: Generador =
    pestana === 'qr' ? pdfQr.generar : pestana === 'sucursales' ? pdfSucursales.generar : state ? () => documentoMiEmpresa(state) : null;

  return (
    <Screen onRefresh={() => void refrescar()} refreshing={refrescando}>
      <ScreenHeader title="Mi empresa" onBack="auto" action={<AccionesDeCabecera cuenta={false} {...(pdf ? { pdf } : {})} />} />

      <SelectorDeExpediente partner={partner} />

      {feedback ? (
        <Aviso tono={feedback.tone} testID="expediente-feedback">
          {feedback.text}
        </Aviso>
      ) : null}
      {falloAlBuscar ? <Aviso tono="danger">{falloAlBuscar}</Aviso> : null}

      {/* Un fallo al leer el expediente se DICE: una pantalla vacía no distingue «sin datos» de «no se pudo pedir». */}
      {errorEstado && !state ? (
        <Aviso tono="danger" titulo="No se pudo cargar tu empresa">
          {errorEstado}
        </Aviso>
      ) : null}

      <BarraDePestanas pestanas={PESTANAS} activa={pestana} onCambiar={elegirPestana} />

      <Panel visible={pestana === 'estado'}>
        <EstadoDelExpediente
          state={state}
          expedientePropio={expedientePropio}
          partnerId={partnerId}
          busy={busy}
          rubros={rubros.opciones}
          errorRubros={rubros.error}
          run={run}
          onAbrir={abrirExpediente}
          onEnviar={() => void run('Envío a revisión', () => partnerOnboardingService.submit(partnerId))}
          onIrA={elegirPestana}
        />
      </Panel>

      <Panel visible={pestana === 'ficha'}>
        <FichaComercial
          profile={state?.profile ?? null}
          busy={busy}
          rubros={rubros.opciones}
          errorRubros={rubros.error}
          onGuardar={(payload) => void run('Ficha comercial', () => partnerOnboardingService.updateCommercialProfile(partnerId, payload))}
        />
      </Panel>

      <Panel visible={pestana === 'qr'}>
        {state ? (
          <QrDeCobro
            partnerId={partnerId}
            nombre={state.profile.tradeName ?? state.profile.legalName}
            estadoExpediente={state.profile.onboardingStatus}
            onDone={recargarDesdeHija}
            vuelta={vuelta}
            onPdf={registrarPdfQr}
          />
        ) : (
          <EmptyState icon="escanear" title="Primero hay que abrir tu expediente" detail="Ábrelo en «Estado»: son siete campos." />
        )}
      </Panel>

      <Panel visible={pestana === 'sucursales'}>
        <Sucursales partnerId={partnerId} estado={state} cargandoEstado={cargandoEstado} recargarEstado={recargarEstado} vuelta={vuelta} onPdf={registrarPdfSucursales} />
      </Panel>
    </Screen>
  );
}
