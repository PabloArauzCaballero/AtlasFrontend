/**
 * La pestaña «Sucursales» de Mi empresa: `MerchantStructureScreen` de la web en su modo embebido.
 *
 * Es el ÚNICO sitio donde un local se da de alta y se administra, y de él cuelga todo lo que es del
 * local: su estado, sus cajas y el QR que se imprime para cada mostrador. Las sucursales son del ERP
 * y existen aunque el expediente no; lo que falta sin expediente es el QR de sus cajas, y lo dice
 * cada sucursal (por eso la pestaña se pinta también sin expediente).
 *
 * El puente entre las dos vistas de «sucursal» —la del ERP, donde se sitúa cada venta; la del
 * expediente, de donde cuelgan las cajas— es `erpBranchId`, y el cruce va por ahí y NUNCA por el
 * nombre: dos locales pueden llamarse «Sucursal Centro», y enseñar el QR de la otra tienda manda el
 * cobro a la caja equivocada.
 *
 * La tabla de la web pasa a una tarjeta por sucursal, y sus `Modal` a hojas (`ui/empresa/hoja.tsx`).
 * El expediente lo resuelve «Mi empresa» y llega por props: las cuatro pestañas hablan del MISMO.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@cliente/theme/tokens';
import { IconField, SelectField } from '@cliente/ui/form-controls';
import { AtlasText, Badge, Button, Card, CardHeader, Cargando } from '@cliente/ui/primitives';
import { partnerOnboardingService, type PartnerOnboardingState, type PartnerPosTerminal } from '@/api/servicios/partnerOnboardingService';
import { portalService } from '@/api/servicios/portalService';
import type { ResourceRow } from '@/api/types';
import {
  accionDeEstadoDeCaja,
  cantidadDe,
  codigoDeExpediente,
  crearCajas,
  ESTADO_EXPEDIENTE,
  estadoBnplSucursal,
  MAX_CAJAS_POR_VEZ,
  siguienteEstadoDeCaja,
  textoDeCajas,
} from '@/features/empresa/cajas';
import type { DatosCartel } from '@/features/empresa/cartel';
import { mensajeDe } from '@/features/empresa/errores';
import { conVacia, useOpciones } from '@/features/empresa/opciones';
import { ciudadesParaEditar, cuerpoDeAlta, documentoSucursales, lineaDeUbicacion } from '@/features/empresa/sucursales';
import { useMerchantScope } from '@/features/empresa/use-merchant-scope';
import { Aviso } from '@/ui/aviso';
import { BotonPdf } from '@/ui/boton-pdf';
import { HojaDelCartel } from './cartel';
import { Hoja, PieDeHoja } from './hoja';
import { ImportarSucursales } from './importar-sucursales';
import { QrDeCaja } from './qr-de-caja';

type Feedback = { tone: 'success' | 'danger'; text: string } | null;

export function Sucursales({
  partnerId,
  estado,
  cargandoEstado,
  recargarEstado,
  vuelta,
}: {
  partnerId: string;
  /** El expediente que resolvió «Mi empresa»: de él cuelgan las cajas y sus QR. */
  estado: PartnerOnboardingState | null;
  cargandoEstado: boolean;
  /** Relee el expediente en «Mi empresa» (en la web: `recargarExpediente` + `onDone`). */
  recargarEstado: () => Promise<void>;
  vuelta: number;
}) {
  const scope = useMerchantScope();
  const { accountId: queryAccountId, ready } = scope;
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [branchRows, setBranchRows] = useState<ResourceRow[]>([]);
  const [cargandoSucursales, setCargandoSucursales] = useState(false);
  const [errorSucursales, setErrorSucursales] = useState<string | null>(null);

  const recargarSucursales = useCallback(async () => {
    if (!ready) {
      setBranchRows([]);
      return;
    }
    setCargandoSucursales(true);
    try {
      setBranchRows(await portalService.listBranches(queryAccountId));
      setErrorSucursales(null);
    } catch (fallo) {
      setErrorSucursales(mensajeDe(fallo, 'No se pudo consultar.'));
    } finally {
      setCargandoSucursales(false);
    }
  }, [queryAccountId, ready]);

  useEffect(() => {
    void recargarSucursales();
  }, [recargarSucursales, vuelta]);

  /** El local del expediente enlazado con ESTA sucursal del ERP, si ya se declaró. */
  const localDe = (erpBranchId: string) => estado?.branches.find((local) => local.erpBranchId === erpBranchId) ?? null;

  /** Toda acción sobre el expediente termina releyéndolo: la sucursal refleja lo que acaba de pasar. */
  const [ocupada, setOcupada] = useState<string | null>(null);
  const enExpediente = async (etiqueta: string, clave: string, accion: () => Promise<unknown>) => {
    setOcupada(clave);
    setFeedback(null);
    try {
      await accion();
      await recargarEstado();
      setFeedback({ tone: 'success', text: `${etiqueta}: listo.` });
    } catch (error) {
      setFeedback({ tone: 'danger', text: mensajeDe(error, `${etiqueta}: no se pudo completar.`) });
    } finally {
      setOcupada(null);
    }
  };

  /** Declara en el expediente una sucursal que ya existe en el ERP: es lo que habilita su QR. */
  const declarar = (branch: ResourceRow) => {
    const id = String(branch.id);
    return partnerOnboardingService.registerBranch(partnerId, {
      erpBranchId: id,
      branchCode: codigoDeExpediente(id),
      name: String(branch.name ?? 'Sucursal'),
      ...(branch.city ? { city: String(branch.city) } : {}),
      ...(branch.address ? { addressLine: String(branch.address) } : {}),
    });
  };

  /* La ciudad se elige del catálogo: escrita a mano, «Sta. Cruz» y «Santa Cruz» eran dos plazas distintas. */
  const ciudades = useOpciones('catalog:city');

  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState<ResourceRow | null>(null);
  const [errorEstadoSucursal, setErrorEstadoSucursal] = useState<string | null>(null);
  const [nuevaCaja, setNuevaCaja] = useState<{ erpBranchId: string; branchId: string; nombre: string } | null>(null);
  const [qrAmpliado, setQrAmpliado] = useState<{ terminalSerial: string; terminalAlias: string | null } | null>(null);
  const [cartel, setCartel] = useState<DatosCartel | null>(null);
  /** Cuál de los locales YA declarados es esta sucursal, cuando hay alguno sin enlazar. */
  const [adoptar, setAdoptar] = useState('');
  const sinEnlazar = (estado?.branches ?? []).filter((local) => !local.erpBranchId);

  const cambiarEstado = async (branch: ResourceRow) => {
    const activa = String(branch.status) === 'ACTIVE';
    setOcupada(String(branch.id));
    setErrorEstadoSucursal(null);
    try {
      await portalService.setBranchStatus(String(branch.id), activa ? 'INACTIVE' : 'ACTIVE');
      await recargarSucursales();
    } catch (error) {
      setErrorEstadoSucursal(mensajeDe(error, 'No se pudo cambiar el estado.'));
    } finally {
      setOcupada(null);
    }
  };

  /** Tras crear la sucursal: se declara sola en el expediente y, si se pidió, se le crean sus cajas. */
  const alCrear = async (creada: ResourceRow, cantidadCajas: number) => {
    setCreando(false);
    setFeedback({ tone: 'success', text: 'Sucursal registrada correctamente.' });
    if (ready) await recargarSucursales();
    if (!partnerId || !creada?.id) return;
    try {
      const local = await declarar(creada);
      if (cantidadCajas > 0 && local?.branchId) {
        const resultado = await crearCajas({
          partnerId,
          branchId: String(local.branchId),
          erpBranchId: String(creada.id),
          nombreSucursal: String(creada.name ?? 'Sucursal'),
          cantidad: cantidadCajas,
          existentes: [],
        });
        setFeedback({ tone: 'success', text: textoDeCajas('Sucursal registrada', resultado) });
      }
      await recargarEstado();
    } catch (error) {
      // La sucursal YA está creada —no se deshace— y se ofrece reintentarlo desde su tarjeta.
      setFeedback({
        tone: 'danger',
        text: `La sucursal se registró, pero no se pudo enlazar con tu expediente (${mensajeDe(error, 'error desconocido')}). Ábrela en la lista y pulsa «Habilitar QR».`,
      });
    }
  };

  const comercio = estado?.profile.tradeName ?? estado?.profile.legalName ?? 'Mi comercio';

  return (
    <View style={styles.pestana}>
      {scope.requiresSelection ? (
        <Card>
          <SelectField
            label="Negocio"
            value={queryAccountId ?? ''}
            opciones={conVacia(scope.accountOptions, '— Elige uno de tus negocios —')}
            onChange={scope.setAccountId}
            hint="Administras varios negocios: elige de cuál quieres ver las sucursales."
            ayuda="Negocio del que se muestran las sucursales, si administras varios."
          />
        </Card>
      ) : null}

      {scope.error ? (
        <Aviso tono="danger" titulo="No se pudo determinar tu negocio">
          {scope.error}
        </Aviso>
      ) : null}

      {/*
        El teléfono del cliente sólo reconoce las cajas de un comercio con el expediente APROBADO:
        con cualquier otro estado responde «Este QR no es de Atlas» a todos. Ante el propio comercio
        se dice.
      */}
      {estado && estado.profile.onboardingStatus !== 'approved' ? (
        <Aviso tono="warning" titulo="Tu expediente todavía no está aprobado" testID="aviso-expediente-no-aprobado">
          {`Está en «${ESTADO_EXPEDIENTE[estado.profile.onboardingStatus] ?? estado.profile.onboardingStatus}». Mientras no esté aprobado, la app de tus clientes no reconoce ningún QR ni código de tus cajas —aunque la caja esté activa— y responde «Este QR no es de Atlas». Los carteles ya se pueden descargar, pero empezarán a funcionar al aprobarse el expediente.`}
        </Aviso>
      ) : null}

      {feedback ? (
        <Aviso tono={feedback.tone} titulo={feedback.tone === 'danger' ? 'No se pudo completar' : 'Listo'} testID="sucursales-feedback">
          {feedback.text}
        </Aviso>
      ) : null}

      {errorEstadoSucursal ? (
        <Aviso tono="danger" titulo="No se pudo cambiar el estado">
          {errorEstadoSucursal}
        </Aviso>
      ) : null}

      <Card>
        <CardHeader title="Sucursales registradas" detail="Cada fila enseña sus cajas y el QR que se imprime para ese mostrador." icon="comercio" />
        <View style={styles.acciones}>
          <Button label="Agregar sucursal" icon="ubicacion" disabled={!ready} onPress={() => setCreando(true)} testID="btn-agregar-sucursal" />
          <View style={styles.fila}>
            <Button label="Importar desde Excel" icon="subir" variant="secondary" disabled={!ready} onPress={() => setImportando(true)} testID="btn-importar-sucursales" />
            <BotonPdf label="Descargar PDF" testID="pdf-sucursales" disabled={!branchRows.length} documento={() => documentoSucursales(branchRows)} />
            <Button label="Actualizar" icon="refrescar" variant="secondary" loading={cargandoSucursales} disabled={!ready} onPress={() => recargarSucursales()} />
          </View>
        </View>
        {errorSucursales ? (
          <Aviso tono="danger" titulo="No se pudo consultar">
            {errorSucursales}
          </Aviso>
        ) : null}
        {!ready ? (
          <AtlasText variant="caption" tone="tertiary" align="center" style={styles.vacio}>
            {scope.error ? 'No hay nada que mostrar hasta resolver lo de arriba.' : 'Elige uno de tus negocios para ver sus sucursales.'}
          </AtlasText>
        ) : !branchRows.length && !cargandoSucursales ? (
          <AtlasText variant="captionStrong" tone="secondary" align="center" style={styles.vacio}>
            Tu negocio aún no tiene sucursales registradas.
          </AtlasText>
        ) : null}
      </Card>

      {ready
        ? branchRows.map((branch) => {
            const id = String(branch.id);
            const local = localDe(id);
            const terminales = local ? (estado?.posTerminals ?? []).filter((pos) => pos.branchId === local.branchId) : [];
            const bnpl = estadoBnplSucursal(branch);
            const activa = String(branch.status) === 'ACTIVE';
            return (
              <Card key={id}>
                <CardHeader title={String(branch.name ?? '—')} detail={lineaDeUbicacion(branch)} trailing={<Badge label={String(branch.status ?? '—')} tone={activa ? 'success' : 'warning'} dot />} />
                <View style={styles.cuerpo}>
                  <View style={styles.bnpl}>
                    <AtlasText variant="caption" tone="secondary">
                      BNPL
                    </AtlasText>
                    <Badge label={bnpl.texto} tone={bnpl.tono} />
                  </View>
                  <AtlasText variant="caption" tone="tertiary">
                    {bnpl.explicacion}
                  </AtlasText>

                  <View style={styles.cajas} testID={`cajas-de-${id}`}>
                    <AtlasText variant="captionStrong">Cajas y QR</AtlasText>
                    {cargandoEstado && !estado ? (
                      <AtlasText variant="body" tone="secondary">
                        Buscando las cajas de esta sucursal…
                      </AtlasText>
                    ) : !partnerId ? (
                      <AtlasText variant="body" tone="secondary">
                        Todavía no has abierto el expediente de tu empresa, y el QR cuelga de él. Ábrelo en <AtlasText variant="bodyStrong">Estado del expediente</AtlasText> y vuelve aquí.
                      </AtlasText>
                    ) : !local ? (
                      <View style={styles.cajas}>
                        <AtlasText variant="body" tone="secondary">
                          Esta sucursal todavía no está enlazada con tu expediente, así que no puede tener QR.
                        </AtlasText>
                        {sinEnlazar.length ? (
                          <SelectField
                            label="¿Es uno de los locales que ya declaraste?"
                            value={adoptar}
                            onChange={setAdoptar}
                            hint="Si es el mismo mostrador, enlázalo en vez de declararlo otra vez: dos filas para un local son dos QR."
                            ayuda="Si este local ya lo declaraste antes, enlázalo en vez de crearlo otra vez."
                            opciones={[
                              { etiqueta: '— Es un local nuevo —', valor: '' },
                              ...sinEnlazar.map((suelto) => ({ etiqueta: `${suelto.branchCode} · ${suelto.name}`, valor: suelto.branchId })),
                            ]}
                          />
                        ) : null}
                        <Button
                          label="Habilitar QR en esta sucursal"
                          icon="check"
                          loading={ocupada === `declarar-${id}`}
                          testID={`habilitar-qr-${id}`}
                          onPress={() =>
                            enExpediente('Sucursal enlazada', `declarar-${id}`, () =>
                              adoptar ? partnerOnboardingService.linkBranch(partnerId, adoptar, id) : declarar(branch),
                            ).then(() => setAdoptar(''))
                          }
                        />
                      </View>
                    ) : (
                      <View style={styles.cajas}>
                        {terminales.length === 0 ? (
                          <AtlasText variant="body" tone="secondary">
                            Sin cajas dadas de alta: no hay ningún QR que imprimir para este mostrador.
                          </AtlasText>
                        ) : (
                          <View style={styles.rejilla} testID={`rejilla-cajas-${id}`}>
                            {terminales.map((pos) => (
                              <Caja
                                key={pos.terminalId}
                                pos={pos}
                                ocupada={ocupada}
                                onVer={() => setQrAmpliado(pos)}
                                onDescargar={() =>
                                  pos.manualCode
                                    ? setCartel({
                                        serial: pos.terminalSerial,
                                        codigoManual: pos.manualCode,
                                        comercio,
                                        sucursal: String(branch.name ?? 'Sucursal'),
                                        caja: pos.terminalAlias ?? pos.terminalSerial,
                                      })
                                    : undefined
                                }
                                onCambiarEstado={() =>
                                  enExpediente('Estado de la caja', `pos-${pos.terminalId}`, () =>
                                    partnerOnboardingService.changePosStatus(partnerId, pos.terminalId, { status: siguienteEstadoDeCaja(pos.status) }),
                                  )
                                }
                              />
                            ))}
                          </View>
                        )}
                        <Button
                          label="Agregar cajas"
                          icon="lista"
                          variant="secondary"
                          loading={ocupada === `alta-pos-${id}`}
                          testID={`btn-nueva-caja-${id}`}
                          onPress={() => setNuevaCaja({ erpBranchId: id, branchId: local.branchId, nombre: String(branch.name ?? 'esta sucursal') })}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.fila}>
                    <Button label="Editar" icon="editar" variant="secondary" onPress={() => setEditando(branch)} />
                    <Button
                      label={activa ? 'Dar de baja' : 'Reactivar'}
                      icon={activa ? 'cerrar' : 'check'}
                      variant={activa ? 'destructive' : 'secondary'}
                      loading={ocupada === id}
                      onPress={() => cambiarEstado(branch)}
                    />
                  </View>
                </View>
              </Card>
            );
          })
        : null}
      {ready && cargandoSucursales && !branchRows.length ? <Cargando texto="Cargando sucursales…" /> : null}

      <ImportarSucursales
        visible={importando}
        accountId={queryAccountId}
        partnerId={partnerId}
        onClose={() => setImportando(false)}
        onImported={() => {
          void recargarSucursales();
          void recargarEstado();
        }}
      />

      <AltaDeSucursal
        visible={creando}
        ready={ready}
        ciudades={ciudades.opciones}
        onClose={() => setCreando(false)}
        onCreada={(creada, cantidad) => alCrear(creada, cantidad)}
      />

      {editando ? (
        <EdicionDeSucursal
          sucursal={editando}
          ciudades={ciudades.opciones}
          onClose={() => setEditando(null)}
          onGuardada={async () => {
            setEditando(null);
            await recargarSucursales();
          }}
        />
      ) : null}

      <NuevasCajas
        destino={nuevaCaja}
        onClose={() => setNuevaCaja(null)}
        onAgregar={(cantidad, serialPropio) => {
          const destino = nuevaCaja;
          if (!destino) return;
          setNuevaCaja(null);
          void enExpediente(cantidad === 1 ? 'Caja' : `${cantidad} cajas`, `alta-pos-${destino.erpBranchId}`, () =>
            crearCajas({
              partnerId,
              branchId: destino.branchId,
              erpBranchId: destino.erpBranchId,
              nombreSucursal: destino.nombre,
              cantidad,
              existentes: (estado?.posTerminals ?? []).filter((pos) => pos.branchId === destino.branchId),
              ...(serialPropio ? { serialPropio } : {}),
            }),
          );
        }}
      />

      <Hoja
        visible={qrAmpliado !== null}
        titulo={qrAmpliado ? `QR de ${qrAmpliado.terminalAlias ?? qrAmpliado.terminalSerial}` : 'QR'}
        descripcion="El código que escanean tus clientes en este mostrador. Imprímelo y pégalo junto a la caja."
        onClose={() => setQrAmpliado(null)}
        cierre="Cerrar"
        testID="qr-ampliado"
      >
        {qrAmpliado ? (
          <View style={styles.ampliado}>
            <QrDeCaja serial={qrAmpliado.terminalSerial} size={280} />
            <AtlasText variant="h3" align="center">
              {qrAmpliado.terminalAlias ?? qrAmpliado.terminalSerial}
            </AtlasText>
            <AtlasText variant="caption" tone="secondary" align="center" selectable>
              {qrAmpliado.terminalSerial}
            </AtlasText>
          </View>
        ) : null}
      </Hoja>

      <HojaDelCartel datos={cartel} onClose={() => setCartel(null)} />
    </View>
  );
}

/** Una caja: su QR pequeño (toca para verlo en grande), su código a mano, su estado y sus acciones. */
function Caja({
  pos,
  ocupada,
  onVer,
  onDescargar,
  onCambiarEstado,
}: {
  pos: PartnerPosTerminal;
  ocupada: string | null;
  onVer: () => void;
  onDescargar: () => void;
  onCambiarEstado: () => Promise<void>;
}) {
  const nombre = pos.terminalAlias ?? pos.terminalSerial;
  return (
    <View style={styles.caja}>
      <Pressable
        onPress={onVer}
        accessibilityRole="button"
        accessibilityLabel={`Ver en grande el QR de ${nombre}`}
        testID={`btn-ver-qr-${pos.terminalSerial}`}
        style={styles.qrPequeno}
      >
        <QrDeCaja serial={pos.terminalSerial} size={88} />
      </Pressable>
      <AtlasText variant="bodyStrong" align="center" numberOfLines={1}>
        {nombre}
      </AtlasText>
      {/* El serial sólo si el alias no es él mismo: repetirlo no dice nada. */}
      {pos.terminalAlias ? (
        <AtlasText variant="micro" tone="tertiary" align="center" numberOfLines={1}>
          {pos.terminalSerial}
        </AtlasText>
      ) : null}
      {/* El código que se teclea en la app cuando la cámara no lee el QR. Es de ESTA caja. */}
      {pos.manualCode ? (
        <AtlasText variant="caption" tone="secondary" align="center">
          Código a mano:{' '}
          <AtlasText variant="bodyStrong" selectable testID={`codigo-manual-${pos.terminalSerial}`}>
            {pos.manualCode}
          </AtlasText>
        </AtlasText>
      ) : null}
      <Badge label={pos.status} tone={pos.status === 'active' ? 'success' : 'warning'} dot />
      {pos.status !== 'active' ? (
        <AtlasText variant="micro" tone="tertiary" align="center">
          El teléfono del cliente rechaza este código hasta que la caja esté activa.
        </AtlasText>
      ) : null}
      <Button
        label="Descargar QR"
        icon="descargar"
        disabled={!pos.manualCode}
        blockedReason={pos.manualCode ? null : 'Esta caja aún no tiene código manual'}
        onPress={onDescargar}
        testID={`btn-descargar-qr-${pos.terminalSerial}`}
      />
      <Button
        label={accionDeEstadoDeCaja(pos.status)}
        variant="secondary"
        loading={ocupada === `pos-${pos.terminalId}`}
        onPress={onCambiarEstado}
        testID={`btn-estado-pos-${pos.terminalSerial}`}
      />
    </View>
  );
}

const COMPLETA_ESTE_CAMPO = 'Completa este campo.';

/** «Agregar sucursal»: nace activa; vender a crédito en ella lo habilita Atlas aparte. */
function AltaDeSucursal({
  visible,
  ready,
  ciudades,
  onClose,
  onCreada,
}: {
  visible: boolean;
  ready: boolean;
  ciudades: { valor: string; etiqueta: string }[];
  onClose: () => void;
  onCreada: (creada: ResourceRow, cantidadCajas: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const registrar = async () => {
    if (!name.trim()) {
      setIntentado(true);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const creada = await portalService.createBranch(cuerpoDeAlta({ name, city, address }));
      const cajas = cantidadDe(cantidad);
      setName('');
      setCity('');
      setAddress('');
      setCantidad('1');
      setIntentado(false);
      await onCreada(creada, cajas);
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No se pudo registrar la sucursal.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja visible={visible} titulo="Agregar sucursal" descripcion="Registra un local nuevo de tu negocio. Nace activo; vender a crédito en él lo habilita Atlas aparte." onClose={onClose}>
      <IconField
        label="Nombre de sucursal"
        icon="comercio"
        value={name}
        onChangeText={setName}
        placeholder="Sucursal Norte"
        ayuda="Nombre con el que identificas el local. Ej.: Sucursal Equipetrol."
        error={intentado && !name.trim() ? COMPLETA_ESTE_CAMPO : null}
        required
      />
      <SelectField label="Ciudad" value={city} opciones={conVacia(ciudades, '— Sin definir —')} onChange={setCity} ayuda="Ciudad donde está la sede principal; queda registrada en la ficha." />
      <IconField
        label="Dirección"
        icon="ubicacion"
        value={address}
        onChangeText={setAddress}
        placeholder="Av. principal, zona y referencia"
        ayuda="Dirección completa de la casa matriz. Pulsa el pin para verla en el mapa."
      />
      <IconField
        label="Cantidad de cajas"
        icon="lista"
        value={cantidad}
        onChangeText={(texto) => setCantidad(texto.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        maxLength={2}
        hint="Se crean como Caja 1, Caja 2… ya activas, cada una con su QR. Puedes agregar más después."
        ayuda="Cuántas cajas o mostradores cobran en este local. Cada una recibe su QR y se llama Caja 1, Caja 2…"
        testID="campo-cantidad-cajas"
      />
      {error ? <Aviso tono="danger">{error}</Aviso> : null}
      <PieDeHoja>
        <Button label="Registrar sucursal" icon="ubicacion" loading={enviando} disabled={!ready} onPress={() => registrar()} />
        <Button label="Cancelar" variant="secondary" onPress={onClose} />
      </PieDeHoja>
    </Hoja>
  );
}

/** «Editar …»: la sucursal no cambia de negocio (eso movería sus ventas de cuenta). */
function EdicionDeSucursal({
  sucursal,
  ciudades,
  onClose,
  onGuardada,
}: {
  sucursal: ResourceRow;
  ciudades: { valor: string; etiqueta: string }[];
  onClose: () => void;
  onGuardada: () => Promise<void>;
}) {
  const [name, setName] = useState(String(sucursal.name ?? ''));
  const [city, setCity] = useState(String(sucursal.city ?? ''));
  const [address, setAddress] = useState(String(sucursal.address ?? ''));
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    if (!name || !city) {
      setIntentado(true);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await portalService.updateBranch(String(sucursal.id), { name, city, address });
      await onGuardada();
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No se pudo guardar la sucursal.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja visible titulo={`Editar ${String(sucursal.name ?? 'sucursal')}`} descripcion="La sucursal no cambia de negocio: eso movería sus ventas de cuenta." onClose={onClose}>
      <IconField
        label="Nombre de sucursal"
        icon="comercio"
        value={name}
        onChangeText={setName}
        ayuda="Nombre con el que identificas el local. Ej.: Sucursal Equipetrol."
        error={intentado && !name ? COMPLETA_ESTE_CAMPO : null}
        required
      />
      {/* La ciudad guardada se conserva aunque no esté en el catálogo (texto libre de antes). */}
      <SelectField
        label="Ciudad"
        value={city}
        opciones={ciudadesParaEditar(ciudades, sucursal.city)}
        onChange={setCity}
        ayuda="Ciudad donde está la sede principal; queda registrada en la ficha."
        error={intentado && !city ? COMPLETA_ESTE_CAMPO : null}
        required
      />
      <IconField
        label="Dirección"
        icon="ubicacion"
        value={address}
        onChangeText={setAddress}
        ayuda="Dirección completa de la casa matriz. Pulsa el pin para verla en el mapa."
      />
      {error ? <Aviso tono="danger">{error}</Aviso> : null}
      <PieDeHoja>
        <Button label="Guardar cambios" icon="check" loading={enviando} onPress={() => guardar()} />
        <Button label="Cancelar" variant="secondary" onPress={onClose} />
      </PieDeHoja>
    </Hoja>
  );
}

/**
 * «Agregar cajas en …», abierto desde la sucursal: no pregunta a cuál pertenece porque se abrió
 * desde ella. Un desplegable aquí sería la forma exacta de colgar una caja —y su QR— del local equivocado.
 */
function NuevasCajas({
  destino,
  onClose,
  onAgregar,
}: {
  destino: { erpBranchId: string; nombre: string } | null;
  onClose: () => void;
  onAgregar: (cantidad: number, serialPropio: string) => void;
}) {
  const [cantidad, setCantidad] = useState('1');
  const [serial, setSerial] = useState('');
  const [intentado, setIntentado] = useState(false);

  useEffect(() => {
    if (!destino) return;
    setCantidad('1');
    setSerial('');
    setIntentado(false);
  }, [destino]);

  const numero = Number(cantidad);
  const invalida = !cantidad || !Number.isFinite(numero) || numero < 1 || numero > MAX_CAJAS_POR_VEZ;

  return (
    <Hoja
      visible={destino !== null}
      titulo={destino ? `Agregar cajas en ${destino.nombre}` : 'Agregar cajas'}
      descripcion="Cada caja tiene su propio QR: es lo que permite saber en qué mostrador se hizo cada venta."
      onClose={onClose}
    >
      <IconField
        label="Cantidad de cajas a agregar"
        icon="lista"
        value={cantidad}
        onChangeText={(texto) => setCantidad(texto.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        maxLength={2}
        ayuda="Cuántas cajas o mostradores nuevos agregar. Se numeran a continuación de las que ya tiene: Caja 3, Caja 4…"
        error={intentado && invalida ? `Escribe un número entre 1 y ${MAX_CAJAS_POR_VEZ}.` : null}
        required
        testID={destino ? `campo-cantidad-cajas-${destino.erpBranchId}` : undefined}
      />
      <IconField
        label="Serial propio (opcional, sólo para una caja)"
        icon="etiqueta"
        value={serial}
        onChangeText={setSerial}
        autoCapitalize="characters"
        autoCorrect={false}
        hint="Déjalo vacío para que Atlas lo genere: NOMBRE-DE-LA-SUCURSAL-…-CAJA-N."
        ayuda="Sólo si tu terminal ya trae un número de serie y quieres que el QR lo use. Si lo dejas vacío, Atlas lo genera."
        testID={destino ? `campo-pos-serial-${destino.erpBranchId}` : undefined}
      />
      <PieDeHoja>
        <Button
          label="Agregar cajas"
          icon="lista"
          testID={destino ? `btn-registrar-pos-${destino.erpBranchId}` : undefined}
          onPress={() => {
            if (invalida) {
              setIntentado(true);
              return;
            }
            onAgregar(cantidadDe(cantidad), serial.trim());
          }}
        />
        <Button label="Cancelar" variant="secondary" onPress={onClose} />
      </PieDeHoja>
    </Hoja>
  );
}

const styles = StyleSheet.create({
  pestana: { gap: space.base },
  acciones: { gap: space.sm, marginTop: space.base },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  vacio: { paddingVertical: space.xl },
  cuerpo: { gap: space.md, marginTop: space.base },
  bnpl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cajas: { gap: space.sm },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  caja: {
    width: '48.5%',
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.subtle,
    alignItems: 'stretch',
  },
  qrPequeno: { alignSelf: 'center' },
  ampliado: { alignItems: 'center', gap: space.sm },
});
