/**
 * En que anfitrion corre la app.
 *
 * ## Por que hace falta saberlo
 *
 * Expo Go es un binario ya compilado por Expo: trae los modulos nativos del SDK y **ningun otro**.
 * Un modulo que no viaje dentro de el no falla al empaquetar ni al arrancar Metro —el bundle de
 * JavaScript es identico—, falla al pedir la parte nativa, y el mensaje (`Cannot find native module
 * 'X'`) aparece en el arranque aunque la pantalla que lo usa este a cinco toques de distancia.
 *
 * Con esta bandera un modulo asi se carga de forma perezosa y solo donde existe, y la pantalla
 * ofrece otra manera de hacer lo mismo en lugar de tumbar la app entera.
 *
 * `storeClient` es exactamente «me esta ejecutando el cliente de la tienda», que es Expo Go. En el
 * binario propio de Atlas —`bare` o `standalone`— vale `false` y no cambia nada de lo que ya habia.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';

export const esExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
