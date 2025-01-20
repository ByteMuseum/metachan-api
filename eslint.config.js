const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true
      }
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      'no-console': 'warn'
    }
  }
];