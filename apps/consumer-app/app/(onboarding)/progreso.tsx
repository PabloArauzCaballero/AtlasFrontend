/**
 * Centro del registro: donde se retoma lo que falta.
 *
 * El porcentaje, el estado de cada seccion y el `nextStep` vienen del servidor. La pantalla no
 * calcula avance: lo muestra. Asi dos versiones distintas de la app nunca contradicen al backend
 * ni entre si.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import type { OnboardingSectionCode } from '../../src/api/endpoints/onboarding';
import { SECTION_LABEL, SECTION_ROUTE, describeLifecycle } from '../../src/features/onboarding-map';
import { useSession } from '../../src/session/session';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ListRow, ProgressBar, Skeleton } from '../../src/ui/primitives';

export default function OnboardingProgress() {
  const router = useRouter();
  const session = useSession();
  const [refreshing, setRefreshing] = useState(false);

  // Al volver de cualquier paso se relee el estado: es el servidor quien decide si esa seccion
  // quedo completa, no la pantalla que acaba de guardar.
  useFocusEffect(
    useCallback(() => {
      void session.refresh();
    }, [session]),
  );

  const status = session.onboarding;
  const lifecycle = describeLifecycle(status?.lifecycleStatus ?? 'registered');

  const onRefresh = async () => {
    setRefreshing(true);
    await session.refresh();
    setRefreshing(false);
  };

  if (!status) {
    return (
      <Screen>
        <ScreenHeader title="Tu registro" />
        <Card>
          <Skeleton height={12} width="60%" />
          <Skeleton height={6} />
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AtlasText variant="caption" tone="secondary">
            Avance de tu registro
          </AtlasText>
          <AtlasText variant="bodyStrong" tone="brand">
            {status.completionPercentage}%
          </AtlasText>
        </View>
        <ProgressBar value={status.completionPercentage} label={`Registro completado al ${status.completionPercentage} por ciento`} />
      </Card>

      <Gap size="xs" />
      <AtlasText variant="h3">Pasos</AtlasText>

      <Card>
        {status.sections.map((section, index) => {
          const label = SECTION_LABEL[section.code as OnboardingSectionCode];
          const done = section.status === 'completed';
          return (
            <View key={section.code}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                title={label?.title ?? section.code}
                subtitle={done ? 'Listo' : (label?.detail ?? 'Pendiente')}
                icon={label?.icon}
                right={<Badge label={done ? 'completo' : 'pendiente'} tone={done ? 'success' : 'warning'} />}
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
