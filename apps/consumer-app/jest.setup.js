/**
 * Lo que hace falta para RENDERIZAR un componente en jest.
 *
 * Hasta ahora las pruebas eran solo de dominio (`.ts`) y nada de esto se necesitaba. Los primeros
 * tests de componente (`FieldLabel`, `SelectField`) importan `ui/motion`, que importa reanimated, y
 * reanimated sin su preparación de pruebas muere al cargar los worklets nativos.
 */
require('react-native-reanimated').setUpTests();
