/**
 * «Tus extractos bancarios» en Mis datos: los que la persona subió, con su estado, y un botón para ver o
 * descargar cada uno.
 *
 * Mis datos enseñaba todo lo que Atlas sabe de la persona menos los documentos que ella misma entregó. Un
 * extracto es de lo más sensible que se sube, y no poder volver a verlo es justo lo que hace desconfiar.
 *
 * Trae sus datos porque sólo vive en una pantalla y sus cuatro estados —cargando, vacío, error y lista— son
 * suyos: repartirlos por la pantalla dejaba un `ErrorState` suelto que nadie sabía de quién era.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as creditLineApi from '../api/endpoints/credit-line';
import { descargarExtracto, resumenDeExtracto, subidoEl, tonoDeExtracto } from '../features/extractos-subidos';
import { space, marca } from '../theme/tokens';
import { AtlasText, Badge, Button, Card, CardHeader, Divider, EmptyState, ErrorState, SkeletonLista } from './primitives';

type Estado =
  | { fase: 'cargando' }
  | { fase: 'fallo' }
  | { fase: 'lista'; items: creditLineApi.BankStatementArchiveItem[] };

export function ExtractosSubidosCard({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  // Qué extracto se está descargando: sólo ese botón gira, y no se puede pedir dos veces el mismo archivo.
  const [descargando, setDescargando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setEstado({ fase: 'cargando' });
    try {
      setEstado({ fase: 'lista', items: (await creditLineApi.listBankStatements(customerId)).items });
    } catch {
      setEstado({ fase: 'fallo' });
    }
  }, [customerId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const descargar = async (extracto: creditLineApi.BankStatementArchiveItem) => {
    if (descargando) return;
    setDescargando(extracto.reviewId);
    const resultado = await descargarExtracto(customerId, extracto);
    setDescargando(null);
    if (!resultado.ok) Alert.alert('No se pudo abrir tu extracto', resultado.reason);
  };

  return (
    <Card testID="extractos-subidos">
      <CardHeader
        icon="documento"
        title="Tus extractos bancarios"
        detail="Los que subiste para calcular tu línea. Sólo tú puedes descargarlos."
        divider={false}
      />
      {estado.fase === 'cargando' ? (
        <SkeletonLista filas={2} alto={72} />
      ) : estado.fase === 'fallo' ? (
        <ErrorState title="No pudimos cargar tus extractos" detail="Revisa tu conexión y vuelve a intentar." onRetry={() => void cargar()} />
      ) : estado.items.length === 0 ? (
        <EmptyState
          icon="documento"
          title="Todavía no subiste ningún extracto"
          detail={`Con tu extracto bancario ${marca.nombre} mide lo que de verdad puedes pagar al mes y recalcula tu línea.`}
          action={<Button label="Subir mi extracto" variant="secondary" onPress={() => router.push('/(app)/extracto-bancario')} />}
        />
      ) : (
        estado.items.map((extracto, indice) => (
          <View key={extracto.reviewId} style={styles.extracto} testID={`extracto-${extracto.reviewId}`}>
            {indice > 0 ? <Divider /> : null}
            <View style={styles.cabecera}>
              <AtlasText variant="bodyStrong" style={styles.titulo}>
                {subidoEl(extracto)}
              </AtlasText>
              <Badge label={extracto.statusLabel} tone={tonoDeExtracto(extracto.status)} />
            </View>
            <AtlasText variant="caption" tone="secondary">
              {resumenDeExtracto(extracto)}
            </AtlasText>
            {extracto.file.available ? (
              <Button
                label="Ver o descargar el PDF"
                icon="descargar"
                variant="secondary"
                loading={descargando === extracto.reviewId}
                disabled={descargando !== null && descargando !== extracto.reviewId}
                onPress={() => void descargar(extracto)}
                accessibilityLabel={`Ver o descargar el extracto. ${subidoEl(extracto)}. ${resumenDeExtracto(extracto)}`}
              />
            ) : (
              <AtlasText variant="caption" tone="tertiary">
                El archivo ya no está guardado en {marca.nombre}, así que no se puede descargar.
              </AtlasText>
            )}
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  extracto: { gap: space.sm },
  // Si la fecha y la etiqueta no caben en una fila, la etiqueta baja en vez de salirse de la tarjeta.
  cabecera: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space.sm, rowGap: space.xs },
  titulo: { flexShrink: 1 },
});
