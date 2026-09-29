module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/toolkit/tools'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'toolkit/tools/**/*.js',
    '!src/__tests__/**',
    '!toolkit/tools/__tests__/**',
  ],
  coverageReporters: ['text', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
