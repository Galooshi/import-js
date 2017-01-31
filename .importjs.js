const testFilePattern = /lib\/__tests__/;

module.exports = {
  environments: ({ pathToCurrentFile }) => {
    if (testFilePattern.test(pathToCurrentFile)) {
      return ['jest', 'node'];
    }
    return ['node'];
  },
  ignorePackagePrefixes: ['lodash.'],
  declarationKeyword: 'import',
  logLevel: 'debug',
  excludes: [
    './build/**',
    './lib/__mocks__/**'
  ],
  importDevDependencies: ({ pathToCurrentFile }) =>
    testFilePattern.test(pathToCurrentFile),
}
