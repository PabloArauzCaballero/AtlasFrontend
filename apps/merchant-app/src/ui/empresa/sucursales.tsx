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
 * Cada tarjeta: el nombre y su estado en español, una línea con ciudad y dirección, si vende a
 * crédito, y sus cajas como filas compactas (el QR pequeño abre el grande). «Editar» y «Dar de baja»
 * van al pie en una fila de dos. El PDF va a la cabecera de «Mi empresa» (`onPdf`) y «Actualizar»
 * es tirar hacia abajo.
 * El expediente lo resuelve «Mi empresa» y llega por props: las cuatro pestañas hablan del MISMO.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@cliente/theme/tokens';
import { IconField, SelectField } from '@cliente/ui/form-controls';
import { AtlasText, Badge, Button, Card, CardHeader, Cargando, Divider, EmptyState, IconButton } from '@cliente/ui/primitives';
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
import { estadoDeCaja, estadoDeSucursal } from '@/features/empresa/expediente';
import type { DocumentoPdf } from '@/features/pdf';
import { conVacia, useOpciones } from '@/features/empresa/opciones';
import { ciudadesParaEditar, cuerpoDeAlta, documentoSucursales, lineaDeUbicacion } from '@/features/empresa/sucursales';
import { useMerchantScope } from '@/features/empresa/use-merchant-scope';
import { Aviso } from '@/ui/aviso';
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
  onPdf,
}: {
  partnerId: string;
  /** El expediente que resolvió «Mi empresa»: de él cuelgan las cajas y sus QR. */
  estado: PartnerOnboardingState | null;
  cargandoEstado: boolean;
  /** Relee el expediente en «Mi empresa» (en la web: `recargarExpediente` + `onDone`). */
  recargarEstado: () => Promise<void>;
  vuelta: number;
  /** El PDF de esta pestaña para la cabecera de «Mi empresa»; `null` sin sucursales. */
  onPdf?: (generar: (() => DocumentoPdf) | null) => void;
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

  useEffect(() => {
    onPdf?.(branchRows.length ? () => documentoSucursales(branchRows) : null);
  }, [onPdf, branchRows]);

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
          {`Está en «${ESTADO_EXPEDIENTE[estado.profile.onboardingStatus] ?? estado.profile.onboardingStatus}». Hasta que se apruebe, la app de tus clientes no reconoce los QR de tus cajas. Los carteles ya se pueden descargar.`}
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

      <View style={styles.fila}>
        <Button
          label="Importar"
          icon="subir"
          variant="secondary"
          disabled={!ready}
          onPress={() => setImportando(true)}
          testID="btn-importar-sucursales"
          style={styles.mitad}
        />
        <Button label="Agregar" icon="ubicacion" disabled={!ready} onPress={() => setCreando(true)} testID="btn-agregar-sucursal" style={styles.mitad} />
      </View>
      {errorSucursales ? (
        <Aviso tono="danger" titulo="No se pudo consultar">
          {errorSucursales}
        </Aviso>
      ) : null}
      {!ready ? (
        <EmptyState icon="comercio" title="Sin negocio elegido" detail={scope.error ? 'No hay nada que mostrar hasta resolver lo de arriba.' : 'Elige uno de tus negocios.'} />
      ) : !branchRows.length && !cargandoSucursales && !errorSucursales ? (
        <EmptyState icon="comercio" title="Sin sucursales" detail="Agrega la primera con el botón de arriba." />
      ) : null}

      {ready
        ? branchRows.map((branch) => {
            const id = String(branch.id);
            const local = localDe(id);
            const terminales = local ? (estado?.posTerminals ?? []).filter((pos) => pos.branchId === local.branchId) : [];
            const bnpl = estadoBnplSucursal(branch);
            const activa = String(branch.status) === 'ACTIVE';
            const estadoSucursal = estadoDeSucursal(branch.status);
            return (
              <Card key={id} testID={`sucursal-${id}`}>
                <CardHeader title={String(branch.name ?? '—')} detail={lineaDeUbicacion(branch)} trailing={<Badge label={estadoSucursal.texto} tone={estadoSucursal.tono} dot />} />
                <View style={styles.cuerpo}>
                  <View style={styles.filaEntre} accessible accessibilityLabel={`Venta a crédito: ${bnpl.texto}. ${bnpl.explicacion}`}>
                    <AtlasText variant="caption" tone="secondary">
                      Venta a crédito
                    </AtlasText>
                    <Badge label={bnpl.texto} tone={bnpl.tono} />
                  </View>

                  <View style={styles.cajas} testID={`cajas-de-${id}`}>
                    <AtlasText variant="captionStrong" tone="secondary">
                      Cajas
                    </AtlasText>
                    {cargandoEstado && !estado ? (
                      <AtlasText variant="caption" tone="tertiary">
                        Buscando las cajas…
                      </AtlasText>
                    ) : !partnerId ? (
                      <AtlasText variant="caption" tone="tertiary">
                        Abre tu expediente en «Estado» para tener QR.
                      </AtlasText>
                    ) : !local ? (
                      <View style={styles.cajas}>
                        <AtlasText variant="caption" tone="tertiary">
                          Sin enlazar con tu expediente: todavía no puede tener QR.
                        </AtlasText>
                        {sinEnlazar.length ? (
                          <SelectField
                            label="¿Es uno de los locales que ya declaraste?"
                            value={adoptar}
                            onChange={setAdoptar}
                            ayuda="Si este local ya lo declaraste antes, enlázalo en vez de crearlo otra vez: dos filas para un local son dos QR."
                            opciones={[
                              { etiqueta: '— Es un local nuevo —', valor: '' },
                              ...sinEnlazar.map((suelto) => ({ etiqueta: `${suelto.branchCode} · ${suelto.name}`, valor: suelto.branchId })),
                            ]}
                          />
                        ) : null}
                        <Button
                          label="Habilitar QR"
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
                      <View>
                        {terminales.length === 0 ? (
                          <AtlasText variant="caption" tone="tertiary">
                            Sin cajas: no hay QR que imprimir.
                          </AtlasText>
                        ) : (
                          <View testID={`rejilla-cajas-${id}`}>
                            {terminales.map((pos, indice) => (
                              <View key={pos.terminalId}>
                                {indice > 0 ? <Divider /> : null}
                                <Caja
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
                              </View>
                            ))}
                          </View>
                        )}
                        <Enlace
                          texto="+ Agregar cajas"
                          ocupado={ocupada === `alta-pos-${id}`}
                          testID={`btn-nueva-caja-${id}`}
                          onPress={() => setNuevaCaja({ erpBranchId: id, branchId: local.branchId, nombre: String(branch.name ?? 'esta sucursal') })}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.fila}>
                    <Button label="Editar" icon="editar" variant="secondary" onPress={() => setEditando(branch)} style={styles.mitad} />
                    <Button
                      label={activa ? 'Dar de baja' : 'Reactivar'}
                      icon={activa ? 'cerrar' : 'check'}
                      variant={activa ? 'destructive' : 'secondary'}
                      loading={ocupada === id}
                      onPress={() => cambiarEstado(branch)}
                      style={styles.mitad}
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

/** Un enlace de texto con su spinner: para la acción secundaria de una tarjeta, que no merece un botón a lo ancho. */
function Enlace({ texto, onPress, ocupado = false, testID, tono = 'brand' }: { texto: string; onPress: () => void; ocupado?: boolean; testID?: string; tono?: 'brand' | 'danger' | 'secondary' }) {
  return (
    <Pressable
      onPress={ocupado ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={texto.replace(/^\+\s*/, '')}
      accessibilityState={{ busy: ocupado }}
      hitSlop={8}
      style={styles.enlace}
      testID={testID}
    >
      {ocupado ? <ActivityIndicator size="small" color={color.text.secondary} /> : null}
      <AtlasText variant="captionStrong" tone={tono}>
        {texto}
      </AtlasText>
    </Pressable>
  );
}

/**
 * Una caja en UNA fila: su QR pequeño (toca para verlo en grande), su nombre y el código a mano, su
 * estado en español y, a la derecha, descargar el cartel. Activar o suspender va como enlace debajo
 * del nombre: es lo que menos se usa y no puede competir con el QR.
 */
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
  const estado = estadoDeCaja(pos.status);
  const accion = accionDeEstadoDeCaja(pos.status);
  return (
    <View style={styles.caja} testID={`caja-${pos.terminalSerial}`}>
      <Pressable onPress={onVer} accessibilityRole="button" accessibilityLabel={`Ver en grande el QR de ${nombre}`} testID={`btn-ver-qr-${pos.terminalSerial}`} style={styles.qrPequeno}>
        <QrDeCaja serial={pos.terminalSerial} size={44} />
      </Pressable>
      <View style={styles.crece}>
        <AtlasText variant="bodyStrong" numberOfLines={1}>
          {nombre}
        </AtlasText>
        {/* El código que se teclea en la app cuando la cámara no lee el QR. Es de ESTA caja. */}
        {pos.manualCode ? (
          <AtlasText variant="caption" tone="secondary" numberOfLines={1}>
            Código{' '}
            <AtlasText variant="captionStrong" selectable testID={`codigo-manual-${pos.terminalSerial}`}>
              {pos.manualCode}
            </AtlasText>
          </AtlasText>
        ) : null}
        <Enlace
          texto={accion}
          tono={accion === 'Suspender' ? 'secondary' : 'brand'}
          ocupado={ocupada === `pos-${pos.terminalId}`}
          onPress={() => void onCambiarEstado()}
          testID={`btn-estado-pos-${pos.terminalSerial}`}
        />
      </View>
      <Badge label={estado.texto} tone={estado.tono} dot />
      {pos.manualCode ? <IconButton icon="descargar" label={`Descargar el cartel del QR de ${nombre}`} onPress={onDescargar} testID={`btn-descargar-qr-${pos.terminalSerial}`} /> : null}
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
    <Hoja visible={visible} titulo="Agregar sucursal" descripcion="Nace activa; vender a crédito en ella lo habilita Atlas aparte." onClose={onClose}>
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
        hint="Déjalo vacío para que Atlas lo genere."
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
  fila: { flexDirection: 'row', gap: space.sm },
  mitad: { flex: 1 },
  cuerpo: { gap: space.md, marginTop: space.base },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cajas: { gap: space.sm },
  caja: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  crece: { flex: 1, gap: space.xxs },
  qrPequeno: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: color.border.subtle },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', paddingVertical: space.xxs },
  ampliado: { alignItems: 'center', gap: space.sm },
});
