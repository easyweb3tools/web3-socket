/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/integration-tests/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/integration-tests/setup.ts'],
    testTimeout: 30000,
    verbose: true,
    detectOpenHandles: true,
    forceExit: true,
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage/integration',
    coverageReporters: ['text', 'lcov'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/__tests__/',
        '/coverage/'
    ],
};