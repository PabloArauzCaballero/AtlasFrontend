/**
 * Camara de prueba: las tres capturas de identidad sin camara delante.
 *
 * ## Para que existe
 *
 * El paso de identidad es el unico del alta que no se puede recorrer en un simulador. `CameraView`
 * necesita una camara fisica, asi que en el simulador de iOS y en el emulador de Android el flujo
 * se corta justo ahi: no hay forma de llegar a `revision` ni de ver que contesta el motor. Probar
 * el alta entera exigia un telefono real y un carnet real en la mano.
 *
 * Esto entrega los mismos bytes que entregaria la camara —un fichero PNG en disco con su `file://`—
 * de modo que todo lo que viene despues corre SIN ENTERARSE: la subida firmada, el paquete de
 * identidad y la consulta al motor son exactamente el mismo codigo.
 *
 * ## Por que estas imagenes y no unas cualesquiera
 *
 * Las genero el propio motor, con `buildIdentityFixtureImages` del escenario `identidad-aprobada`
 * de su catalogo (`AtlasDecisionEngineBackend`, `fixtures/identity-fixtures.ts`). Importa que sean
 * ESAS: el motor no mira una bandera para decidir, mira los pixeles —lee la MRZ del reverso, saca
 * el retrato del anverso y lo compara con la cara de la selfie—. Una foto cualquiera de un carnet
 * inventado se iria a revision o a rechazo, que es justo lo que debe hacer.
 *
 * El documento lleva impreso «DOCUMENTO SINTETICO - SOLO PARA PRUEBAS» y la persona que aparece no
 * existe: es un retrato dibujado de la poblacion sintetica del motor.
 *
 * ## Lo que NO hace
 *
 * No toca el veredicto. La prueba de vida sobre una imagen fabricada no da `PASS` —el antispoof
 * puntua una imagen dibujada en la franja de la duda, como debe—, y el motor lo registra como señal
 * ausente. Aqui no hay ningun atajo que empuje el resultado: se entregan tres imagenes y el motor
 * decide lo que decida.
 *
 * ## Por que solo en desarrollo
 *
 * `estaDisponible()` es `__DEV__`, y en produccion vale `false`: el boton no se dibuja y
 * `capturaSimulada` lanza antes de tocar nada. Una puerta para saltarse la captura de identidad en
 * una app de credito no es una comodidad, es un fraude esperando.
 *
 * **Lo que ese guardia NO hace es sacar las imagenes del binario.** El `require` de un asset lo
 * resuelve el empaquetador leyendo el grafo de modulos, no ejecutandolo, asi que las tres PNG
 * viajan igual: medido sobre `expo export --platform android`, 1,5 MB de la compilacion publicada
 * son estas tres imagenes muertas. Se deja escrito porque es justo el detalle que un `__DEV__`
 * aparenta resolver y no resuelve — sacarlas de verdad pide excluirlas en la configuracion del
 * empaquetador, o servirlas desde el motor en vez de empotrarlas.
 */
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import type { IdentityEvidenceKind as EvidenceKind } from '../features/evidence-upload';

/**
 * Los datos IMPRESOS en el carnet sintetico.
 *
 * Se exportan porque la pantalla tambien pide el numero y el vencimiento tecleados, y tienen que
 * coincidir con lo que el motor va a leer en la tarjeta. Que la persona los copie a mano de la
 * imagen convertiria una prueba de un minuto en un ejercicio de transcripcion, y un digito mal
 * puesto se leeria como un fallo del motor.
 */
export const CARNET_DE_PRUEBA = {
  numero: '1234567',
  /** `AAAA-MM-DD`, que es lo que valida la pantalla. Impreso como 01/11/2028. */
  expiraEn: '2028-11-01',
  emitidoEn: 'Santa Cruz',
  titular: 'MARIA RENEE RODRIGUEZ GONZALEZ',
} as const;

/** El escenario del catalogo del motor del que salieron estas imagenes. */
export const ESCENARIO = 'identidad-aprobada';

const FUENTES: Record<EvidenceKind, number> = {
  identity_front: require('../../assets/dev/carnet-anverso.png'),
  identity_back: require('../../assets/dev/carnet-reverso.png'),
  selfie: require('../../assets/dev/selfie.png'),
};

/** Solo en desarrollo. Ver la nota de arriba antes de tocar esta linea. */
export function estaDisponible(): boolean {
  return __DEV__;
}

/**
 * Devuelve un `file://` con la imagen del paso, como si se acabara de tomar.
 *
 * El asset empaquetado ya vive en la cache del dispositivo despues de `downloadAsync`, pero se
 * COPIA a un fichero propio: `uploadEvidence` deduce el tipo y el nombre a partir de la ruta, y la
 * que asigna el empaquetador no tiene por que terminar en `.png` —en Android suele ser un nombre de
 * hash sin extension—. Copiarlo cuesta unos milisegundos y elimina esa dependencia.
 */
export async function capturaSimulada(kind: EvidenceKind): Promise<string> {
  if (!estaDisponible()) throw new Error('CAMARA_DE_PRUEBA_NO_DISPONIBLE');

  const asset = Asset.fromModule(FUENTES[kind]);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('ASSET_SIN_URI');

  const carpeta = new Directory(Paths.cache, 'atlas-camara-de-prueba');
  if (!carpeta.exists) carpeta.create({ intermediates: true });

  const destino = new File(carpeta, `${kind}.png`);
  if (destino.exists) destino.delete();
  const origen = new File(asset.localUri);
  origen.copy(destino);

  /*
    En Android la copia puede no haber terminado cuando `copy` vuelve: leer el destino enseguida
    devolvia CERO bytes, `subir` decia «No pudimos leer la foto» y el atajo no servia en el emulador
    (medido el 2026-09-26: 548.957 bytes en disco, 0 leidos). Se espera, con tope, a que el destino
    pese lo mismo que el origen.
  */
  for (let intento = 0; intento < 50 && destino.size !== origen.size; intento += 1) {
    await new Promise((resolver) => setTimeout(resolver, 100));
  }
  if (destino.size !== origen.size) throw new Error('COPIA_DE_PRUEBA_INCOMPLETA');

  return destino.uri;
}
