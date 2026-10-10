/**
 * «Importar desde Excel» en Sucursales: `ImportarSucursalesModal` + `ExcelImportModal` de la web.
 *
 * Mismo recorrido: descargar la plantilla, elegir el archivo (.xlsx o .csv), ver antes de crear NADA
 * qué filas están completas y cuáles no, y crear las sucursales de UNA en UNA por el mismo camino que
 * un alta a mano. Cuando una falla se sabe cuál y por qué, en vez de perderlas todas por la fila 34.
 *
 * En el teléfono la plantilla se entrega a la hoja de compartir (de ahí a Archivos, a un correo o a
 * Excel) y el archivo se elige con el selector de documentos del sistema.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { FieldLabel } from '@cliente/ui/help-sheet';
import { AtlasText, Badge, Button, Card, Divider } from '@cliente/ui/primitives';
import { leerBytes, type ArchivoLocal } from '@/api/almacen';
import { guardarArchivo } from '@/features/pdf';
import { avisoDePeso, elegirDocumento, tamanoLegible } from '@/features/empresa/archivos';
import { mensajeDe } from '@/features/empresa/errores';
import { LIMITES_DE_LECTURA, leerTabla, plantillaExcel } from '@/features/empresa/excel';
import {
  CAMPOS_SUCURSAL,
  COLUMNAS_SUCURSALES,
  filasDeEjemplo,
  hojasDeAyuda,
  LINEAS_SUCURSAL,
  NOMBRE_PLANTILLA,
  prepararImportacion,
  resumenDeColumnas,
  type RegistroPreparado,
} from '@/features/empresa/importacion';
import { importarSucursal } from '@/features/empresa/importar-sucursal';
import { Aviso } from '@/ui/aviso';
import { Hoja, PieDeHoja } from './hoja';

/** Lo que el selector acepta: la extensión además del tipo (Windows manda un CSV como `vnd.ms-excel`). */
const TIPOS_DE_HOJA = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/comma-separated-values',
  'application/vnd.ms-excel',
  'public.comma-separated-values-text',
];

const DESCRIPCION =
  'Una fila por CAJA: las filas que repiten el nombre de la sucursal son la misma sucursal, con sus datos básicos tomados de la primera. ' +
  'Al crearla se registra la sucursal, se declara en tu expediente y se da de alta cada caja: el QR de cada caja aparece en «Sucursales» ' +
  'listo para imprimir. Si algo falla a medias, corrige el Excel y vuelve a subirlo: lo que ya existe no se duplica.';

const MENSAJE_EXITO = 'Sucursales y cajas registradas. Cada caja ya tiene su QR en la lista de «Sucursales».';

/** Las columnas que se ven en la vista previa (la web enseña la clave y los 3 primeros campos). */
const COLUMNAS_PREVIA = CAMPOS_SUCURSAL.slice(0, 3);

export function ImportarSucursales({
  visible,
  accountId,
  partnerId,
  onClose,
  onImported,
}: {
  visible: boolean;
  accountId: string | undefined;
  partnerId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [archivo, setArchivo] = useState<ArchivoLocal | null>(null);
  const [filas, setFilas] = useState<RegistroPreparado[]>([]);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [terminado, setTerminado] = useState(false);

  const validas = filas.filter((fila) => fila.errores.length === 0);
  const creadas = filas.filter((fila) => fila.estado === 'creada').length;
  const fallidas = filas.filter((fila) => fila.estado === 'fallida');
  const total = validas.length;

  const cerrar = () => {
    if (importando) return;
    if (creadas > 0) onImported();
    setFilas([]);
    setArchivo(null);
    setErrorArchivo('');
    setProgreso(0);
    setTerminado(false);
    onClose();
  };

  const descargarPlantilla = async () => {
    try {
      const bytes = plantillaExcel(
        COLUMNAS_SUCURSALES.map((c) => c.cabecera),
        filasDeEjemplo(),
        hojasDeAyuda(COLUMNAS_SUCURSALES),
      );
      await guardarArchivo(bytes, NOMBRE_PLANTILLA, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (fallo) {
      setErrorArchivo(mensajeDe(fallo, 'No se pudo generar la plantilla.'));
    }
  };

  const cargar = async () => {
    const elegido = await elegirDocumento(TIPOS_DE_HOJA);
    if (!elegido) return;
    setErrorArchivo('');
    setTerminado(false);
    const pesado = avisoDePeso(elegido.name, elegido.size, LIMITES_DE_LECTURA.bytesArchivo);
    if (pesado) {
      setErrorArchivo(pesado);
      return;
    }
    setArchivo(elegido);
    try {
      const { filas: preparadas, error } = prepararImportacion(leerTabla(await leerBytes(elegido)));
      setFilas(preparadas);
      setErrorArchivo(error);
    } catch (fallo) {
      setFilas([]);
      setErrorArchivo(mensajeDe(fallo, 'No se pudo leer el archivo.'));
    }
  };

  const quitar = () => {
    setArchivo(null);
    setFilas([]);
    setErrorArchivo('');
    setTerminado(false);
  };

  const marcar = (numero: number, cambio: Partial<RegistroPreparado>) =>
    setFilas((actuales) => actuales.map((fila) => (fila.numero === numero ? { ...fila, ...cambio } : fila)));

  const importar = async () => {
    setImportando(true);
    setProgreso(0);
    const pendientes = filas.filter((fila) => fila.errores.length === 0 && fila.estado !== 'creada');
    for (const fila of pendientes) {
      try {
        await importarSucursal(fila.payload, { partnerId, accountId });
        marcar(fila.numero, { estado: 'creada', detalle: undefined });
      } catch (fallo) {
        marcar(fila.numero, { estado: 'fallida', detalle: mensajeDe(fallo, 'Error desconocido') });
      }
      setProgreso((valor) => valor + 1);
    }
    setImportando(false);
    setTerminado(true);
  };

  return (
    <Hoja visible={visible} titulo="Importar sucursales desde Excel" descripcion={DESCRIPCION} onClose={cerrar} cierre={terminado ? 'Cerrar' : 'Cancelar'}>
      <View style={styles.grupo}>
        <Button label="Descargar plantilla" icon="descargar" variant="secondary" onPress={() => descargarPlantilla()} testID="importar-plantilla" />
        <AtlasText variant="caption" tone="tertiary">
          {resumenDeColumnas()}
        </AtlasText>
      </View>

      <View style={styles.grupo} testID="importar-archivo">
        <FieldLabel label="Archivo de Excel" ayuda="La plantilla rellenada, en .xlsx o .csv; antes de crear nada se revisa fila por fila." />
        {archivo ? (
          <AtlasText variant="body">
            {archivo.name} · {tamanoLegible(archivo.size)}
            {importando ? ' · Importando…' : ''}
          </AtlasText>
        ) : (
          <AtlasText variant="caption" tone="tertiary">
            .xlsx o .csv · hasta {tamanoLegible(LIMITES_DE_LECTURA.bytesArchivo)}
          </AtlasText>
        )}
        <View style={styles.fila}>
          <Button label={archivo ? 'Cambiar' : 'Elegir archivo'} icon="clip" variant="secondary" disabled={importando} onPress={() => cargar()} />
          {archivo ? <Button label="Quitar" icon="papelera" variant="ghost" disabled={importando} onPress={quitar} /> : null}
        </View>
      </View>

      {errorArchivo ? (
        <Aviso tono="danger" titulo="No se pudo usar el archivo">
          {errorArchivo}
        </Aviso>
      ) : null}

      {filas.length ? (
        <View style={styles.grupo}>
          <View style={styles.fila}>
            <Badge label={`${validas.length} listas para crear`} tone="success" />
            {filas.length - validas.length ? <Badge label={`${filas.length - validas.length} incompletas`} tone="warning" /> : null}
            {creadas ? <Badge label={`${creadas} creadas`} tone="success" /> : null}
            {fallidas.length ? <Badge label={`${fallidas.length} rechazadas`} tone="danger" /> : null}
          </View>
          <Card padding="tight">
            {filas.map((fila, indice) => (
              <View key={fila.numero} style={styles.registro}>
                {indice > 0 ? <Divider /> : null}
                <AtlasText variant="bodyStrong">
                  Fila {fila.numero} · {LINEAS_SUCURSAL.claveLabel}: {fila.etiqueta}
                </AtlasText>
                <AtlasText variant="caption" tone="secondary">
                  {COLUMNAS_PREVIA.map((campo) => `${campo.label}: ${fila.crudo[campo.name] || '—'}`).join(' · ')} · Líneas: {fila.filasHoja.length}
                </AtlasText>
                {fila.errores.length ? (
                  <AtlasText variant="captionStrong" tone="danger">
                    {fila.errores.join(', ')}
                  </AtlasText>
                ) : fila.estado === 'creada' ? (
                  <AtlasText variant="captionStrong" tone="success">
                    Creada
                  </AtlasText>
                ) : fila.estado === 'fallida' ? (
                  <AtlasText variant="captionStrong" tone="danger">
                    {fila.detalle}
                  </AtlasText>
                ) : (
                  <AtlasText variant="caption" tone="tertiary">
                    Lista
                  </AtlasText>
                )}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {terminado ? (
        <Aviso tono={fallidas.length ? 'warning' : 'success'} titulo={`${creadas} de ${total} registros creados`}>
          {fallidas.length
            ? 'Las filas rechazadas siguen en la tabla con el motivo. Corrígelas en el Excel y vuelve a subirlo: las que ya se crearon no se repiten porque no vuelven a enviarse.'
            : MENSAJE_EXITO}
        </Aviso>
      ) : null}

      <PieDeHoja>
        {importando ? (
          <AtlasText variant="caption" tone="tertiary">
            Creando {progreso} de {total}…
          </AtlasText>
        ) : null}
        <Button
          label={`Crear ${total} registros`}
          icon="subir"
          loading={importando}
          disabled={!validas.length || terminado}
          onPress={() => importar()}
          testID="importar-confirmar"
        />
        <Button label={terminado ? 'Cerrar' : 'Cancelar'} variant="secondary" disabled={importando} onPress={cerrar} />
      </PieDeHoja>
    </Hoja>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: space.sm },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  registro: { gap: space.xxs, paddingVertical: space.xs },
});
