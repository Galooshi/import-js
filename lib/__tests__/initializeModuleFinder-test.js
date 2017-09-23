import initializeModuleFinder from '../initializeModuleFinder';

it('fails if required files are missing', () => {
  const bogusDir = '/tmp/sherlock-holmes/pippi-longstocking';

  return initializeModuleFinder(bogusDir)
    .then(() => {
      expect(true).toEqual(false); // we shouldn't end up here
    })
    .catch((error) => {
      expect(error.message).toEqual(`ModuleFinder is disabled for ${bogusDir} (none of .importjs.js, package.json were found).`);
    });
});
