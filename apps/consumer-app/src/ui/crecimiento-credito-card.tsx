/**
 * «Cuánto puede crecer tu crédito»: el salto que da el siguiente escalón y toda la escalera hasta el tope (pedido de
 * Pablo, 2026-10-07).
 *
 * Arriba, lo que se puede mover YA: el tope de hoy, el del siguiente escalón y cuánto más es. Debajo, la escalera
 * entera con una barra por escalón, para que «hasta dónde puedo llegar» se vea de un vistazo sin leer una tabla.
 *
 * Todo se dice con «hasta»: son topes por confianza, y el límite real lo decide el motor con lo que la persona puede
 * pagar. La explicación larga vive en «Más info», no en la tarjeta. Ver `features/crecimiento-credito.ts`.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import {
  crecimientoDeCredito,
  ejemploDeRevision,
  filasDeEscalones,
  formatoBs,
  formatoVeces,
  fraseDelSiguienteSalto,
  type PeldanoDeCredito,
} from '../features/crecimiento-credito';
import { color, motion, radius, space, stroke } from '../theme/tokens';
import { BarraViva, CuentaArriba, useAvance } from './cuenta-arriba';
import { BotonInfo, InfoSheet } from './help-sheet';
import { Icon } from './icons';
import { LineaDeNiveles } from './linea-de-niveles';
import { SeccionConAcento } from './seccion-con-acento';
import { AtlasText, Badge, Card, CardHeader, Divider, Overline } from './primitives';

export function CrecimientoCreditoCard({ progress }: { progress: Progress }) {
  const [info, setInfo] = useState(false);
  const c = crecimientoDeCredito(progress);
  // Las dos cifras del salto comparten reloj: el tope de hoy y el siguiente suben a la vez y se comparan mientras suben.
  const avance = useAvance(true);
  if (c.peldanos.length === 0) return null;

  const cifra = c.conImportes ? formatoBs : formatoVeces;
  const hoy = c.techoHoy ?? c.vecesHoy;
  const siguiente = c.techoSiguiente ?? c.vecesSiguiente;
  const maximo = c.techoMaximo ?? c.vecesMaximo;
  const frase = fraseDelSiguienteSalto(c);

  return (
    <Card
      testID="crecimiento-credito-card"
      accessibilityLabel={
        c.siguiente && siguiente !== null
          ? `Cuánto puede crecer tu crédito. Hoy, hasta ${cifra(hoy)}. En «${c.siguiente.label}», hasta ${cifra(siguiente)}. ${frase} El tope máximo es ${cifra(maximo)}.`
          : `Cuánto puede crecer tu crédito. Tienes el tope máximo: hasta ${cifra(maximo)}.`
      }
    >
      <CardHeader
        icon="tendencia"
        eyebrow="Sube con tu calificación"
        title="Cuánto puede crecer tu crédito"
        trailing={<BotonInfo etiqueta="cómo crece tu crédito" onPress={() => setInfo(true)} testID="crecimiento-mas-info" />}
        divider={false}
      />

      {c.siguiente && siguiente !== null ? (
        <View style={styles.salto}>
          <View style={styles.lado}>
            <Overline>Hoy, hasta</Overline>
            {/* `h1` y no `amount`: dos importes lado a lado en un teléfono de 390 px no caben más grandes sin cortarse. */}
            <CuentaArriba avance={avance} hasta={hoy} formato={cifra} tamano="h1" testID="crecimiento-hoy" />
          </View>
          <View style={styles.flecha}>
            <Icon name="adelante" size={16} tint={color.action.primary} />
          </View>
          <View style={styles.lado}>
            <Overline tone="brand" numberOfLines={1}>
              Luego, hasta
            </Overline>
            {/* La cifra que se quiere alcanzar es la que lleva el color: el ojo termina en ella. */}
            <CuentaArriba avance={avance} hasta={siguiente} formato={cifra} tamano="h1" color={color.action.primary} testID="crecimiento-siguiente" />
          </View>
        </View>
      ) : (
        <View style={styles.tope}>
          <Overline tone="brand">Tu tope, hasta</Overline>
          <CuentaArriba avance={avance} hasta={maximo} formato={cifra} tamano="amountHero" color={color.action.primary} testID="crecimiento-tope" />
        </View>
      )}

      <View style={styles.pie}>
        {c.aumento !== null && c.aumento > 0 ? <Badge label={`+ ${formatoBs(c.aumento)} de crédito`} tone="success" /> : null}
        <AtlasText variant="caption" tone="secondary" testID="crecimiento-frase">
          {frase}
        </AtlasText>
      </View>

      <Divider />

      <View style={styles.cabeceraEscalera}>
        <Overline>Todo lo que puedes crecer</Overline>
        <AtlasText variant="captionStrong" tone="brand">
          {`hasta ${cifra(maximo)}`}
        </AtlasText>
      </View>
      <View style={styles.escalera}>
        {/* El primer escalón ARRIBA y el más alto abajo, como «Los niveles» (Pablo, 2026-10-09). */}
        {c.peldanos.map((peldano, indice) => (
          <Peldano key={peldano.code} peldano={peldano} indice={indice} cifra={cifra} />
        ))}
      </View>

      <InfoSheet visible={info} titulo="Cómo crece tu crédito" onClose={() => setInfo(false)} testID="crecimiento-info">
        <AtlasText variant="bodyStrong">Los escalones, con números</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          {`Tu calificación hoy: ${progress.rating?.value ?? Math.round(progress.score)} de 100. ${frase}`}
        </AtlasText>
        {/*
          Los escalones como un recorrido en una línea vertical (Pablo, 2026-10-09): el primero arriba y el más alto abajo,
          la línea llena hasta donde estás. La misma pieza que «Los niveles».
        */}
        <LineaDeNiveles
          testID="crecimiento-tabla"
          pasos={filasDeEscalones(c).map((fila) => ({
            clave: fila.code,
            titulo: `${fila.label} · ${fila.tope}${fila.actual ? ' · estás aquí' : ''}`,
            derecha: `${fila.rango} de calificación`,
            hecho: fila.alcanzado,
            actual: fila.actual,
            etiqueta: `${fila.label}, ${fila.rango} de calificación, ${fila.tope}. ${fila.alcanzado ? 'Alcanzado' : 'Por alcanzar'}`,
          }))}
        />
        {ejemploDeRevision(c) ? (
          <AtlasText variant="caption" tone="secondary">
            {ejemploDeRevision(c)}
          </AtlasText>
        ) : null}
        {/* Cada explicación en su tarjeta con barra de marca, como la política de mora (Pablo, 2026-10-09). */}
        <SeccionConAcento
          titulo="Lo sube tu calificación"
          parrafos={[
            'Tu calificación de 1 a 100 dice qué tan buen pagador eres. Cada escalón que alcanzas sube el tope de crédito que Atlas te puede dar. Se sube pagando tus cuotas a tiempo, terminando de pagar tus compras y con el tiempo que llevas con Atlas.',
          ]}
        />
        <SeccionConAcento
          titulo="Son topes, no una promesa"
          parrafos={[
            'Cada importe es lo MÁXIMO que admite ese escalón. Tu límite real también depende de lo que puedes pagar cada mes —por eso ayuda subir tu extracto bancario— y sube por pasos: como mucho el doble en cada revisión.',
          ]}
        />
        <SeccionConAcento
          titulo="Comprar más no lo sube"
          parrafos={[
            'Los puntos de experiencia que ganas comprando te dan nivel y tarjeta, pero no más crédito. Lo que sube tu crédito es cumplir, no endeudarte.',
          ]}
        />
      </InfoSheet>
    </Card>
  );
}

function Peldano({ peldano, indice, cifra }: { peldano: PeldanoDeCredito; indice: number; cifra: (n: number) => string }) {
  const valor = peldano.techo ?? peldano.veces;
  return (
    <View style={styles.peldano} testID={`crecimiento-peldano-${peldano.code}`}>
      <View style={styles.filaPeldano}>
        <View style={[styles.marca, peldano.reached && styles.marcaHecha]}>
          {peldano.reached ? <Icon name="check" size={12} tint={color.text.onBrand} /> : null}
        </View>
        <AtlasText variant={peldano.actual ? 'bodyStrong' : 'body'} tone={peldano.actual ? 'brand' : peldano.reached ? 'primary' : 'secondary'} numberOfLines={1} style={styles.nombre}>
          {peldano.actual ? `${peldano.label} · estás aquí` : peldano.label}
        </AtlasText>
        <AtlasText variant="amountMicro" tone={peldano.reached ? 'primary' : 'secondary'}>
          {cifra(valor)}
        </AtlasText>
      </View>
      {/* Las barras se llenan una tras otra, del primer escalón al último: el ojo sube la escalera con ellas. */}
      <BarraViva
        value={peldano.porcentaje}
        retardo={motion.base + indice * motion.stagger * 3}
        tono={peldano.reached ? 'marca' : 'apagado'}
        // El punto vivo es «estás aquí»: sólo lo lleva el escalón actual, no cada uno de los ya alcanzados.
        punto={peldano.actual}
        label={`${peldano.label}, desde calificación ${peldano.from}: hasta ${cifra(valor)}. ${peldano.reached ? 'Alcanzado' : 'Por alcanzar'}`}
      />
      {!peldano.reached ? (
        <AtlasText variant="micro" tone="tertiary">
          {`Desde calificación ${peldano.from}`}
        </AtlasText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tablaEscalones: { gap: space.xs, marginVertical: space.sm },
  filaTabla: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border.subtle,
  },
  filaTablaActual: { borderColor: color.action.primary, backgroundColor: color.feedbackSoft.success },
  textoFila: { flex: 1, gap: space.xxs },
  // El salto va en un hueco propio: es la parte de la tarjeta que se puede mover, y se lee aparte de la escalera.
  salto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: stroke.hairline,
    borderColor: color.feedbackBorder.brand,
    backgroundColor: color.surface.sunken,
  },
  lado: { flex: 1, gap: space.xxs },
  flecha: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.feedbackSoft.success,
  },
  tope: { gap: space.xxs },
  pie: { gap: space.sm, alignItems: 'flex-start' },
  cabeceraEscalera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  escalera: { gap: space.md },
  peldano: { gap: space.xs },
  filaPeldano: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nombre: { flex: 1 },
  marca: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaHecha: { backgroundColor: color.action.primary, borderColor: color.action.primary },
});
