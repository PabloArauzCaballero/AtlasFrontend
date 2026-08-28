/**
 * Centro del registro: donde se retoma lo que falta.
 *
 * El porcentaje, el estado de cada seccion y el `nextStep` vienen del servidor. La pantalla no
 * calcula avance: lo muestra. Asi dos versiones distintas de la app nunca contradicen al backend
 * ni entre si.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { OnboardingSectionCode } from '../../src/api/endpoints/onboarding';
import { SECTION_LABEL, SECTION_ROUTE, describeLifecycle } from '../../src/features/onboarding-map';
import { useSession } from '../../src/session/session';
import { space } from '../../src/theme/tokens';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ErrorState, ListRow, Overline, ProgressBar, SectionHeader, Skeleton } from '../../src/ui/primitives';

export default function OnboardingProgress() {
  const router = useRouter();
  const session = useSession();
  const [refreshing, setRefreshing] = useState(false);
  /*
    Si la primera lectura YA TERMINO. No es lo mismo «todavia no ha llegado» que «se pidio y no
    llego», y esta pantalla las estaba dibujando igual: ver el bloque `if (!status)` de abajo.
  */
  const [settled, setSettled] = useState(false);

  // Al volver de cualquier paso se relee el estado: es el servidor quien decide si esa seccion
  // quedo completa, no la pantalla que acaba de guardar.
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      /*
        `refresh` se traga sus errores a proposito —no queremos que un fallo de red tumbe la sesion
        entera— asi que aqui no hay excepcion que capturar: lo que se mira es si, una vez terminada
        la lectura, el estado sigue vacio. Eso solo puede significar que la peticion fallo.
      */
      void session.refresh().finally(() => {
        if (vigente) setSettled(true);
      });
      return () => {
        vigente = false;
      };
    }, [session]),
  );

  const status = session.onboarding;
  const lifecycle = describeLifecycle(status?.lifecycleStatus ?? 'registered');

  const onRefresh = async () => {
    setRefreshing(true);
    setSettled(false);
    await session.refresh();
    setSettled(true);
    setRefreshing(false);
  };

  /*
    Cargando y NO PUDE CARGAR son dos pantallas distintas.

    Antes eran la misma: mientras `status` fuera nulo se dibujaban tres esqueletos, sin importar por
    que. Si la lectura fallaba —y en local falla cada vez que el servidor tarda mas que el tiempo
    maximo de la peticion— los esqueletos se quedaban latiendo para siempre: sin explicacion, sin
    boton, y sin siquiera el gesto de tirar para recargar, porque `onRefresh` solo estaba conectado
    en la pantalla ya cargada. La persona se queda mirando una animacion que no lleva a ningun sitio
    y lo unico que puede hacer es cerrar la app.

    Con la lectura ya terminada y el estado todavia vacio, lo honesto es decirlo y ofrecer el
    reintento.
  */
  if (!status) {
    if (settled) {
      return (
        <Screen>
          <ScreenHeader title="Tu registro" />
          <ErrorState
            title="No pudimos cargar tu registro"
            detail="Revisa tu conexión e inténtalo de nuevo. Lo que ya enviaste está guardado."
            onRetry={() => void onRefresh()}
          />
        </Screen>
      );
    }
    return (
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        <ScreenHeader title="Tu registro" />
        <Card>
          <Skeleton height={11} width="55%" />
          <Skeleton height={6} />
        </Card>
        <Card padding="tight">
          <Skeleton height={48} />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </Card>
      </Screen>
    );
  }

  const pending = status.sections.filter((section) => section.status !== 'completed');

  return (
    <Screen
      onRefresh={onRefresh}
      refreshing={refreshing}
      footer={
        status.canSubmit ? (
          <Button label="Enviar mi solicitud" onPress={() => router.push('/(onboarding)/revision')} haptic="success" />
        ) : pending[0] ? (
          <Button label={`Continuar: ${SECTION_LABEL[pending[0].code].title}`} onPress={() => router.push(SECTION_ROUTE[pending[0]!.code])} />
        ) : (
          <Button label="Ver estado de mi solicitud" variant="secondary" onPress={() => router.push('/(onboarding)/revision')} />
        )
      }
    >
      <ScreenHeader title={lifecycle.title} subtitle={lifecycle.detail} />

      <Card>
        <View style={styles.avance}>
          <Overline>Avance de tu registro</Overline>
          {/* La cifra en la familia de importes: es un numero que se compara consigo mismo entre
              visita y visita, y con cifras proporcionales «11 %» y «88 %» no ocupan lo mismo. */}
          <AtlasText variant="amountSmall" tone="brand">
            {status.completionPercentage}%
          </AtlasText>
        </View>
        <ProgressBar value={status.completionPercentage} label={`Registro completado al ${status.completionPercentage} por ciento`} />
        {pending.length > 0 ? (
          <AtlasText variant="caption" tone="secondary">
            Te {pending.length === 1 ? 'queda 1 paso' : `quedan ${pending.length} pasos`} por completar.
          </AtlasText>
        ) : null}
      </Card>

      <SectionHeader title="Pasos" />

      <Card padding="tight">
        {status.sections.map((section, index) => {
          const label = SECTION_LABEL[section.code as OnboardingSectionCode];
          const done = section.status === 'completed';
          return (
            <View key={section.code}>
              {index > 0 ? <Divider inset /> : null}
              <ListRow
                title={label?.title ?? section.code}
                subtitle={done ? 'Listo' : (label?.detail ?? 'Pendiente')}
                icon={label?.icon}
                right={<Badge dot label={done ? 'completo' : 'pendiente'} tone={done ? 'success' : 'warning'} />}
                onPress={() => router.push(SECTION_ROUTE[section.code as OnboardingSectionCode])}
                accessibilityHint={done ? 'Abrir para revisar lo que enviaste' : 'Abrir para completar este paso'}
              />
            </View>
          );
        })}
      </Card>

      <Gap size="sm" />
      <Button label="Cerrar sesión" variant="ghost" onPress={() => void session.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avance: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
});
