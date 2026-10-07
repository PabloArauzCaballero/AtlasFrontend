/**
 * El resolvedor de React Native, con la excepción que pide `react-native-worklets`.
 *
 * Reanimated 4 delega los worklets en `react-native-worklets`, y ese paquete publica sus módulos
 * duplicados: `X.native.ts` habla con el módulo nativo de la app y `X.ts` es la implementación que
 * funciona sin él. Jest resuelve las extensiones `.native` primero —es lo correcto para todo lo
 * demás— así que al importar reanimated cargaba `NativeWorklets.native`, que busca un proxy nativo
 * que en un test no existe y muere con «Cannot read properties of undefined (reading
 * 'loadUnpackers')» antes de dibujar nada.
 *
 * `react-native-worklets/jest/resolver.js` resuelve exactamente eso, pero es un resolvedor entero y
 * `jest-expo` ya trae el suyo (el de React Native, que destapa los `exports` de `react-native`).
 * Poner uno quita el otro, así que aquí se encadenan: la excepción de worklets delante, el
 * resolvedor de React Native detrás.
 */
const resolverDeReactNative = require('@react-native/jest-preset/jest/resolver');

module.exports = (peticion, opciones) => {
  const esWorklets = peticion.includes('react-native-worklets') || opciones.basedir.includes('react-native-worklets');
  if (!esWorklets) return resolverDeReactNative(peticion, opciones);
  return resolverDeReactNative(peticion, {
    ...opciones,
    extensions: opciones.extensions?.filter((extension) => !extension.includes('native')),
  });
};
