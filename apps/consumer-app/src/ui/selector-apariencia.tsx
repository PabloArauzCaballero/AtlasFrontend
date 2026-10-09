/**
 * Apariencia: claro u oscuro. La eleccion se recuerda y la app arranca asi la proxima vez.
 *
 * Cambiar recarga la app (ver `theme/preferencia.ts`): los estilos se construyen al arrancar, y
 * recargar es lo que da un tema coherente en TODAS las pantallas, incluido el arranque.
 */
import { esquema, type Esquema } from '../theme/tokens';
import { aplicarEsquema } from '../theme/preferencia';
import { Card, CardHeader, Chip, ChipBar } from './primitives';

const OPCIONES: { valor: Esquema; label: string; icono: 'sol' | 'luna' }[] = [
  { valor: 'claro', label: 'Claro', icono: 'sol' },
  { valor: 'oscuro', label: 'Oscuro', icono: 'luna' },
];

export function SelectorApariencia() {
  return (
    <Card padding="tight">
      <CardHeader icon={esquema === 'oscuro' ? 'luna' : 'sol'} iconTone="neutral" title="Apariencia" detail="La app se reinicia un instante al cambiarla" />
      <ChipBar>
        {OPCIONES.map((o) => (
          <Chip
            key={o.valor}
            label={o.label}
            icon={o.icono}
            selected={esquema === o.valor}
            onPress={() => {
              if (o.valor !== esquema) void aplicarEsquema(o.valor);
            }}
            accessibilityLabel={`Apariencia ${o.label.toLowerCase()}${esquema === o.valor ? ', elegida' : ''}`}
          />
        ))}
      </ChipBar>
    </Card>
  );
}
