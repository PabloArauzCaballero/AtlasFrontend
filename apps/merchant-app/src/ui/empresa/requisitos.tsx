/**
 * Los requisitos que faltan, con el formulario para resolverlos al lado. Es `PartnerRequirementsPanel`
 * del portal web.
 *
 * Cada bloque aparece SÓLO si su requisito está pendiente: enseñar los tres siempre convertiría la
 * pestaña en un formulario largo del que casi todo ya está resuelto, y esconder el que falta es el
 * problema que esto vino a cerrar (el expediente decía «falta la matrícula» y no había dónde darla).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { IconField, SelectField } from '@cliente/ui/form-controls';
import { FieldLabel } from '@cliente/ui/help-sheet';
import { AtlasText, Button, Card, CardHeader } from '@cliente/ui/primitives';
import { partnerOnboardingService, uploadQrFile } from '@/api/servicios/partnerOnboardingService';
import type { ArchivoLocal } from '@/api/almacen';
import { avisoDePeso, elegirDocumento, tamanoLegible } from '@/features/empresa/archivos';
import { Aviso } from '@/ui/aviso';

const COMPLETA_ESTE_CAMPO = 'Completa este campo.';
const MAX_PODER = 10 * 1024 * 1024;
const TIPOS_PODER = ['application/pdf', 'image/png', 'image/jpeg'];

type Run = (label: string, action: () => Promise<unknown>) => Promise<void>;

export function Requisitos({ partnerId, pendientes, ocupado, run }: { partnerId: string; pendientes: readonly string[]; ocupado: boolean; run: Run }) {
  const faltaMatricula = pendientes.includes('commercial_registry');
  const faltaRepresentante = pendientes.includes('legal_representative');
  const faltaPoder = pendientes.includes('power_of_attorney');
  if (!faltaMatricula && !faltaRepresentante && !faltaPoder) return null;

  return (
    <View style={styles.bloques}>
      {faltaMatricula ? <Matricula partnerId={partnerId} ocupado={ocupado} run={run} /> : null}
      {faltaRepresentante || faltaPoder ? (
        <Representante partnerId={partnerId} ocupado={ocupado} run={run} faltaRepresentante={faltaRepresentante} faltaPoder={faltaPoder} />
      ) : null}
    </View>
  );
}

function Matricula({ partnerId, ocupado, run }: { partnerId: string; ocupado: boolean; run: Run }) {
  const [matricula, setMatricula] = useState('');
  const [intentado, setIntentado] = useState(false);

  const guardar = async () => {
    const valor = matricula.trim();
    if (!valor) {
      setIntentado(true);
      return;
    }
    await run('Matrícula de comercio', () => partnerOnboardingService.setCommercialRegistry(partnerId, valor));
  };

  return (
    <Card>
      <CardHeader
        title="Matrícula de comercio"
        icon="documento"
        detail="El número con el que tu empresa está inscrita en el registro de comercio. Si tu ejecutivo de Atlas lo cargó en el alta, ya no aparece aquí."
      />
      <IconField
        label="Número de matrícula"
        icon="documento"
        value={matricula}
        onChangeText={setMatricula}
        placeholder="00123456"
        ayuda="Número de matrícula en el registro de comercio (SEPREC); acredita que la empresa existe legalmente."
        error={intentado && !matricula.trim() ? COMPLETA_ESTE_CAMPO : null}
        required
        testID="campo-matricula"
      />
      <Button label="Guardar matrícula" icon="check" disabled={ocupado} onPress={() => guardar()} testID="btn-guardar-matricula" />
    </Card>
  );
}

const TIPOS_DE_DOCUMENTO = [
  { etiqueta: 'Cédula de identidad', valor: 'ci' },
  { etiqueta: 'Pasaporte', valor: 'passport' },
  { etiqueta: 'Documento extranjero', valor: 'foreign_id' },
];

function Representante({ partnerId, ocupado, run, faltaRepresentante, faltaPoder }: { partnerId: string; ocupado: boolean; run: Run; faltaRepresentante: boolean; faltaPoder: boolean }) {
  /* El formulario se abre con «Editar»: lo normal es que lo cargue Atlas desde el ERP (Pablo, 2026-10-02). */
  const [editando, setEditando] = useState(false);
  const [fullName, setFullName] = useState('');
  const [documentType, setDocumentType] = useState('ci');
  const [documentNumber, setDocumentNumber] = useState('');
  const [poder, setPoder] = useState<ArchivoLocal | null>(null);
  const [errorPoder, setErrorPoder] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);

  const elegirPoder = async () => {
    setErrorPoder(null);
    const archivo = await elegirDocumento(TIPOS_PODER);
    if (!archivo) return;
    const pesado = avisoDePeso(archivo.name, archivo.size, MAX_PODER);
    if (pesado) {
      setErrorPoder(pesado);
      return;
    }
    setPoder(archivo);
  };

  /**
   * Declara al representante y, si adjuntó el poder, lo sube ANTES: el backend comprueba que el
   * objeto existe y es de este expediente antes de guardar la clave, así que declarar primero
   * dejaría una representación afirmada sin respaldo.
   */
  const guardar = async () => {
    if (!fullName.trim() || !documentNumber.trim()) {
      setIntentado(true);
      return;
    }
    await run('Representante legal', async () => {
      let powerOfAttorneyKey: string | undefined;
      if (poder) {
        const ticket = await partnerOnboardingService.createDocumentUploadUrl(partnerId, {
          documentKind: 'power-of-attorney',
          contentType: poder.type === 'application/pdf' ? 'application/pdf' : poder.type === 'image/png' ? 'image/png' : 'image/jpeg',
          sizeBytes: poder.size,
        });
        await uploadQrFile(ticket, poder);
        powerOfAttorneyKey = ticket.storageKey;
      }
      return partnerOnboardingService.addLegalRepresentative(partnerId, {
        fullName: fullName.trim(),
        documentType,
        documentNumber: documentNumber.trim(),
        ...(powerOfAttorneyKey ? { powerOfAttorneyKey } : {}),
      });
    });
  };

  return (
    <Card>
      <CardHeader
        title="Representante legal"
        icon="perfil"
        detail="Lo carga tu ejecutivo de Atlas desde el ERP, con el poder notarial que acredita quién firma por la empresa."
        trailing={
          <Button
            label={editando ? 'Cerrar' : 'Editar'}
            icon={editando ? 'cerrar' : 'editar'}
            variant="secondary"
            onPress={() => setEditando((v) => !v)}
            testID="btn-editar-representante"
          />
        }
      />
      <AtlasText variant="body" tone="secondary" testID="aviso-representante-desde-erp">
        {faltaRepresentante
          ? 'Todavía no está cargado. Envía a tu ejecutivo de Atlas el nombre y el documento del representante y el poder notarial escaneado, o cárgalo tú con «Editar».'
          : 'El representante ya está declarado, pero falta el poder notarial que lo acredita. Envíaselo a tu ejecutivo de Atlas o adjúntalo con «Editar».'}
      </AtlasText>
      {editando ? (
        <View style={styles.formulario}>
          <IconField
            label="Nombre completo"
            icon="perfil"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nombre y apellidos como figuran en el documento"
            ayuda="Nombre y apellidos completos de la persona, como en su documento de identidad."
            error={intentado && !fullName.trim() ? COMPLETA_ESTE_CAMPO : null}
            required
            testID="campo-representante-nombre"
          />
          <SelectField
            label="Tipo de documento"
            value={documentType}
            opciones={TIPOS_DE_DOCUMENTO}
            onChange={setDocumentType}
            ayuda="Tipo de documento de identidad de la persona; decide el formato del número que se exige."
          />
          <IconField
            label="Número de documento"
            icon="documento"
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder="1234567"
            ayuda="Número del documento tal como aparece impreso, sin puntos. Ej.: 7654321 SC."
            error={intentado && !documentNumber.trim() ? COMPLETA_ESTE_CAMPO : null}
            required
            testID="campo-representante-documento"
          />
          <View style={styles.archivo} testID="campo-poder">
            <FieldLabel label="Poder notarial" required={faltaPoder} ayuda="El poder notarial escaneado que acredita que esta persona firma por la empresa." />
            {poder ? (
              <AtlasText variant="body">
                {poder.name} · {tamanoLegible(poder.size)}
              </AtlasText>
            ) : null}
            <View style={styles.fila}>
              <Button label={poder ? 'Cambiar' : 'Elegir archivo'} icon="clip" variant="secondary" onPress={() => elegirPoder()} />
              {poder ? <Button label="Quitar" icon="papelera" variant="ghost" onPress={() => setPoder(null)} /> : null}
            </View>
            <AtlasText variant="caption" tone="tertiary">
              PDF o imagen del poder, hasta 10 MB. Se guarda como evidencia del expediente; sin él no se puede enviar a revisión.
            </AtlasText>
            {errorPoder ? <Aviso tono="danger">{errorPoder}</Aviso> : null}
          </View>
          <Button label="Guardar representante" icon="check" disabled={ocupado} onPress={() => guardar()} testID="btn-guardar-representante" />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  bloques: { gap: space.base },
  formulario: { gap: space.base, marginTop: space.base },
  archivo: { gap: space.sm },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
