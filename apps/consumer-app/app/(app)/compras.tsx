/**
 * Mis compras: todo lo que la persona compró con Atlas, de la más reciente a la más antigua.
 *
 * Pagos responde «¿qué debo y cuándo?»; esta pantalla responde «¿qué compré?», incluidas las que ya terminó de
 * pagar o se cancelaron, que de Pagos desaparecen. Agrupa por mes, deja filtrar por estado y buscar por comercio.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { LoanSummary } from '../../src/api/endpoints/loans';
import {
  agruparPorMes,
  buscarPorComercio,
  coincideConFiltro,
  estadoDeCompra,
  fechaDeCompra,
  type FiltroCompras,
} from '../../src/features/historial-compras';
import { categoryLook, formatAmount } from '../../src/features/spending-copy';
import { useCreditBook } from '../../src/features/use-credit-book';
import { useAlVolver } from '../../src/features/al-volver';
import { useSession } from '../../src/session/session';
import { Field } from '../../src/ui/fields';
import type { IconName } from '../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { Badge, Button, Card, Chip, ChipBar, Divider, EmptyState, ErrorState, ListRow, SectionHeader, SkeletonLista } from '../../src/ui/primitives';
import { marca } from '../../src/theme/tokens';

const FILTROS: { clave: FiltroCompras; etiqueta: string; icono: IconName }[] = [
  { clave: 'todas', etiqueta: 'Todas', icono: 'lista' },
  { clave: 'al_dia', etiqueta: 'Al día', icono: 'check' },
  { clave: 'mora', etiqueta: 'En mora', icono: 'alerta' },
  { clave: 'pagadas', etiqueta: 'Pagadas', icono: 'billetera' },
];

const fechaLarga = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-BO') : 'sin fecha');

export default function Compras() {
  const router = useRouter();
  const session = useSession();
  const book = useCreditBook(session.customerId);
  // Al volver a la pantalla: lo que cambió mientras tanto (un pago confirmado, una compra nueva) se ve sin cerrar la app.
  useAlVolver(book.reload);
  const [filtro, setFiltro] = useState<FiltroCompras>('todas');
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(
    () => buscarPorComercio(book.loans.filter((loan) => coincideConFiltro(loan, filtro)), busqueda),
    [book.loans, filtro, busqueda],
  );
  const grupos = useMemo(() => agruparPorMes(visibles), [visibles]);

  if (!book.ready) {
    return (
      <Screen>
        <ScreenHeader title="Mis compras" subtitle={`Todo lo que compraste con ${marca.nombre}.`} onBack="auto" />
        <SkeletonLista filas={5} alto={72} pantalla />
      </Screen>
    );
  }

  if (book.error && book.loans.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Mis compras" subtitle={`Todo lo que compraste con ${marca.nombre}.`} onBack="auto" />
        <ErrorState title="No pudimos cargar tus compras" detail={book.error} onRetry={() => void book.reload()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Mis compras" subtitle={`Todo lo que compraste con ${marca.nombre}.`} onBack="auto" />

      {book.loans.length === 0 ? (
        <EmptyState
          icon="billetera"
          title={`Todavía no compraste con ${marca.nombre}`}
          detail="Cuando pagues en un comercio con tu línea, la compra aparecerá aquí."
          action={<Button label="Escanear QR del comercio" icon="escanear" onPress={() => router.push('/(app)/(tabs)/escanear')} />}
        />
      ) : (
        <>
          <Field
            label="Buscar por comercio"
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Ej.: Farmacia"
            ayuda="Escribe el nombre del comercio donde compraste y la lista se filtra mientras escribes."
          />
          <ChipBar>
            {FILTROS.map((opcion) => (
              <Chip
                key={opcion.clave}
                label={opcion.etiqueta}
                icon={opcion.icono}
                selected={filtro === opcion.clave}
                onPress={() => setFiltro(opcion.clave)}
                accessibilityLabel={`Mostrar compras: ${opcion.etiqueta}`}
              />
            ))}
          </ChipBar>
          <Gap size="xs" />

          {grupos.length === 0 ? (
            <EmptyState icon="lista" title="Nada con ese filtro" detail="Prueba con otro estado o borra la búsqueda." />
          ) : (
            grupos.map((grupo) => (
              <View key={grupo.clave}>
                <SectionHeader title={grupo.titulo} detail={`${grupo.compras.length} ${grupo.compras.length === 1 ? 'compra' : 'compras'}`} />
                <Card padding="none">
                  {grupo.compras.map((compra, indice) => (
                    <FilaDeCompra
                      key={compra.loanId}
                      compra={compra}
                      primera={indice === 0}
                      onPress={() => router.push(`/(app)/credito/${compra.loanId}` as never)}
                    />
                  ))}
                </Card>
              </View>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function FilaDeCompra({ compra, primera, onPress }: { compra: LoanSummary; primera: boolean; onPress: () => void }) {
  const estado = estadoDeCompra(compra);
  const look = categoryLook(compra.merchant?.businessCategory ?? 'sin_comercio');
  return (
    <View>
      {primera ? null : <Divider inset />}
      <ListRow
        icon={look.icon}
        title={compra.merchant?.displayName ?? 'Compra sin comercio'}
        subtitle={`${formatAmount(Number(compra.principalAmount), compra.currencyCode)} · ${fechaLarga(fechaDeCompra(compra))}`}
        right={<Badge dot label={estado.texto} tone={estado.tono === 'neutral' ? 'info' : estado.tono} />}
        onPress={onPress}
        accessibilityHint="Abre el detalle de esta compra"
      />
    </View>
  );
}
