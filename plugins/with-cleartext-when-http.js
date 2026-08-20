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
 * ## Por que se decide mirando la URL y no con un interruptor
 *
 * Un `ALLOW_CLEARTEXT=1` es un interruptor que alguien deja encendido, y publicar con el encendido
 * expone los tokens de sesion de cada cliente en cualquier wifi. Aqui la condicion es la unica que
 * importa de verdad —que la direccion configurada sea `http://`—, asi que no hay nada que acordarse
 * de apagar: en cuanto la URL es `https://`, el atributo desaparece del manifiesto.
 *
 * Se limita ademas al dominio concreto con un `network_security_config`, en vez de abrir el trafico
 * en claro para todo destino: si el binario de desarrollo acaba en manos de alguien, solo puede
 * hablar en claro con el host que se configuro.
 */
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Nombre del recurso XML que se genera. Se referencia desde el manifiesto. */
const CONFIG_RESOURCE = 'atlas_network_security_config';

/** Extrae el host de una URL. Devuelve `null` si no es una URL utilizable. */
function hostOf(url) {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Escribe `res/xml/atlas_network_security_config.xml` con el host permitido.
 *
 * `includeSubdomains` queda en `false`: el permiso se concede al host que se configuro, no a un
 * arbol de nombres que nadie reviso.
 */
function withNetworkSecurityConfig(config, host) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const xmlDir = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, `${CONFIG_RESOURCE}.xml`),
        [
          '<?xml version="1.0" encoding="utf-8"?>',
          '<!-- Generado por plugins/with-cleartext-when-http.js. No editar a mano. -->',
          '<network-security-config>',
          '  <domain-config cleartextTrafficPermitted="true">',
          `    <domain includeSubdomains="false">${host}</domain>`,
          '  </domain-config>',
          '</network-security-config>',
          '',
        ].join('\n'),
        'utf8',
      );
      return modConfig;
    },
  ]);
}

module.exports = function withCleartextWhenHttp(config, { apiUrl } = {}) {
  if (!apiUrl || !apiUrl.startsWith('http://')) return config;

  const host = hostOf(apiUrl);
  if (!host) return config;

  const withXml = withNetworkSecurityConfig(config, host);

  return withAndroidManifest(withXml, (modConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    // El atributo general sigue haciendo falta ademas del fichero: hay rutas de red —y versiones de
    // Android— que consultan el atributo antes que la configuracion por dominio.
    application.$['android:usesCleartextTraffic'] = 'true';
    application.$['android:networkSecurityConfig'] = `@xml/${CONFIG_RESOURCE}`;
    return modConfig;
  });
};
