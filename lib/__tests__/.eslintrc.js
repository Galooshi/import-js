module.exports = {
  env: {
    jest: true,
  },

  rules: {
    'global-require': 'off',
    'no-underscore-dangle': ['error', {
      allow: [
        '__setExistingFiles',
        '__setFile',
        '__setJsonFile',
        '__setJsonFileFallback',
        '__setVersion',
        '__reset',
      ],
      allowAfterThis: true,
    }],
  },
};
