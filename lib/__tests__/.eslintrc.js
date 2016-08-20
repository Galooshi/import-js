module.exports = {
  env: {
    jest: true,
  },

  rules: {
    'global-require': 'off',
    'no-underscore-dangle': ['error', {
      allow: [
        '__addResolvedPath',
        '__setExistingFiles',
        '__setFile',
        '__setFileFallback',
        '__setVersion',
        '__reset',
      ],
      allowAfterThis: true,
    }],

    'import/no-extraneous-dependencies': [2, { devDependencies: true }],
  },
};
