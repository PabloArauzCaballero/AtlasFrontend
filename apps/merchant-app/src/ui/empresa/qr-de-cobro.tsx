/**
 * La pestaña «Mi QR de cobro» de Mi empresa: el QR del BANCO que ve el cliente cuando pulsa «pagar».
 * Es `MerchantPaymentQrScreen` de la web en su modo embebido.
 *
 * Lo que cambia respecto a la web es sólo el «cómo»:
 *  - la imagen se elige de la fototeca o se toma con la cámara (en la web, un campo de archivo);
 *  - antes de subirla se comprueba que lleva un QR con el lector del teléfono (`scanFromURLAsync` de
 *    expo-camera; en la web, `BarcodeDetector`). Como allí, si el lector falla no bloquea: decide
 *    el servidor;
 *  - la subida va en bytes por `/almacen/subida` (`api/almacen.ts`), nunca como Blob.
 *
 * Un QR se REEMPLAZA, no se edita: el anterior queda archivado con su huella, para poder
 * reconstruir contra qué QR se cobró un día concreto. Y subirlo CIERRA el requisito `bank_qr` del
 * alta, así que al terminar se avisa a «Mi empresa» (`onDone`) para que «Estado» no siga diciendo
 * que falta.
 *
 * En pantalla, dos tarjetas: lo que ve el cliente (con su estado) y el formulario para cambiarlo. Las
 * explicaciones de la web («Atlas nunca recibe este dinero», por qué sólo la cuenta enmascarada) van
 * detrás del ⓘ de cada tarjeta; el PDF, en la cabecera (`onPdf`); «Actualizar», al tirar hacia abajo.
 */
import { scanFromURLAsync } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@cliente/theme/tokens';
import { IconField, SelectField } from '@cliente/ui/form-controls';
import { BotonInfo, FieldLabel, InfoSheet } from '@cliente/ui/help-sheet';
import { AtlasText, Badge, Button, Card, CardHeader, Cargando, Divider, EmptyState, Skeleton } from '@cliente/ui/primitives';
import { leerBytes, type ArchivoLocal } from '@/api/almacen';
import { ApiError } from '@/api/client';
import { partnerOnboardingService, uploadQrFile, type PartnerQrCode } from '@/api/servicios/partnerOnboardingService';
import type { JsonObject } from '@/api/types';
import type { DocumentoPdf } from '@/features/pdf';
import { elegirImagen, tamanoLegible } from '@/features/empresa/archivos';
import { mensajeDe } from '@/features/empresa/errores';
import { conVacia, useOpciones } from '@/features/empresa/opciones';
import {
  AVISO_SIN_QR,
  clasificarQr,
  documentoQrDeCobro,
  estadoDeQr,
  leerCuentaEnmascarada,
  motivoSinSubida,
  tipoDeImagenQr,
  veredictoDeLectura,
  type ComprobacionQr,
} from '@/features/empresa/qr-de-cobro';
import { Aviso, type TonoAviso } from '@/ui/aviso';
import { Reautenticacion } from './reautenticacion';

/** ¿La imagen lleva un QR? Con el lector de códigos del teléfono. Un fallo del lector no es un veredicto. */
async function imagenTieneQr(uri: string): Promise<ComprobacionQr> {
  try {
    return veredictoDeLectura({ resultados: await scanFromURLAsync(uri, ['qr']) });
  } catch (fallo) {
    return veredictoDeLectura({ fallo });
  }
}

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-BO');
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO');

export function QrDeCobro({
  partnerId,
  nombre,
  estadoExpediente,
  onDone,
  vuelta,
  onPdf,
}: {
  partnerId: string;
  nombre: string;
  estadoExpediente: string;
  /** Subir el QR cierra `bank_qr`: «Mi empresa» relee el expediente. */
  onDone: () => void;
  /** Cambia al tirar hacia abajo: se vuelven a pedir los QR. */
  vuelta: number;
  /** El PDF de esta pestaña para la cabecera de «Mi empresa»; `null` mientras no hay QR que listar. */
  onPdf?: (generar: (() => DocumentoPdf) | null) => void;
}) {
  const [codigos, setCodigos] = useState<PartnerQrCode[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: TonoAviso; texto: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [entidad, setEntidad] = useState('');
  // Las entidades con sigla ASFI las publica el backend: tecleada, una sigla mal escrita no cruza con el padrón.
  const entidades = useOpciones('domain:portal.bankInstitution');
  const [cuenta, setCuenta] = useState('');
  const [archivo, setArchivo] = useState<ArchivoLocal | null>(null);
  const [pidiendoContrasena, setPidiendoContrasena] = useState(false);
  /** El QR ya subido cuyo registro se rechazó por `REAUTH_REQUIRED`: al confirmar sólo se reintenta el registro. */
  const registroPendiente = useRef<{ partnerId: string; body: JsonObject } | null>(null);

  const recargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      setCodigos(await partnerOnboardingService.listQrCodes(id));
      setError(null);
    } catch (fallo) {
      setError(mensajeDe(fallo, 'No fue posible leer los QR del comercio.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (partnerId) void recargar(partnerId);
  }, [partnerId, recargar, vuelta]);

  useEffect(() => {
    onPdf?.(!cargando && codigos.length ? () => documentoQrDeCobro(codigos, nombre, estadoExpediente) : null);
  }, [onPdf, cargando, codigos, nombre, estadoExpediente]);

  const [info, setInfo] = useState<'vista' | 'subida' | null>(null);

  const elegir = async (origen: 'fotos' | 'camara') => {
    const { archivo: elegido, permisoNegado } = await elegirImagen(origen);
    if (permisoNegado) {
      setAviso({ tono: 'info', texto: 'Para tomar la foto del QR, permita el uso de la cámara en los ajustes del teléfono.' });
      return;
    }
    if (elegido) {
      setArchivo(elegido);
      setAviso(null);
    }
  };

  /** Comprueba el formulario y, si está bien, pide la contraseña ANTES de tocar nada. */
  const subir = async () => {
    if (!archivo) {
      setAviso({ tono: 'info', texto: 'Elija primero la imagen de su QR bancario.' });
      return;
    }
    if (!entidad.trim()) {
      setAviso({ tono: 'info', texto: 'Elija la entidad de su banco: su sigla es lo que permite cruzarlo con ASFI.' });
      return;
    }
    const cuentaLeida = leerCuentaEnmascarada(cuenta);
    if (!cuentaLeida.ok) {
      setAviso({ tono: 'danger', texto: cuentaLeida.motivo });
      return;
    }
    // Se comprueba ANTES de subir: ahorra el viaje entero al almacén y no deja allí un objeto huérfano.
    if ((await imagenTieneQr(archivo.uri)) === 'sin-codigo') {
      setAviso({ tono: 'danger', texto: AVISO_SIN_QR });
      return;
    }
    setAviso(null);
    registroPendiente.current = null;
    // La sesión de esta app es siempre la del comercio: se pide la contraseña (en la web, `getSessionKind() === 'merchant'`).
    setPidiendoContrasena(true);
  };

  /** Permiso firmado → bytes al almacén → registro con la prueba de reautenticación. */
  const guardar = async (reauthToken: string | undefined) => {
    setSubiendo(true);
    setAviso(null);
    try {
      let pendiente = registroPendiente.current?.partnerId === partnerId ? registroPendiente.current : null;
      if (!pendiente) {
        const cuentaLeida = leerCuentaEnmascarada(cuenta);
        if (!archivo || !cuentaLeida.ok) {
          setAviso({ tono: 'info', texto: 'Vuelva a elegir la imagen de su QR bancario.' });
          return;
        }
        const sizeBytes = archivo.size ?? (await leerBytes(archivo)).length;
        const ticket = await partnerOnboardingService.createQrUploadUrl(partnerId, {
          qrKind: 'bank',
          contentType: tipoDeImagenQr(archivo.type),
          sizeBytes,
        });
        await uploadQrFile(ticket, archivo);
        pendiente = {
          partnerId,
          body: {
            qrKind: 'bank',
            storageKey: ticket.storageKey,
            bankInstitutionCode: entidad.trim().toUpperCase(),
            ...(cuentaLeida.valor ? { accountNumberMasked: cuentaLeida.valor } : {}),
          },
        };
        registroPendiente.current = pendiente;
      }
      await partnerOnboardingService.registerQr(pendiente.partnerId, pendiente.body, reauthToken);
      registroPendiente.current = null;
      setAviso({ tono: 'success', texto: 'QR bancario registrado: desde ahora es el que ven sus clientes al pagar.' });
      setArchivo(null);
      await recargar(partnerId);
      onDone();
    } catch (fallo) {
      if (fallo instanceof ApiError && fallo.code === 'REAUTH_REQUIRED') {
        setAviso({ tono: 'info', texto: 'Su confirmación venció. Escriba otra vez su contraseña para terminar el cambio.' });
        setPidiendoContrasena(true);
        return;
      }
      registroPendiente.current = null;
      setAviso({ tono: 'danger', texto: mensajeDe(fallo, 'No se pudo subir el QR.') });
    } finally {
      setSubiendo(false);
    }
  };

  const { aprobado, enRevision, vigente, ultimoRechazo, historial } = clasificarQr(codigos);
  const bloqueo = motivoSinSubida(estadoExpediente);
  const estadoVigente = vigente ? estadoDeQr(vigente.status) : null;

  return (
    <View style={styles.pestana}>
      {bloqueo ? (
        <Aviso tono="warning" titulo="Ahora mismo no se puede cambiar el QR" testID="qr-cobro-bloqueo">
          {bloqueo}
        </Aviso>
      ) : null}
      {ultimoRechazo && !aprobado && !enRevision ? (
        <Aviso tono="danger" titulo="Atlas rechazó su último QR" testID="qr-cobro-rechazo">
          {ultimoRechazo.reviewNote ?? 'No se indicó el motivo. Suba una imagen nítida del QR de su banco.'}
        </Aviso>
      ) : null}
      {error ? <Aviso tono="danger">{error}</Aviso> : null}
      {aviso ? (
        <Aviso tono={aviso.tono} testID="qr-cobro-aviso">
          {aviso.texto}
        </Aviso>
      ) : null}
      {/* Un solo aviso para «todavía no le pueden pagar»: antes iban dos seguidos diciendo lo mismo. */}
      {!cargando && !aprobado ? (
        <Aviso tono="warning" titulo="Sus clientes todavía no pueden pagarle">
          {enRevision ? 'Su QR está en revisión. Hasta que Atlas lo apruebe, la app no muestra un código de pago.' : 'Suba su QR bancario. Hasta que Atlas lo apruebe, la app no muestra un código de pago.'}
        </Aviso>
      ) : null}

      <Card>
        <CardHeader
          title={aprobado ? 'Lo que ve su cliente' : 'QR bancario'}
          trailing={
            <View style={styles.trailing}>
              {vigente && estadoVigente ? <Badge label={estadoVigente.texto.split(' · ')[0] ?? estadoVigente.texto} tone={estadoVigente.tono} dot /> : null}
              <BotonInfo etiqueta="QR de cobro" onPress={() => setInfo('vista')} testID="info-qr-vista" />
            </View>
          }
        />
        <View style={styles.cuerpo}>
          {cargando ? (
            <Cargando texto="Cargando…" />
          ) : vigente ? (
            <View style={styles.vigente}>
              <QrImagen partnerId={partnerId} qrId={vigente.qrId} />
              <AtlasText variant="body" tone="secondary">
                {[vigente.bankInstitutionCode ?? '—', vigente.accountNumberMasked ?? '—', `subido el ${fechaHora(vigente.createdAt)}`].join(' · ')}
              </AtlasText>
              <AtlasText variant="micro" tone="tertiary" numberOfLines={1} ellipsizeMode="middle" selectable>
                {`Huella ${vigente.fingerprint}`}
              </AtlasText>
              {aprobado && enRevision ? (
                <AtlasText variant="caption" tone="tertiary" testID="qr-cobro-nuevo-en-revision">
                  Hay un QR nuevo en revisión. Sus clientes siguen viendo el aprobado hasta que Atlas lo apruebe.
                </AtlasText>
              ) : null}
            </View>
          ) : (
            <EmptyState icon="escanear" title="Todavía no hay QR de cobro" detail="Sus clientes no tienen código que escanear." />
          )}
        </View>
      </Card>

      <Card>
        <CardHeader title={vigente ? 'Reemplazar el QR' : 'Subir mi QR bancario'} trailing={<BotonInfo etiqueta="Subir el QR" onPress={() => setInfo('subida')} testID="info-qr-subida" />} />
        <View style={styles.cuerpo}>
          <View style={styles.archivo} testID="input-qr-cobro">
            <FieldLabel label="Imagen del QR (PNG o JPG)" ayuda="La imagen del QR que le dio su banco, tal cual: se guarda con su huella para poder comprobarla." />
            {archivo ? (
              <View style={styles.ficha}>
                <Image source={{ uri: archivo.uri }} style={styles.miniatura} resizeMode="contain" accessibilityLabel="Imagen del QR elegida" />
                <View style={styles.fichaTexto}>
                  <AtlasText variant="bodyStrong" numberOfLines={1}>
                    {archivo.name}
                  </AtlasText>
                  <AtlasText variant="caption" tone="tertiary">
                    {tamanoLegible(archivo.size)}
                  </AtlasText>
                </View>
                <Button label="Quitar" icon="papelera" variant="ghost" onPress={() => setArchivo(null)} />
              </View>
            ) : null}
            <View style={styles.fila}>
              <Button label={archivo ? 'Elegir otra' : 'Mis fotos'} icon="galeria" variant="secondary" onPress={() => elegir('fotos')} testID="qr-cobro-fotos" style={styles.mitad} />
              <Button label="Tomar foto" icon="camara" variant="secondary" onPress={() => elegir('camara')} testID="qr-cobro-camara" style={styles.mitad} />
            </View>
          </View>
          {/* La sigla ASFI es lo que permite cruzar el QR con el padrón del regulador. */}
          <SelectField
            label="Entidad (sigla ASFI)"
            value={entidad}
            opciones={conVacia(entidades.opciones, '— Elija su banco —')}
            onChange={setEntidad}
            ayuda="Banco que emitió el QR, por su sigla ASFI. Ej.: BNB."
            error={entidades.error}
            required
          />
          <IconField
            label="Cuenta enmascarada"
            icon="candado"
            value={cuenta}
            onChangeText={setCuenta}
            // Al salir del campo se enmascara a la vista: el número completo no se queda en pantalla.
            onBlur={() => {
              const leida = leerCuentaEnmascarada(cuenta);
              if (leida.ok) setCuenta(leida.valor);
            }}
            autoComplete="off"
            autoCorrect={false}
            keyboardType="phone-pad"
            maxLength={34}
            // El formato se dice a la vista: es lo que evita el rechazo más común.
            hint="Sólo los 4 últimos dígitos, p. ej. ****7890."
            ayuda="Últimos cuatro dígitos de la cuenta, precedidos de asteriscos. Ej.: ****7890. Si escribes el número entero, lo enmascaramos."
            testID="campo-cuenta"
          />
          <View style={styles.pie}>
            <Button
              label={vigente ? 'Reemplazar QR' : 'Subir QR'}
              icon="subir"
              loading={subiendo}
              disabled={!partnerId || bloqueo !== null}
              blockedReason={bloqueo}
              onPress={() => subir()}
              testID="btn-subir-qr-cobro"
            />
          </View>
        </View>
      </Card>

      {historial.length > 0 ? (
        <Card testID="tabla-qr-historial">
          <CardHeader title={`QR anteriores (${historial.length})`} />
          {historial.map((codigo, indice) => {
            const estado = estadoDeQr(codigo.status);
            return (
              <View key={codigo.qrId} style={styles.anterior}>
                {indice > 0 ? <Divider /> : null}
                <View style={styles.filaEntre}>
                  <AtlasText variant="body" style={styles.crece} numberOfLines={1}>
                    {[codigo.bankInstitutionCode ?? '—', codigo.accountNumberMasked ?? '—', fecha(codigo.createdAt)].join(' · ')}
                  </AtlasText>
                  <Badge label={estado.texto} tone={estado.tono} />
                </View>
                {codigo.status === 'rejected' && codigo.reviewNote ? (
                  <AtlasText variant="caption" tone="tertiary">
                    {codigo.reviewNote}
                  </AtlasText>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : null}

      <InfoSheet visible={info === 'vista'} titulo={aprobado ? 'Lo que ve su cliente' : 'QR bancario'} onClose={() => setInfo(null)}>
        <AtlasText variant="body" tone="secondary">
          {aprobado
            ? 'Esta es la imagen exacta que aparece en la app cuando su cliente pulsa «pagar».'
            : 'Vista previa del QR. En cuanto lo confirmes, es el que ven tus clientes al pagar; Atlas no lo revisa antes.'}
        </AtlasText>
        <AtlasText variant="bodyStrong">Atlas nunca recibe este dinero</AtlasText>
        <AtlasText variant="body" tone="secondary">
          Su cliente transfiere directo a la cuenta de este QR. Por eso, cuando avise que pagó, es usted quien lo confirma desde «Comprobantes por verificar»: es el único que ve la transferencia en su extracto.
        </AtlasText>
      </InfoSheet>
      <InfoSheet visible={info === 'subida'} titulo={vigente ? 'Reemplazar el QR' : 'Subir mi QR bancario'} onClose={() => setInfo(null)}>
        <AtlasText variant="body" tone="secondary">
          Se guarda la imagen y su huella, no el número transcrito. El QR anterior queda archivado, nunca se sobrescribe: así se puede reconstruir contra qué QR se cobró cada día.
        </AtlasText>
        <AtlasText variant="body" tone="secondary">
          Sólo se guarda la cuenta ENMASCARADA: el expediente prueba de quién es la cuenta, no necesita operarla.
        </AtlasText>
      </InfoSheet>

      <Reautenticacion
        visible={pidiendoContrasena}
        accion={vigente ? 'reemplazar su QR de cobro' : 'registrar su QR de cobro'}
        onConfirmada={(reauthToken) => {
          setPidiendoContrasena(false);
          void guardar(reauthToken);
        }}
        onCancel={() => {
          setPidiendoContrasena(false);
          registroPendiente.current = null;
          setAviso({ tono: 'info', texto: 'No se cambió el QR de cobro: hace falta confirmar su contraseña.' });
        }}
      />

    </View>
  );
}

/**
 * La imagen del QR subido, traída con la sesión puesta (`apiBlobUrl` → `data:`). Un `<Image>`
 * apuntando a la ruta del backend daría 401 y se leería como «el archivo no está».
 */
function QrImagen({ partnerId, qrId }: { partnerId: string; qrId: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setUri(null);
    setFallo(null);
    partnerOnboardingService
      .qrImageUrl(partnerId, qrId)
      .then((datos) => {
        if (!cancelado) setUri(datos);
      })
      .catch((error: unknown) => {
        if (!cancelado) setFallo(mensajeDe(error, 'No se pudo cargar la imagen del QR.'));
      });
    return () => {
      cancelado = true;
    };
  }, [partnerId, qrId]);

  if (fallo) {
    return (
      <Aviso tono="warning" titulo="No se pudo mostrar el QR">
        {fallo}
      </Aviso>
    );
  }
  if (!uri) return <Skeleton height={224} />;
  return (
    <View style={styles.marcoImagen}>
      <Image source={{ uri }} style={styles.imagen} resizeMode="contain" accessibilityLabel="QR bancario del comercio" testID="qr-cobro-imagen" />
    </View>
  );
}

const styles = StyleSheet.create({
  pestana: { gap: space.base },
  cuerpo: { gap: space.base, marginTop: space.base },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  vigente: { gap: space.sm },
  archivo: { gap: space.sm },
  fila: { flexDirection: 'row', gap: space.sm },
  mitad: { flex: 1 },
  pie: { alignItems: 'flex-end' },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  crece: { flex: 1 },
  ficha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.subtle,
  },
  fichaTexto: { flex: 1, gap: space.xxs },
  miniatura: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: '#ffffff' },
  anterior: { gap: space.xs, paddingTop: space.sm },
  // Fondo blanco aunque la app esté en oscuro: un QR sobre fondo oscuro no se lee igual.
  marcoImagen: { backgroundColor: '#ffffff', borderRadius: radius.md, padding: space.base, alignItems: 'center' },
  imagen: { width: '100%', height: 224 },
});
