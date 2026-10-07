/**
 * El detalle de un caso propio.
 *
 * ## Por que el estado se lee en palabras
 *
 * El servidor no devuelve `WAITING_INTERNAL`: devuelve «Estamos investigando». La traduccion la
 * hace el backend a proposito, para que no existan dos vocabularios —uno tecnico y otro de cara al
 * cliente— que se desincronicen. Esta pantalla solo pinta lo que le dan.
 *
 * ## Por que la conversacion es un boton y no esta embebida
 *
 * Porque son dos cosas distintas: el expediente es el resumen de que se pidio y como va; la
 * conversacion es lo que se hablo. Cerrar el chat no cierra el caso, y verlos como una sola pantalla
 * haria creer lo contrario.
 */
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as supportApi from '../../../../src/api/endpoints/support';
import { Gap, Screen, ScreenHeader } from '../../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, CardHeader, KeyValue, Skeleton } from '../../../../src/ui/primitives';

export default function CasoDeSoporte() {
  const router = useRouter();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const [caso, setCaso] = useState<supportApi.SupportCase | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    supportApi
      .getCase(String(caseId))
      .then((encontrado) => {
        if (!cancelado) setCaso(encontrado);
      })
      .catch(() => {
        if (!cancelado) setError('No pudimos cargar este caso.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [caseId]);

  const canalVivo = caso?.channels?.find((canal) => !['CLOSED', 'ABANDONED'].includes(canal.status));

  return (
    <Screen>
      <ScreenHeader title="Tu caso" subtitle={caso?.caseNumber} onBack="auto" />

      {cargando ? (
        <Card>
          <Skeleton height={24} width="60%" />
          <Skeleton height={24} width="80%" />
        </Card>
      ) : null}

      {error ? (
        <AtlasText variant="caption" tone="danger">
          {error}
        </AtlasText>
      ) : null}

      {caso ? (
        <>
          <Card>
            <CardHeader icon="ayuda" title={caso.title} detail={caso.summary ?? undefined} divider />
            <Badge label={caso.status} tone={caso.closedAt ? 'neutral' : caso.resolvedAt ? 'success' : 'info'} dot />
            <KeyValue label="Abierto" value={new Date(caso.openedAt).toLocaleDateString('es-BO')} />
            {caso.firstResponseAt ? (
              <KeyValue label="Te respondimos" value={new Date(caso.firstResponseAt).toLocaleDateString('es-BO')} />
            ) : null}
            {caso.resolvedAt ? (
              <KeyValue label="Resuelto" value={new Date(caso.resolvedAt).toLocaleDateString('es-BO')} />
            ) : null}
          </Card>

          {canalVivo ? (
            <Button label="Ver la conversación" icon="chat" onPress={() => router.push(`/(app)/soporte/${canalVivo.channelId}` as never)} />
          ) : null}

          {/*
            Reabrir solo se ofrece si esta cerrado. Ofrecerlo siempre invitaria a reabrir un caso que
            todavia esta en curso, que no reabre nada y confunde sobre si alguien lo esta mirando.
          */}
          {caso.closedAt ? (
            <Button
              label="Mi problema sigue" icon="alerta"
              variant="secondary"
              onPress={() => {
                return supportApi
                  .reopenCase(caso.caseId, 'El problema volvió a ocurrir.')
                  .then(() => router.replace('/(app)/soporte' as never))
                  .catch(() => setError('No pudimos reabrirlo. Escríbenos y lo vemos.'));
              }}
            />
          ) : null}
        </>
      ) : null}

      <Gap size="lg" />
    </Screen>
  );
}
