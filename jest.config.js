module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', 'infrastructure/cli/config/test.ts'],
  moduleNameMapper: {
    '^ora$': '<rootDir>/src/test/__mocks__/ora.cjs',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    './src/main/services/Publisher.ts': { lines: 70 },
    './src/main/services/GitCliHandlers/GitRemoteCliHandler.ts': { lines: 70 },
    './src/main/services/GitCliHandlers/GitPushAllCliHandler.ts': { lines: 70 },
  },
};

