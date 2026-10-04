// ESLint flat config — plain browser JavaScript, no bundler, no modules.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['assets/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used' }],
      'no-undef': 'error',
    },
  },
];
