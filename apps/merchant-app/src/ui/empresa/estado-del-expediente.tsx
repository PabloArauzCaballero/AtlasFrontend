/**
 * La pestaña «Estado del expediente» de Mi empresa (`PartnerDossierScreen` + `SubmissionGaps` de la web).
 *
 * Tres caras, y las tres se pintan SIEMPRE (no desaparece la pestaña sin expediente):
 *  - sin expediente: el formulario de «Abrir expediente», el primer paso;
 *  - todavía buscando: «Comprobando si ya tienes un expediente…». No se ofrece abrir uno mientras no
 *    se sabe si ya existe: así nació más de un expediente duplicado;
 *  - con expediente: lo que falta, el formulario de cada requisito y «Enviar a revisión». Enviar NO
 *    aprueba nada: deja el caso en revisión, porque la aprobación la firma una persona.
 *
 * La tarjeta del expediente va en una sola jerarquía: razón social, NIT y el estado en español
 * (nunca `APPROVED` ni el identificador interno); debajo, lo que falta como lista de comprobación
 * compacta, y «Enviar a revisión» al pie, del tamaño de un botón y no de una barra.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, space } from '@cliente/theme/tokens';
import { IconField, SelectField, type OpcionSelect } from '@cliente/ui/form-controls';
import { Icon } from '@cliente/ui/icons';
import { AtlasText, Badge, Button, Card, CardHeader, Divider } from '@cliente/ui/primitives';
import { REQUIREMENT_LABELS, type PartnerOnboardingState, type SubmissionGap } from '@/api/servicios/partnerOnboardingService';
import type { JsonObject } from '@/api/types';
import { camposEscritos, DONDE_SE_RESUELVE, estadoDelExpediente, pareceCorreo, tituloDeHuecos, type PestanaEmpresa } from '@/features/empresa/expediente';
import { conVacia } from '@/features/empresa/opciones';
import { Requisitos } from './requisitos';

export type ExpedientePropio = 'buscando' | 'sin-expediente' | 'encontrado';

export function EstadoDelExpediente({
  state,
  expedientePropio,
  partnerId,
  busy,
  rubros,
  errorRubros,
  run,
  onAbrir,
  onEnviar,
  onIrA,
}: {
  state: PartnerOnboardingState | null;
  expedientePropio: ExpedientePropio;
  partnerId: string;
  busy: boolean;
  rubros: OpcionSelect[];
  errorRubros: string | null;
  run: (label: string, action: () => Promise<unknown>) => Promise<void>;
  onAbrir: (payload: JsonObject) => Promise<void>;
  onEnviar: () => void;
  onIrA: (pestana: PestanaEmpresa) => void;
}) {
  if (!state) {
    if (expedientePropio === 'sin-expediente') return <AbrirExpediente busy={busy} rubros={rubros} errorRubros={errorRubros} onAbrir={onAbrir} />;
    return (
      <Card>
        <CardHeader title="Mi empresa" icon="comercio" />
        <AtlasText variant="caption" tone="tertiary" align="center" style={styles.buscando}>
          Comprobando si ya tienes un expediente…
        </AtlasText>
      </Card>
    );
  }

  const estado = estadoDelExpediente(state.profile.onboardingStatus);
  return (
    <View style={styles.columna}>
      <Card testID="tarjeta-expediente">
        <CardHeader
          title={state.profile.legalName}
          detail={`NIT ${state.profile.taxId}`}
          trailing={<Badge label={estado.texto} tone={estado.tono} dot />}
          divider={state.gaps.length > 0 || state.readyToSubmit}
        />
        <SubmissionGaps gaps={state.gaps} ready={state.readyToSubmit} onIrA={onIrA} />
        {/* El botón de la web, igual de habilitado; sólo cambia el tamaño: al pie y no a lo ancho. */}
        <View style={styles.pie}>
          <Button label="Enviar a revisión" icon="enviar" disabled={busy || !state.readyToSubmit} onPress={onEnviar} testID="btn-enviar-revision" />
        </View>
      </Card>
      {/* El formulario de cada requisito pendiente, debajo de la lista que lo reclama. */}
      <Requisitos partnerId={partnerId} pendientes={state.gaps.map((hueco) => hueco.requirement)} ocupado={busy} run={run} />
    </View>
  );
}

/**
 * Lo que le falta al expediente, como lista de comprobación. Va en ámbar y no en rojo —no ha fallado
 * nada, falta terminar— y se enseña SIEMPRE, no sólo al intentar enviarlo: descubrir los requisitos
 * de uno en uno, a base de envíos rechazados, convierte un trámite en una pelea. Cada uno dice dónde
 * se resuelve, con un enlace a la pestaña.
 */
export function SubmissionGaps({ gaps, ready, onIrA }: { gaps: SubmissionGap[]; ready: boolean; onIrA: (pestana: PestanaEmpresa) => void }) {
  if (ready) {
    return (
      <View style={styles.listo} testID="expediente-listo">
        <Icon name="check" size={18} tint={color.feedback.success} />
        <AtlasText variant="body" tone="secondary" style={styles.crece}>
          Reúne todo lo necesario. Al enviarlo queda en revisión.
        </AtlasText>
      </View>
    );
  }
  // Sin huecos y sin poder enviar (ya aprobado o en revisión): no hay nada que pedir.
  if (gaps.length === 0) return null;
  return (
    <View style={styles.huecos} testID="expediente-pendientes">
      <AtlasText variant="captionStrong" tone="warning">
        {tituloDeHuecos(gaps.length)}
      </AtlasText>
      {gaps.map((gap, indice) => {
        const donde = DONDE_SE_RESUELVE[gap.requirement];
        return (
          <View key={gap.requirement}>
            {indice > 0 ? <Divider /> : null}
            <View style={styles.hueco}>
              <Icon name="alerta" size={18} tint={color.feedback.warning} />
              <View style={styles.crece}>
                <AtlasText variant="bodyStrong">{REQUIREMENT_LABELS[gap.requirement] ?? gap.requirement}</AtlasText>
                <AtlasText variant="caption" tone="secondary" numberOfLines={2}>
                  {gap.detail}
                </AtlasText>
              </View>
              {donde ? (
                <Pressable
                  onPress={() => onIrA(donde.tab)}
                  accessibilityRole="link"
                  accessibilityLabel={`Resolverlo en ${donde.label}`}
                  hitSlop={8}
                  testID={`resolver-${gap.requirement}`}
                >
                  <AtlasText variant="captionStrong" tone="brand">
                    Ir ›
                  </AtlasText>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const COMPLETA_ESTE_CAMPO = 'Completa este campo.';

/** «Abrir expediente»: siete campos, los de la web, con sus tooltips como ayuda (ⓘ). */
function AbrirExpediente({ busy, rubros, errorRubros, onAbrir }: { busy: boolean; rubros: OpcionSelect[]; errorRubros: string | null; onAbrir: (payload: JsonObject) => Promise<void> }) {
  const [campos, setCampos] = useState({ legalName: '', tradeName: '', taxId: '', commercialRegistry: '', businessCategory: '', contactEmail: '', contactPhone: '' });
  const [intentado, setIntentado] = useState(false);
  const poner = (campo: keyof typeof campos) => (valor: string) => setCampos((actual) => ({ ...actual, [campo]: valor }));

  const falta = (campo: keyof typeof campos) => (intentado && !campos[campo].trim() ? COMPLETA_ESTE_CAMPO : null);
  const errorCorreo = !intentado ? null : !campos.contactEmail.trim() ? COMPLETA_ESTE_CAMPO : !pareceCorreo(campos.contactEmail) ? 'Escribe un correo válido, por ejemplo pagos@tienda.bo.' : null;

  const enviar = async () => {
    // Lo que el navegador comprueba antes de enviar el formulario (`required`, `type="email"`).
    if (!campos.legalName.trim() || !campos.taxId.trim() || !campos.contactEmail.trim() || !pareceCorreo(campos.contactEmail)) {
      setIntentado(true);
      return;
    }
    await onAbrir(camposEscritos(campos));
  };

  return (
    <Card>
      <CardHeader title="Abrir expediente" icon="comercio" />
      <View style={styles.cuerpo}>
        <IconField
          label="Razón social"
          icon="documento"
          value={campos.legalName}
          onChangeText={poner('legalName')}
          ayuda="Nombre legal tal como figura en el NIT o en el registro de comercio; es el que va en facturas y contratos."
          error={falta('legalName')}
          required
          testID="campo-legalName"
        />
        <IconField
          label="Nombre comercial"
          icon="comercio"
          value={campos.tradeName}
          onChangeText={poner('tradeName')}
          ayuda="Nombre con el que el negocio se presenta al público, si es distinto del legal. Ej.: «Tienda Doña Rosa»."
        />
        <IconField
          label="NIT"
          icon="documento"
          value={campos.taxId}
          onChangeText={poner('taxId')}
          keyboardType="number-pad"
          hint="Sólo dígitos."
          ayuda="NIT (o CI si es persona natural) sin puntos ni guiones. Ej.: 1023456019. No se consulta el padrón de Impuestos: cópialo tal cual figura en el documento."
          error={falta('taxId')}
          required
          testID="campo-taxId"
        />
        <IconField
          label="Matrícula de comercio"
          icon="documento"
          value={campos.commercialRegistry}
          onChangeText={poner('commercialRegistry')}
          ayuda="Número de matrícula en el registro de comercio (SEPREC); acredita que la empresa existe legalmente."
        />
        <SelectField
          label="Rubro del negocio"
          value={campos.businessCategory}
          opciones={conVacia(rubros, '— Seleccione —')}
          onChange={poner('businessCategory')}
          ayuda="Rubro principal del negocio; agrupa la cartera y decide las reglas de comisión que le aplican."
          error={errorRubros}
        />
        <IconField
          label="Correo de contacto"
          icon="sobre"
          value={campos.contactEmail}
          onChangeText={poner('contactEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          ayuda="Correo del negocio para avisos operativos y de facturación. Ej.: pagos@tienda.bo."
          error={errorCorreo}
          required
          testID="campo-contactEmail"
        />
        <IconField
          label="Teléfono"
          icon="telefono"
          value={campos.contactPhone}
          onChangeText={poner('contactPhone')}
          keyboardType="phone-pad"
          ayuda="Teléfono del negocio para incidencias; con código de país, sin espacios."
        />
        <Button label="Abrir expediente" icon="comercio" disabled={busy} onPress={() => enviar()} testID="btn-abrir-expediente" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  columna: { gap: space.base },
  cuerpo: { gap: space.base, marginTop: space.base },
  buscando: { paddingVertical: space.xl },
  huecos: { gap: space.xs, marginTop: space.sm },
  hueco: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  crece: { flex: 1, gap: space.xxs },
  listo: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  pie: { alignItems: 'flex-end', marginTop: space.base },
});
