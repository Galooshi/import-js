export default function parse(fileContent: String): Object {
  // eslint-disable-next-line global-require
  const babylon = require('babylon');

  try {
    return babylon.parse(fileContent, {
      allowImportExportEverywhere: true,
      plugins: [
        'jsx',
        'flow',
      ],
      sourceType: 'module',
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return babylon.parse('');
    }
    throw new Error(error);
  }
}
