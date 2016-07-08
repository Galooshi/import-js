module.exports = {
  environments: ['node'],
  ignorePackagePrefixes: ['lodash.'],
  logLevel: 'debug',
  excludes: [
    './build/**',
    './lib/__mocks__/**'
  ],
  importDevDependencies: ({ pathToCurrentFile }) =>
    /lib\/__tests__/.test(pathToCurrentFile) ||
      /lib\/benchmark\.js/.test(pathToCurrentFile)
}
