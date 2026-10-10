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
 */
import { scanFromURLAsync } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@cliente/theme/tokens';
import { IconField, SelectField } from '@cliente/ui/form-controls';
import { FieldLabel } from '@cliente/ui/help-sheet';
import { AtlasText, Badge, Button, Card, CardHeader, Cargando, Divider, EmptyState, KeyValue, Skeleton } from '@cliente/ui/primitives';
import { leerBytes, type ArchivoLocal } from '@/api/almacen';
import { ApiError } from '@/api/client';
import { partnerOnboardingService, uploadQrFile, type PartnerQrCode } from '@/api/servicios/partnerOnboardingService';
import type { JsonObject } from '@/api/types';
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
import { BotonPdf } from '@/ui/boton-pdf';
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
}: {
  partnerId: string;
  nombre: string;
  estadoExpediente: string;
  /** Subir el QR cierra `bank_qr`: «Mi empresa» relee el expediente. */
  onDone: () => void;
  /** Cambia al tirar hacia abajo: se vuelven a pedir los QR. */
  vuelta: number;
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
      {enRevision && !aprobado ? (
        <Aviso tono="info" titulo="Su QR está en revisión">
          Atlas lo revisa antes de enseñárselo a sus clientes. Hasta entonces, la app les dice que el QR está pendiente de aprobación.
        </Aviso>
      ) : null}
      {error ? <Aviso tono="danger">{error}</Aviso> : null}
      {aviso ? (
        <Aviso tono={aviso.tono} testID="qr-cobro-aviso">
          {aviso.texto}
        </Aviso>
      ) : null}
      {!cargando && !aprobado ? (
        <Aviso tono="warning" titulo="Sus clientes todavía no pueden pagarle">
          {enRevision
            ? 'El QR bancario está en revisión. Hasta que Atlas lo apruebe, la app no mostrará un código de pago.'
            : 'Suba su QR bancario. Hasta que Atlas lo apruebe, la app no mostrará un código de pago.'}
        </Aviso>
      ) : null}

      <Card>
        <CardHeader
          title={aprobado ? 'Lo que ve su cliente' : 'QR bancario del comercio'}
          detail={
            aprobado
              ? 'Esta es la imagen exacta que aparece en la app cuando su cliente pulsa «pagar».'
              : 'Vista previa del QR. En cuanto lo confirmes, es el que ven tus clientes al pagar; Atlas no lo revisa antes.'
          }
          icon="telefono"
        />
        <View style={styles.cuerpo}>
          {/* Las acciones de la vista (en la web, en la cabecera del panel). */}
          <View style={styles.acciones}>
            <BotonPdf label="Descargar PDF" testID="pdf-qr" disabled={cargando || !codigos.length} documento={() => documentoQrDeCobro(codigos, nombre, estadoExpediente)} />
            <Button label="Actualizar" icon="refrescar" variant="secondary" disabled={!partnerId} loading={cargando} onPress={() => partnerId && recargar(partnerId)} />
          </View>
          {cargando ? (
            <Cargando texto="Cargando…" />
          ) : vigente ? (
            <View style={styles.vigente}>
              <QrImagen partnerId={partnerId} qrId={vigente.qrId} />
              <KeyValue label="Entidad" value={vigente.bankInstitutionCode ?? '—'} />
              <KeyValue label="Cuenta" value={vigente.accountNumberMasked ?? '—'} />
              <KeyValue label="Huella del archivo" value={vigente.fingerprint} />
              <KeyValue label="Subido" value={fechaHora(vigente.createdAt)} />
              <Badge label={estadoVigente?.texto ?? vigente.status} tone={estadoVigente?.tono ?? 'neutral'} dot />
              {aprobado && enRevision ? (
                <AtlasText variant="caption" tone="tertiary" testID="qr-cobro-nuevo-en-revision">
                  Hay un QR nuevo esperando revisión (huella {enRevision.fingerprint}). Sus clientes siguen viendo el aprobado hasta que Atlas lo apruebe.
                </AtlasText>
              ) : null}
            </View>
          ) : (
            <EmptyState icon="escanear" title="Todavía no hay QR de cobro" detail="Sus clientes ven la instrucción de pago sin código que escanear." />
          )}
        </View>
      </Card>

      <Card>
        <CardHeader
          title={vigente ? 'Reemplazar el QR' : 'Subir mi QR bancario'}
          detail="Se guarda la imagen y su huella, no el número transcrito. El QR anterior queda archivado, nunca se sobrescribe."
          icon="subir"
        />
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
              <Button label={archivo ? 'Elegir otra' : 'Elegir de mis fotos'} icon="galeria" variant="secondary" onPress={() => elegir('fotos')} testID="qr-cobro-fotos" />
              <Button label="Tomar foto" icon="camara" variant="secondary" onPress={() => elegir('camara')} testID="qr-cobro-camara" />
            </View>
          </View>
          {/* La sigla ASFI es lo que permite cruzar el QR con el padrón del regulador. */}
          <SelectField
            label="Entidad (sigla ASFI)"
            value={entidad}
            opciones={conVacia(entidades.opciones, '— Elija su banco —')}
            onChange={setEntidad}
            hint="La entidad que emitió el QR."
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
            hint="Sólo los 4 últimos dígitos, p. ej. ****7890. Si escribes el número entero, lo enmascaramos."
            ayuda="Últimos cuatro dígitos de la cuenta, precedidos de asteriscos. Ej.: ****7890."
            testID="campo-cuenta"
          />
          <Button
            label={vigente ? 'Reemplazar QR de cobro' : 'Subir QR de cobro'}
            icon="subir"
            loading={subiendo}
            disabled={!partnerId || bloqueo !== null}
            blockedReason={bloqueo}
            onPress={() => subir()}
            testID="btn-subir-qr-cobro"
          />
          <AtlasText variant="caption" tone="tertiary">
            Sólo se guarda la cuenta ENMASCARADA: el expediente prueba de quién es la cuenta, no necesita operarla.
          </AtlasText>
        </View>
      </Card>

      {historial.length > 0 ? (
        <Card testID="tabla-qr-historial">
          <CardHeader title={`QR anteriores (${historial.length})`} detail="Se conservan para poder reconstruir contra qué QR se cobró cada día." icon="reloj" />
          {historial.map((codigo, indice) => {
            const estado = estadoDeQr(codigo.status);
            return (
              <View key={codigo.qrId} style={styles.anterior}>
                {indice > 0 ? <Divider /> : null}
                <KeyValue label="Entidad" value={codigo.bankInstitutionCode ?? '—'} />
                <KeyValue label="Cuenta" value={codigo.accountNumberMasked ?? '—'} />
                <KeyValue label="Huella" value={codigo.fingerprint} />
                <KeyValue label="Subido" value={fecha(codigo.createdAt)} />
                <Badge label={estado.texto} tone={estado.tono} dot />
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

      <Aviso tono="info" titulo="Atlas nunca recibe este dinero">
        Su cliente transfiere directo a la cuenta de este QR. Por eso, cuando avise que pagó, es usted quien lo confirma desde «Comprobantes por verificar»: es el único que ve la transferencia en su extracto.
      </Aviso>
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
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  vigente: { gap: space.sm },
  archivo: { gap: space.sm },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
