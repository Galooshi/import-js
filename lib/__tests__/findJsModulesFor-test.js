import path from 'path';

import Configuration from '../Configuration';
import FileUtils from '../FileUtils';
import ModuleFinder from '../ModuleFinder';
import findJsModulesFor from '../findJsModulesFor';

jest.mock('../ModuleFinder');
jest.mock('../FileUtils');

beforeEach(() => {
  ModuleFinder.getForWorkingDirectory.mockImplementation(() => ({
    find() {
      return Promise.resolve([{ path: './foo.js', isDefault: true }]);
    },
  }));
});

it('returns matching modules', () => findJsModulesFor(
  new Configuration('./bar.js'),
  'foo',
  './bar.js',
).then((jsModules) => {
  expect(jsModules.length).toEqual(1);
}));

describe('when a matching module is excluded', () => {
  beforeEach(() => {
    FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
      excludes: ['./*.js'],
    });
  });

  it('strips it out', () => findJsModulesFor(
    new Configuration('./bar.js'),
    'foo',
    './bar.js',
  ).then((jsModules) => {
    expect(jsModules.length).toEqual(0);
  }));
});
