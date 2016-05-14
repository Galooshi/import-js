module.exports = {
  plugins: [
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
  }
};
