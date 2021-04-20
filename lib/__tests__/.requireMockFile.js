if (process.env.NODE_ENV === 'test') {
  module.exports = { testEnv: true };
  console.log('side effect');
} else {
  module.exports = { notTestEnv: 1 };
}
