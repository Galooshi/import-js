module.exports = {
  env: {
    jest: true,
  },

  rules: {
    'global-require': 'off',
    'no-underscore-dangle': ['error', {
      allow: [
        '__setFile',
        '__setJsonFile',
        '__setJsonFileFallback',
      ],
      allowAfterThis: true,
    }],
  },
};
