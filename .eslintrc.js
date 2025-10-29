module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    // Regras de estilo
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    
    // Regras de variáveis
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-undef': 'error',
    
    // Regras de funções
    'no-duplicate-params': 'error',
    'no-return-await': 'error',
    
    // Regras de objetos
    'no-duplicate-keys': 'error',
    'no-extra-parens': ['error', 'functions'],
    
    // Regras de strings
    'no-template-curly-in-string': 'error',
    
    // Regras de comparação
    'eqeqeq': ['error', 'always'],
    'no-eq-null': 'error',
    
    // Regras de console
    'no-console': 'warn',
    
    // Regras de async/await
    'require-await': 'error',
    
    // Regras de segurança
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Regras de performance
    'no-loop-func': 'error',
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    
    // Regras de legibilidade
    'camelcase': ['error', { 'properties': 'never' }],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': ['error', { 'before': false, 'after': true }],
    'comma-style': ['error', 'last'],
    'computed-property-spacing': ['error', 'never'],
    'func-call-spacing': ['error', 'never'],
    'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true }],
    'keyword-spacing': ['error', { 'before': true, 'after': true }],
    'object-curly-spacing': ['error', 'always'],
    'space-before-blocks': 'error',
    'space-before-function-paren': ['error', 'never'],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-unary-ops': 'error',
    'spaced-comment': ['error', 'always']
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off'
      }
    }
  ]
};
