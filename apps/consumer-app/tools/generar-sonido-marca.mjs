#!/usr/bin/env node
/**
 * Genera el sonido de marca de Atlas —el «ta-dum»— pidiendoselo a ElevenLabs.
 *
 * ## Por que un script y no una llamada en tiempo de ejecucion
 *
 * El sonido de marca es un ACTIVO, no una respuesta. Es el mismo en todos los dispositivos, en
 * todas las sesiones y para todas las personas: pedirlo a una API cada vez que alguien abre la app
 * seria pagar por generar mil veces el mismo archivo, y ademas dejaria el arranque —el momento en
 * que ocurre— dependiendo de que una red responda en menos de dos segundos. Se genera una vez, se
 * escucha, se aprueba y se versiona con el codigo. Lo que si es dinamico es la locucion de
 * bienvenida, que dice el nombre de quien entra; esa si va por el worker del motor.
 *
 * ## Por que la salida esta fijada y no es la que devuelva la API
 *
 * `sound-generation` es generativo: la misma peticion no devuelve el mismo audio dos veces. Si el
 * archivo se regenerara en cada instalacion, la marca sonaria distinta en cada compilacion, que es
 * lo contrario de lo que hace un sonido de marca. Por eso el destino es una ruta fija y el script
 * se niega a sobreescribir sin `--sustituir`: regenerar tiene que ser una decision, no un efecto
 * secundario de ejecutar el instalador.
 *
 * ## Uso
 *
 *     ELEVENLABS_API_KEY=... node tools/generar-sonido-marca.mjs            # primera vez
 *     ELEVENLABS_API_KEY=... node tools/generar-sonido-marca.mjs --sustituir # regenerar
 *     ELEVENLABS_API_KEY=... node tools/generar-sonido-marca.mjs --tomas 4   # 4 candidatos a oido
 *
 * Con `--tomas N` escribe N candidatos en `assets/audio/tomas/` en vez de tocar el activo. Es lo
 * que hay que hacer la primera vez: un modelo generativo acierta a la tercera o la cuarta, y elegir
 * a oido entre varias es mas barato —y mas rapido— que volver a lanzar el script cuatro veces.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'assets/audio/atlas-marca.mp3');
const TOMAS = join(RAIZ, 'assets/audio/tomas');

/**
 * La descripcion del sonido, que es lo unico que hay aqui de diseno.
 *
 * Cada frase esta puesta por una razon y quitarla cambia el resultado:
 *
 * - «two-note» — el gesto tiene DOS golpes, como el de Netflix. Uno solo se lee como un fallo del
 *   sistema; tres ya es una melodia, y una melodia se cansa a la decima vez que se oye.
 * - «deep sub-bass» — el impacto vive por debajo de los 80 Hz. Es lo que se siente en el pecho con
 *   auriculares y lo que en el altavoz del telefono simplemente no molesta, porque no puede
 *   reproducirlo. Un sonido de marca agudo hace lo contrario: en el telefono chilla.
 * - «no melody, no music» — si tiene tonalidad, choca contra lo que la persona estuviera
 *   escuchando. Sin ella se mezcla con cualquier cosa.
 * - «clean tail, no reverb wash» — la cola tiene que morir dentro de la animacion. Una reverb
 *   larga suena todavia cuando ya se ve la pantalla de inicio, y entonces el sonido deja de ser
 *   parte del logotipo y pasa a ser ruido encima de la interfaz.
 */
const DESCRIPCION = [
  'Cinematic two-note brand logo sting, like a streaming service intro.',
  'First: a short bright metallic transient with a fast attack.',
  'Second, 700 ms later: a deep sub-bass impact with a warm resonant body that decays cleanly.',
  'Premium, confident, restrained. No melody, no music, no voice.',
  'Clean tail, no reverb wash, silence by the end.',
].join(' ');

const DURACION_S = 3.0;
/**
 * Cuanto manda la descripcion frente a la libertad del modelo.
 *
 * Alto (0.8) a proposito: aqui no se busca que el modelo proponga nada. La forma del gesto —dos
 * golpes, este orden, esta separacion— es la decision de marca, y lo unico que se le pide al
 * generador es el timbre. Con influencia baja devuelve paisajes sonoros bonitos que no son un
 * logotipo.
 */
const INFLUENCIA = 0.8;

const api = process.env.ELEVENLABS_API_KEY;
if (!api) {
  console.error(
    'Falta ELEVENLABS_API_KEY.\n' +
      'Es la misma clave que consume el worker de locucion del motor (ELEVENLABS_API_KEY en\n' +
      'AtlasDecisionEngineBackend/.env). No se guarda en el repositorio.',
  );
  process.exit(1);
}

const argumentos = process.argv.slice(2);
const sustituir = argumentos.includes('--sustituir');
const cuantasTomas = numeroTras('--tomas') ?? 0;

/** Una peticion, un audio. La API devuelve los bytes directamente, no una URL. */
async function generar() {
  const respuesta = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': api, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: DESCRIPCION,
      duration_seconds: DURACION_S,
      prompt_influence: INFLUENCIA,
    }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    /*
      El 401 por PERMISOS no se parece a un 401 por clave mala, y confundirlos cuesta una tarde.

      Pasó el 25-08-2026: la clave de la cuenta genera locuciones perfectamente —la bienvenida se
      oye con ella— pero no puede llamar a `sound-generation`, porque ese permiso no está marcado en
      la clave. El mensaje del proveedor lo dice, pero enterrado en un JSON; sin este aviso, lo que
      se lee es «401» y se sale a buscar una clave que ya se tenía.
    */
    if (respuesta.status === 401 && detalle.includes('sound_generation')) {
      throw new Error(
        'La clave es válida pero NO tiene el permiso `sound_generation`.\n' +
          'No hace falta una clave nueva: basta con habilitar ese permiso en el panel de ElevenLabs\n' +
          '(la misma clave sigue sirviendo para la locución de bienvenida, que usa text-to-speech).',
      );
    }
    throw new Error(`ElevenLabs respondio ${respuesta.status}. ${detalle.slice(0, 400)}`);
  }
  const bytes = Buffer.from(await respuesta.arrayBuffer());
  /*
    Un cuerpo diminuto NO es un mp3: es un error servido con 200, que es como responden varias
    pasarelas cuando la cuota se agota. Sin esta comprobacion el script escribiria doscientos bytes
    de JSON con extension .mp3 y el fallo aparecería mucho despues, en el telefono, como un sonido
    que no suena.
  */
  if (bytes.length < 4096) throw new Error(`La respuesta pesa ${bytes.length} bytes: no es un audio.`);
  return bytes;
}

if (cuantasTomas > 0) {
  await mkdir(TOMAS, { recursive: true });
  for (let i = 1; i <= cuantasTomas; i += 1) {
    const bytes = await generar();
    const ruta = join(TOMAS, `toma-${String(i).padStart(2, '0')}.mp3`);
    await writeFile(ruta, bytes);
    console.log(`toma ${i}/${cuantasTomas} -> ${ruta} (${(bytes.length / 1024).toFixed(0)} kB)`);
  }
  console.log(
    '\nEscuchalas y copia la elegida sobre assets/audio/atlas-marca.mp3.\n' +
      'Las tomas NO se versionan: assets/audio/tomas/ esta ignorado.',
  );
} else {
  if (!sustituir && (await existe(DESTINO))) {
    console.error(
      `Ya hay un sonido de marca en ${DESTINO}.\n` +
        'Regenerarlo cambia como suena la app: pasa --sustituir si es lo que quieres.',
    );
    process.exit(1);
  }
  const bytes = await generar();
  await mkdir(dirname(DESTINO), { recursive: true });
  await writeFile(DESTINO, bytes);
  console.log(`Sonido de marca escrito en ${DESTINO} (${(bytes.length / 1024).toFixed(0)} kB).`);
}

function numeroTras(bandera) {
  const indice = argumentos.indexOf(bandera);
  if (indice < 0) return null;
  const valor = Number(argumentos[indice + 1]);
  return Number.isInteger(valor) && valor > 0 && valor <= 10 ? valor : null;
}

async function existe(ruta) {
  try {
    await access(ruta);
    return true;
  } catch {
    return false;
  }
}
