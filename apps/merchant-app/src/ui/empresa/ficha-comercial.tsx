/**
 * La pestaña «Ficha comercial» de Mi empresa: cómo se presenta el negocio.
 *
 * Se corrigen el nombre comercial, el rubro y el teléfono (funciona también con el expediente ya
 * aprobado). La razón social, el NIT y la matrícula NO se editan aquí: son los datos con los que
 * Atlas verificó el expediente, y se enseñan debajo sólo para leer.
 *
 * Sin expediente la pestaña no desaparece: dice qué le falta y dónde se resuelve.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { IconField, SelectField, type OpcionSelect } from '@cliente/ui/form-controls';
import { Button, Card, CardHeader, KeyValue } from '@cliente/ui/primitives';
import type { PartnerProfile } from '@/api/servicios/partnerOnboardingService';
import type { JsonObject } from '@/api/types';
import { camposEscritos, opcionesDeRubro } from '@/features/empresa/expediente';
import { Aviso } from '@/ui/aviso';

export function FichaComercial({
  profile,
  busy,
  rubros,
  errorRubros,
  onGuardar,
}: {
  profile: PartnerProfile | null;
  busy: boolean;
  rubros: OpcionSelect[];
  errorRubros: string | null;
  onGuardar: (payload: JsonObject) => void;
}) {
  if (!profile) {
    return (
      <Card>
        <CardHeader title="Ficha comercial" icon="editar" />
        <View style={styles.cuerpo}>
          <Aviso tono="info" titulo="Primero hay que abrir tu expediente">
            Aquí se corrigen el nombre comercial, el rubro y el teléfono de tu negocio. Ábrelo en «Estado del expediente»; es el primer paso y son siete campos.
          </Aviso>
        </View>
      </Card>
    );
  }
  // `key`: con otro expediente elegido, el formulario arranca de nuevo con SUS valores.
  return <Formulario key={profile.partnerId} profile={profile} busy={busy} rubros={rubros} errorRubros={errorRubros} onGuardar={onGuardar} />;
}

function Formulario({ profile, busy, rubros, errorRubros, onGuardar }: { profile: PartnerProfile; busy: boolean; rubros: OpcionSelect[]; errorRubros: string | null; onGuardar: (payload: JsonObject) => void }) {
  const [tradeName, setTradeName] = useState(profile.tradeName ?? '');
  const [businessCategory, setBusinessCategory] = useState(profile.businessCategory ?? '');
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? '');

  return (
    <Card testID="form-ficha-comercial">
      <CardHeader
        title="Ficha comercial"
        icon="editar"
        detail="Cómo se presenta tu negocio. La razón social, el NIT y la matrícula no se editan aquí: son los datos con los que Atlas verificó tu expediente."
      />
      <View style={styles.cuerpo}>
        <IconField
          label="Nombre comercial"
          icon="comercio"
          value={tradeName}
          onChangeText={setTradeName}
          hint="El nombre de la fachada, el que ve tu cliente."
          ayuda="Nombre con el que el negocio se presenta al público, si es distinto del legal. Ej.: «Tienda Doña Rosa»."
          testID="campo-tradeName"
        />
        <SelectField
          label="Rubro del negocio"
          value={businessCategory}
          opciones={opcionesDeRubro(profile.businessCategory, rubros)}
          onChange={setBusinessCategory}
          ayuda="Rubro principal del negocio; agrupa la cartera y decide las reglas de comisión que le aplican."
          error={errorRubros}
        />
        <IconField
          label="Teléfono de contacto"
          icon="telefono"
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
          ayuda="Teléfono del negocio para incidencias; con código de país, sin espacios."
          testID="campo-contactPhone"
        />
        <Button
          label="Guardar ficha"
          icon="check"
          disabled={busy}
          onPress={() => onGuardar(camposEscritos({ tradeName, businessCategory, contactPhone }))}
          testID="btn-guardar-ficha"
        />
      </View>
      <View style={styles.datos}>
        <KeyValue label="Razón social" value={profile.legalName} />
        <KeyValue label="NIT" value={profile.taxId} />
        <KeyValue label="Matrícula de comercio" value={profile.commercialRegistry ?? 'Sin declarar'} />
        <KeyValue label="Correo verificado" value={`${profile.contactEmail} ${profile.emailVerified ? '· verificado' : '· sin verificar'}`} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.base, marginTop: space.base },
  datos: { marginTop: space.lg, gap: space.xs },
});
