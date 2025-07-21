/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/load-tests/**/*.test.ts'],
    testTimeout: 300000, // 5 minutes
    verbose: true,
    detectOpenHandles: true,
    forceExit: true,
    maxWorkers: 1, // Run tests sequentially
};