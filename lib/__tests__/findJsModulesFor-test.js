import path from 'path';

import Configuration from '../Configuration';
import FileUtils from '../FileUtils';
import JsModule from '../JsModule';
import ModuleFinder from '../ModuleFinder';
import findJsModulesFor, { dedupeAndSort } from '../findJsModulesFor';

jest.mock('../ModuleFinder');
jest.mock('../FileUtils');

beforeEach(() => {
  ModuleFinder.getForWorkingDirectory.mockImplementation(() => ({
    find() {
      return Promise.resolve([{ path: './foo.js', isDefault: true }]);
    },
  }));
});

it('returns matching modules', () =>
  findJsModulesFor(new Configuration('./bar.js'), 'foo').then((jsModules) => {
    expect(jsModules.length).toEqual(1);
  }));

describe('when a matching module is excluded', () => {
  beforeEach(() => {
    FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
      excludes: ['./*.js'],
    });
  });

  it('strips it out', () =>
    findJsModulesFor(new Configuration('./bar.js'), 'foo').then((jsModules) => {
      expect(jsModules.length).toEqual(0);
    }));
});

describe('when matching to an array of various modules', () => {
  const modules = [
    new JsModule({
      importPath: './foo/bar',
      variableName: 'bar',
      hasNamedExports: true,
    }),
    new JsModule({
      importPath: './foo/bar',
      variableName: 'bar',
      hasNamedExports: false,
    }),
    new JsModule({
      importPath: './bar',
      variableName: 'bar',
      hasNamedExports: false,
    }),
    new JsModule({
      importPath: './bar',
      variableName: 'Bar',
      hasNamedExports: false,
    }),
  ];

  it('dedupes and sorts', () => {
    expect(dedupeAndSort(modules)).toEqual([
      new JsModule({
        importPath: './bar',
        variableName: 'bar',
        hasNamedExports: false,
      }),
      new JsModule({
        importPath: './foo/bar',
        variableName: 'bar',
        hasNamedExports: false,
      }),
      new JsModule({
        importPath: './foo/bar',
        variableName: 'bar',
        hasNamedExports: true,
      }),
    ]);
  });
});
