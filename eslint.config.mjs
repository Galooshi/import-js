import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  {
    ignores: ['build/**', 'coverage/**'],
  },

  {
    languageOptions: {
      globals: globals.node,
    },
  },

  pluginJs.configs.recommended,

  {
    files: ['**/__mocks__/**', '**/__tests__/**'],
    languageOptions: {
      globals: globals.jest,
    },
  },
];
