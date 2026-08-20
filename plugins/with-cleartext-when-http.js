/**
 * Permite trafico HTTP en claro SOLO cuando la app apunta a un backend `http://`.
 *
 * ## El problema que resuelve
 *
 * Android bloquea el trafico en claro desde `targetSdkVersion` 28. El manifiesto de depuracion
 * declara `usesCleartextTraffic` por su cuenta, pero el de release no, asi que un APK de release
 * contra un backend local `http://` no consigue sacar **ninguna** peticion del dispositivo y la app
 * muestra «Sin conexion».
 *
 * Cuesta horas diagnosticarlo porque todo lo demas responde: el `ping` llega, `nc` alcanza el
 * puerto desde el mismo emulador y el backend contesta desde el anfitrion. La peticion no falla en
 * la red: no llega a salir.
 *
 * ## La condicion es la URL, no un interruptor
 *
 * Un `ALLOW_CLEARTEXT=1` es un interruptor que alguien deja encendido, y publicar con el encendido
 * expone los tokens de sesion de cada cliente en cualquier wifi. Aqui la condicion es la unica que
 * importa de verdad —que la direccion configurada sea `http://`—, asi que no hay nada que acordarse
 * de apagar: en cuanto la URL es `https://`, el atributo desaparece del manifiesto.
 *
 * ## Por que NO se restringe al host de la API
 *
 * La primera version de este plugin generaba un `network_security_config` que permitia texto claro
 * **solo para el host de la API**. Parecia mas estricto y rompio el registro: la app no habla solo
 * con la API. El backend le entrega **URLs firmadas hacia el almacenamiento de objetos**, que vive
 * en otro host y cuyo nombre no se conoce al compilar. La subida del carnet se cortaba sin decir
 * nada util —«Algo no salio bien»— porque la peticion nunca salia del dispositivo.
 *
 * Enumerar hosts no es viable: la app sigue las direcciones que el servidor le da. Y en un binario
 * que ya apunta a un backend en claro, restringir por dominio no aporta seguridad real; solo
 * convierte un permiso explicito en un fallo intermitente y dificil de atribuir. Asi que el permiso
 * es el mismo que el manifiesto de depuracion ya se concede, con la diferencia de que aqui esta
 * condicionado a que el entorno sea de desarrollo.
 */
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withCleartextWhenHttp(config, { apiUrl } = {}) {
  if (!apiUrl || !apiUrl.startsWith('http://')) return config;

  return withAndroidManifest(config, (modConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    application.$['android:usesCleartextTraffic'] = 'true';
    return modConfig;
  });
};
