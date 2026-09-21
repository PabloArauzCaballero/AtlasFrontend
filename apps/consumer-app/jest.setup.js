/**
 * Lo que hace falta para RENDERIZAR un componente en jest.
 *
 * Hasta ahora las pruebas eran solo de dominio (`.ts`) y nada de esto se necesitaba. Los primeros
 * tests de componente (`FieldLabel`, `SelectField`) importan `ui/motion`, que importa reanimated, y
 * reanimated sin su preparación de pruebas muere al cargar los worklets nativos.
 */
require('react-native-reanimated').setUpTests();

/*
 * AsyncStorage no existe fuera del dispositivo: su modulo nativo es `null` en jest y cualquier
 * componente que arrastre la bitacora del alta —que guarda su cola en disco— muere al importarla,
 * antes de renderizar nada. La propia libreria publica su doble para pruebas; es el camino que
 * documenta. Va aqui y no en cada test: lo necesita cualquier pantalla que se monte.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
