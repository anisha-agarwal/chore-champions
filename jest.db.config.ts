import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/db/**/*.db.test.ts'],
  setupFiles: ['./__tests__/db/db-setup.ts'],
  setupFilesAfterFramework: ['./__tests__/db/db-setup-after-env.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
  forceExit: true,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default config
