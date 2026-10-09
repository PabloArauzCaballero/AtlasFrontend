module.exports = {
  preset: 'jest-expo',
  // Ver la cabecera de `jest.resolver.js`: sin esto, montar un componente que use reanimated muere
  // al cargar los worklets nativos.
  resolver: '<rootDir>/jest.resolver.js',
  // Antes que nada: `src/api/config.ts` exige la URL de la API al cargarse. Ver `jest.env.js`.
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    /*
      UN solo React en la corrida.

      El repo tiene dos: la app fija `react` exacto (19.2.3) y npm lo deja en
      `apps/consumer-app/node_modules`, mientras que en la raíz vive el que arrastran las demás
      dependencias (19.2.8). Con los dos, el reconciliador que monta el árbol usa uno y el
      componente que se está probando usa el otro: los hooks del segundo no encuentran su
      despachador y el test muere con «Cannot read properties of null (reading 'useState')», que no
      dice nada de lo que pasa. Se fija el de la app, que es el que se publica.
    */
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
};
