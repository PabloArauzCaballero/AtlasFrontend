/**
 * El cableado REAL de la bitacora: almacen en disco y transporte por la API.
 *
 * Es el unico archivo del modulo que toca AsyncStorage y la red. `bitacora.ts` recibe las dos
 * cosas inyectadas para que las pruebas lo monten con fakes; aqui se decide que en la app son
 * `@react-native-async-storage/async-storage` y `telemetryApi.enviarLote`.
 *
 * Se configura una vez, al importar. Importarlo dos veces no reconfigura: el modulo se evalua una
 * sola vez.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as telemetryApi from '../../api/endpoints/telemetry';
import { bitacora } from './bitacora';

bitacora.configurar({
  almacen: {
    leer: (clave) => AsyncStorage.getItem(clave),
    escribir: (clave, valor) => AsyncStorage.setItem(clave, valor),
    borrar: (clave) => AsyncStorage.removeItem(clave),
  },
  transporte: (customerId, lote) => telemetryApi.enviarLote(customerId, lote),
});

export { bitacora, esCampo, esControl, pantallaDeRuta } from './bitacora';
export type { Campo, Control, Pantalla } from './tipos';
