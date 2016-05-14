module.exports = {
  parser: 'babel-eslint',

  plugins: [
    'flowtype',
    'flow-vars',

    // Although we don't have any React or JSX in this project, we need to have
    // this plugin and some of the rules from this plugin enabled here so that
    // our tests work. We should probably look into a way of doing this so that
    // this configuration is scoped specifically for the tests that require it.
    'react',
  ],

  extends: [
    'airbnb-base',
    'plugin:react/recommended',
  ],

  rules: {
    'no-underscore-dangle': ['error', { allowAfterThis: true }],

    'flowtype/require-parameter-type': 2,
    'flowtype/require-return-type': [2, 'always', {
      annotateUndefined: 'never'
    }],
    'flowtype/space-after-type-colon': [2, 'always'],
    'flowtype/space-before-type-colon': [2, 'never'],
    'flowtype/type-id-match': [2, "^([A-Z][a-z0-9]+)+Type$"],

    'flow-vars/define-flow-type': 2,
    'flow-vars/use-flow-type': 2,
  },

  settings: {
    flowtype: {
      onlyFilesWithFlowAnnotation: true,
    },
  },
};
