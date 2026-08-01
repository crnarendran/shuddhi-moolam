module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:jsdoc/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    'jest.config.js',
    '.eslintrc.js'
  ],
  plugins: [
    '@typescript-eslint',
    'jsdoc',
  ],
  rules: {
    'max-len': ['error', { code: 80, ignoreUrls: true }],
    'indent': ['error', 2],
    '@typescript-eslint/no-explicit-any': 'error',
    'no-trailing-spaces': 'error',
    'jsdoc/require-jsdoc': [
      'error',
      {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
      },
    ],
    'jsdoc/require-param': 'error',
    'jsdoc/require-returns': 'error',
  },
};
