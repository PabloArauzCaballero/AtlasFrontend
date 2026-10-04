/**
 * «Qué quieres pedir»: corregir un dato o borrar la cuenta, con lo necesario para que se pueda atender.
 *
 * Vive en `features/` y no en `ui/` a propósito: `check:field-help` no revisa los campos de `src/ui/` (ahí se DEFINEN
 * las primitivas), y un formulario de pantalla tiene que pasar esa guardia.
 *
 * Una corrección dice qué dato y cuál es el valor correcto; un borrado explica antes de enviarse qué se borra y qué la
 * ley obliga a conservar. Las dos se confirman con el PIN: el servidor comprueba por su cuenta que se confirmó en los
 * últimos 5 minutos, así que quien tiene el teléfono desbloqueado no basta para pedir que borren una cuenta.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import * as privacyApi from '../api/endpoints/privacy';
import { describeError } from '../api/errors';
import { marcarPinConfirmado } from './pin-verificado';
import {
  CAMPOS_CORREGIBLES,
  cuerpoDeSolicitud,
  esAutoservicio,
  esIdentidad,
  FORMULARIO_VACIO,
  motivoParaNoEnviar,
  QUE_IMPLICA_BORRAR,
  type CampoCorregible,
  type FormularioSolicitud,
} from './solicitud-titular';
import { space } from '../theme/tokens';
import { ConfirmarPinSheet } from '../ui/confirmar-pin-sheet';
import { Field, OptionGroup } from '../ui/fields';
import { SelectField } from '../ui/form-controls';
import { AtlasText, Button, Card, CardHeader, ErrorState } from '../ui/primitives';

type Copy = {
  derechosTitulo: string;
  derechosDetalle: string;
  derechosPregunta: string;
  derechosAyuda: string;
  derechos: { value: string; label: string; detalle: string }[];
  solicitudEnviada: string;
};

export function SolicitudTitularForm({ customerId, copy }: { customerId: string | null; copy: Copy }) {
  const router = useRouter();
  const [form, setForm] = useState<FormularioSolicitud>(FORMULARIO_VACIO);
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const cambiar = (parcial: Partial<FormularioSolicitud>) => {
    setEnviada(false);
    setForm((actual) => ({ ...actual, ...parcial }));
  };
  const bloqueo = motivoParaNoEnviar(form);
  const detalle = error ? describeError(error) : null;

  async function enviar() {
    if (!customerId) return;
    setEnviando(true);
    setError(null);
    try {
      await privacyApi.solicitarDerecho(customerId, cuerpoDeSolicitud(form));
      setEnviada(true);
      setForm(FORMULARIO_VACIO);
    } catch (capturado) {
      setError(capturado);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card testID="solicitud-titular">
      <CardHeader title={copy.derechosTitulo} detail={copy.derechosDetalle} />
      {detalle ? <ErrorState title={detalle.title} detail={detalle.detail} reference={detalle.reference} /> : null}

      <OptionGroup
        label={copy.derechosPregunta}
        ayuda={copy.derechosAyuda}
        options={copy.derechos as { value: 'rectification' | 'deletion'; label: string; detalle: string }[]}
        value={form.tipo}
        onChange={(tipo) => cambiar({ ...FORMULARIO_VACIO, tipo })}
      />

      {form.tipo === 'rectification' ? (
        <View style={{ gap: space.base }}>
          <SelectField<CampoCorregible>
            label="¿Qué dato quieres corregir?"
            ayuda="Elige el dato que está mal. Si no está en la lista, elige «Otro dato» y cuéntanos cuál."
            opciones={CAMPOS_CORREGIBLES}
            value={form.campo}
            onChange={(campo) => cambiar({ campo, valor: '' })}
            required
          />
          {esAutoservicio(form.campo) ? (
            <View style={{ gap: space.sm }} testID="aviso-autoservicio">
              <AtlasText variant="body" tone="secondary">
                El teléfono y el correo los cambias tú mismo desde Perfil: te mandamos un código al nuevo para confirmar que es tuyo.
              </AtlasText>
              <Button label="Ir a cambiar mis datos de contacto" icon="editar" variant="secondary" onPress={() => router.push('/(app)/editar-perfil')} />
            </View>
          ) : form.campo && form.campo !== 'other' ? (
            <Field
              label="Dato correcto"
              ayuda="Escríbelo tal como debería figurar. Ej.: «Equipetrol» para la zona. No lo cambiamos hasta revisar tu solicitud."
              value={form.valor}
              onChangeText={(valor) => cambiar({ valor })}
              maxLength={300}
              required
            />
          ) : null}
          {esIdentidad(form.campo) ? (
            <AtlasText variant="caption" tone="secondary" testID="aviso-identidad">
              Cambiar un dato de tu carnet lo revisa una persona con tu documento: te escribiremos para pedirte una foto.
            </AtlasText>
          ) : null}
          {!esAutoservicio(form.campo) && form.campo ? (
            <Field
              label={form.campo === 'other' ? '¿Qué dato quieres corregir?' : 'Algo más que debamos saber (opcional)'}
              ayuda="Cuéntanos qué está mal y por qué, en una o dos frases. Ayuda a quien revisa tu solicitud."
              value={form.comentario}
              onChangeText={(comentario) => cambiar({ comentario })}
              multiline
              maxLength={1000}
              required={form.campo === 'other'}
            />
          ) : null}
        </View>
      ) : null}

      {form.tipo === 'deletion' ? (
        <View style={{ gap: space.sm }} testID="que-implica-borrar">
          <AtlasText variant="bodyStrong">Antes de pedirlo, esto es lo que pasa:</AtlasText>
          <AtlasText variant="body" tone="secondary">{QUE_IMPLICA_BORRAR.seBorra}</AtlasText>
          <AtlasText variant="body" tone="secondary">{QUE_IMPLICA_BORRAR.seConserva}</AtlasText>
          <AtlasText variant="body" tone="secondary">{QUE_IMPLICA_BORRAR.conDeuda}</AtlasText>
          <AtlasText variant="caption" tone="secondary">{QUE_IMPLICA_BORRAR.plazo}</AtlasText>
          <Field
            label="¿Por qué quieres borrar tu cuenta? (opcional)"
            ayuda="No es obligatorio. Nos ayuda a mejorar y a saber si hay algo que podamos resolver antes."
            value={form.comentario}
            onChangeText={(comentario) => cambiar({ comentario })}
            multiline
            maxLength={1000}
          />
        </View>
      ) : null}

      {!esAutoservicio(form.campo) ? (
        <Button
          label={enviando ? 'Enviando…' : 'Enviar solicitud'}
          icon="enviar"
          onPress={() => setPidiendoPin(true)}
          disabled={bloqueo !== null || enviando || !customerId}
          blockedReason={bloqueo}
        />
      ) : null}
      {enviada ? (
        <AtlasText variant="caption" tone="secondary" testID="solicitud-enviada">
          {copy.solicitudEnviada}
        </AtlasText>
      ) : null}

      <ConfirmarPinSheet
        visible={pidiendoPin}
        onClose={() => setPidiendoPin(false)}
        onVerificado={() => {
          marcarPinConfirmado();
          setPidiendoPin(false);
          void enviar();
        }}
        motivo={
          form.tipo === 'deletion'
            ? 'Vas a pedir que borremos tu cuenta. Escribe tu PIN para confirmar que eres tú.'
            : 'Vas a pedir que corrijamos un dato. Escribe tu PIN para confirmar que eres tú.'
        }
      />
    </Card>
  );
}
