module.exports = {
  // Ambiente de teste
  testEnvironment: 'node',
  
  // Diretórios de teste
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Diretórios a serem ignorados
  testPathIgnorePatterns: [
    '/node_modules/',
    '/logs/',
    '/examples/'
  ],
  
  // Cobertura de código
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Arquivos para cobertura
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js', // Arquivo principal não precisa de cobertura
    '!**/node_modules/**'
  ],
  
  // Limite de cobertura
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Configurações de timeout
  testTimeout: 30000,
  
  // Configurações de setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Configurações de módulos
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Configurações de verbose
  verbose: true,
  
  // Configurações de clear mocks
  clearMocks: true,
  
  // Configurações de restore mocks
  restoreMocks: true
};
