/**
 * Igual que `apps/consumer-app/jest.config.js`, más el alias `@cliente/*` con el que esta app usa
 * los componentes de su hermana. React se fija al de la app del cliente por el mismo motivo que
 * allí (dos copias en el repo; ver su comentario): así el componente compartido y la prueba usan
 * el mismo.
 */
const cliente = '<rootDir>/../consumer-app';

module.exports = {
  preset: 'jest-expo',
  resolver: '<rootDir>/jest.resolver.js',
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cliente/(.*)$': `${cliente}/src/$1`,
    '^react$': `${cliente}/node_modules/react`,
    '^react/(.*)$': `${cliente}/node_modules/react/$1`,
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
};
