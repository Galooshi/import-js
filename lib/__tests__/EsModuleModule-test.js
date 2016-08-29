import fs from 'fs';
import path from 'path';

import EsModuleModule from '../EsModuleModule';

jest.mock('fs');

describe('EsModuleModule', () => {
  afterEach(() => {
    fs.__reset();
  });

  describe('when parsing exports', () => {
    [
      {
        statementType: 'expression',
        statement: 'export default 42;',
        localName: '*default*',
      },
      {
        statementType: 'function',
        statement: 'export default function () {}',
        localName: '*default*',
      },
      {
        statementType: 'function with a localName',
        statement: 'export default function name1() {}',
        localName: 'name1',
      },
      {
        statementType: 'class',
        statement: 'export default class {}',
        localName: '*default*',
      },
      {
        statementType: 'class with a localName',
        statement: 'export default class name1{}',
        localName: 'name1',
      },
      {
        statementType: 'generator',
        statement: 'export default function * () {}',
        localName: '*default*',
      },
      {
        statementType: 'generator with a localName',
        statement: 'export default function* name1() {}',
        localName: 'name1',
      },
    ].forEach(({ statementType, statement, localName }) => {
      it(`identifies a default export of a ${statementType}`, () => {
        const testModulePath = path.join(process.cwd(), 'esMod.js');
        fs.__setFile(
          testModulePath,
          statement,
          { isDirectory: () => false }
        );
        const testModule = new EsModuleModule({
          modulePath: testModulePath,
          hostResolveImportedModule: () => {},
        });
        expect(testModule.exportEntries.length).toEqual(1);
        expect(testModule.localExportEntries.length).toEqual(1);
        expect(testModule.exportEntries).toEqual(testModule.localExportEntries);
        expect(testModule.exportEntries).toEqual([{
          exportName: 'default',
          moduleRequest: null,
          importName: null,
          localName,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[0].location,
        }]);
        expect(testModule.getExportedNames(new Set())).toEqual(['default']);
      });
    });

    [
      {
        situation: 'previously defined variable',
        statement: 'export { variable1, variable2 };',
      },
      {
        situation: 'variable defined with let',
        statement: 'export let variable1, variable2;',
      },
      {
        situation: 'variable defined with let and initialized',
        statement: 'export let variable1 = 42, variable2 = 42;',
      },
      {
        situation: 'variable defined with var',
        statement: 'export var variable1, variable2;',
      },
      {
        situation: 'variable defined with var and initialized',
        statement: 'export var variable1 = 42, variable2 = 42;',
      },
      {
        situation: 'const',
        statement: 'export const variable1 = 42, variable2 = 42;',
      },
    ].forEach(({ situation, statement }) => {
      it(`identifies a named export of a ${situation}`, () => {
        const testModulePath = path.join(process.cwd(), 'esMod.js');
        fs.__setFile(
          testModulePath,
          statement,
          { isDirectory: () => false }
        );
        const testModule = new EsModuleModule({
          modulePath: testModulePath,
          hostResolveImportedModule: () => {},
        });
        expect(testModule.exportEntries.length).toEqual(2);
        expect(testModule.localExportEntries.length).toEqual(2);
        expect(testModule.exportEntries).toEqual(testModule.localExportEntries);
        expect(testModule.exportEntries).toEqual([
          {
            exportName: 'variable1',
            moduleRequest: null,
            importName: null,
            localName: 'variable1',
            // Don't care to create a proper 'location' object to pass the expect.
            location: testModule.exportEntries[0].location,
          }, {
            exportName: 'variable2',
            moduleRequest: null,
            importName: null,
            localName: 'variable2',
            // Don't care to create a proper 'location' object to pass the expect.
            location: testModule.exportEntries[1].location,
          },
        ]);
        expect(testModule.getExportedNames(new Set())).toEqual(['variable1', 'variable2']);
      });
    });

    [
      {
        situation: 'function',
        statement: 'export function name1 () {}',
      },
      {
        situation: 'class',
        statement: 'export class name1 {}',
      },
      {
        situation: 'generator',
        statement: 'export function * name1 () {}',
      },
    ].forEach(({ situation, statement }) => {
      it(`identifies a named export of a ${situation}`, () => {
        const testModulePath = path.join(process.cwd(), 'esMod.js');
        fs.__setFile(
          testModulePath,
          statement,
          { isDirectory: () => false }
        );
        const testModule = new EsModuleModule({
          modulePath: testModulePath,
          hostResolveImportedModule: () => {},
        });
        expect(testModule.exportEntries.length).toEqual(1);
        expect(testModule.localExportEntries.length).toEqual(1);
        expect(testModule.exportEntries).toEqual(testModule.localExportEntries);
        expect(testModule.exportEntries).toEqual([
          {
            exportName: 'name1',
            moduleRequest: null,
            importName: null,
            localName: 'name1',
            // Don't care to create a proper 'location' object to pass the expect.
            location: testModule.exportEntries[0].location,
          },
        ]);
        expect(testModule.getExportedNames(new Set())).toEqual(['name1']);
      });
    });

    // export { variable1 as name1, variable2 as name2, …, nameN };
    it('identifies an aliased named export of a previously defined variable', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'export { variable1 as name1, variable2 as name2 };',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.exportEntries.length).toEqual(2);
      expect(testModule.localExportEntries.length).toEqual(2);
      expect(testModule.exportEntries).toEqual(testModule.localExportEntries);
      expect(testModule.exportEntries).toEqual([
        {
          exportName: 'name1',
          moduleRequest: null,
          importName: null,
          localName: 'variable1',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[0].location,
        }, {
          exportName: 'name2',
          moduleRequest: null,
          importName: null,
          localName: 'variable2',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[1].location,
        },
      ]);
      expect(testModule.getExportedNames(new Set())).toEqual(['name1', 'name2']);
    });

    // export { name1 as default, … };
    it('identifies an aliased default export of a previously defined variable', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'export { variable1 as default, variable2 as name2 };',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.exportEntries.length).toEqual(2);
      expect(testModule.localExportEntries.length).toEqual(2);
      expect(testModule.exportEntries).toEqual(testModule.localExportEntries);
      expect(testModule.exportEntries).toEqual([
        {
          exportName: 'default',
          moduleRequest: null,
          importName: null,
          localName: 'variable1',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[0].location,
        }, {
          exportName: 'name2',
          moduleRequest: null,
          importName: null,
          localName: 'variable2',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[1].location,
        },
      ]);
      expect(testModule.getExportedNames(new Set())).toEqual(['default', 'name2']);
    });

    // export { name1, name2, …, nameN } from …;
    it('identifies a named reexport of another module\'s named exports', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'export { variable1, variable2 } from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.exportEntries.length).toEqual(2);
      expect(testModule.indirectExportEntries.length).toEqual(2);
      expect(testModule.exportEntries).toEqual(testModule.indirectExportEntries);
      expect(testModule.exportEntries).toEqual([
        {
          exportName: 'variable1',
          moduleRequest: 'someModule',
          importName: 'variable1',
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[0].location,
        }, {
          exportName: 'variable2',
          moduleRequest: 'someModule',
          importName: 'variable2',
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[1].location,
        },
      ]);
      expect(testModule.getExportedNames(new Set())).toEqual(['variable1', 'variable2']);
    });

    // export { import1 as name1, import2 as name2, …, nameN } from …;
    it('identifies an aliased named reexport of another module\'s named exports', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'export { variable1 as name1, variable2 } from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.exportEntries.length).toEqual(2);
      expect(testModule.indirectExportEntries.length).toEqual(2);
      expect(testModule.exportEntries).toEqual(testModule.indirectExportEntries);
      expect(testModule.exportEntries).toEqual([
        {
          exportName: 'name1',
          moduleRequest: 'someModule',
          importName: 'variable1',
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[0].location,
        }, {
          exportName: 'variable2',
          moduleRequest: 'someModule',
          importName: 'variable2',
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[1].location,
        },
      ]);
      expect(testModule.getExportedNames(new Set())).toEqual(['name1', 'variable2']);
    });

    // export * from …;
    it('identifies a reexport of everything from another module', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'export * from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.exportEntries.length).toBe(1);
      expect(testModule.starExportEntries.length).toBe(1);
      expect(testModule.exportEntries).toEqual(testModule.starExportEntries);
      expect(testModule.exportEntries).toEqual([
        {
          exportName: null,
          moduleRequest: 'someModule',
          importName: '*',
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[0].location,
        },
      ]);
    });

    // reexport moduleNameSpace object stage 1 proposals
    // export * as someIdentifier from "someModule";
    it('identifies a named reexport of another module\'s moduleNameSpace', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'export * as name1 from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.exportEntries.length).toBe(1);
      expect(testModule.indirectExportEntries.length).toBe(1);
      expect(testModule.exportEntries).toEqual(testModule.indirectExportEntries);
      expect(testModule.exportEntries).toEqual([
        {
          exportName: 'name1',
          moduleRequest: 'someModule',
          importName: '*',
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[0].location,
        },
      ]);
      expect(testModule.getExportedNames(new Set())).toEqual(['name1']);
    });

    // reexport default from stage 1 proposals
    // export name1 from "someModule";
    it('identifies a reexport of another module\'s default', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'export name1 from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.exportEntries.length).toBe(1);
      expect(testModule.indirectExportEntries.length).toBe(1);
      expect(testModule.exportEntries).toEqual(testModule.indirectExportEntries);
      expect(testModule.exportEntries).toEqual([
        {
          exportName: 'name1',
          moduleRequest: 'someModule',
          importName: 'default',
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.exportEntries[0].location,
        },
      ]);
      expect(testModule.getExportedNames(new Set())).toEqual(['name1']);
    });
  });

  describe('when parsing imports', () => {
    // import v from "mod";
    it('identifies a default import', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'import name1 from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.importEntries.length).toBe(1);
      expect(testModule.importEntries).toEqual([
        {
          moduleRequest: 'someModule',
          importName: 'default',
          localName: 'name1',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.importEntries[0].location,
        },
      ]);
      expect([...testModule.importedBoundNames]).toEqual(['name1']);
    });

    // import * as ns from "mod";
    it('identifies a namespace import', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'import * as name1 from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.importEntries.length).toBe(1);
      expect(testModule.importEntries).toEqual([
        {
          moduleRequest: 'someModule',
          importName: '*',
          localName: 'name1',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.importEntries[0].location,
        },
      ]);
      expect([...testModule.importedBoundNames]).toEqual(['name1']);
    });

    // import {x} from "mod";
    it('identifies a named import', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'import { name1 } from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.importEntries.length).toBe(1);
      expect(testModule.importEntries).toEqual([
        {
          moduleRequest: 'someModule',
          importName: 'name1',
          localName: 'name1',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.importEntries[0].location,
        },
      ]);
      expect([...testModule.importedBoundNames]).toEqual(['name1']);
    });

    // import {x as v} from "mod";
    it('identifies an aliased named import', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'import { variable1 as name1 } from "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.importEntries.length).toBe(1);
      expect(testModule.importEntries).toEqual([
        {
          moduleRequest: 'someModule',
          importName: 'variable1',
          localName: 'name1',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.importEntries[0].location,
        },
      ]);
      expect([...testModule.importedBoundNames]).toEqual(['name1']);
    });

    // import "mod";
    it('identifies a side-effect import', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath,
        'import "someModule";',
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.importEntries.length).toBe(1);
      expect(testModule.importEntries).toEqual([
        {
          moduleRequest: 'someModule',
          importName: null,
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.importEntries[0].location,
        },
      ]);
    });
  });

  describe('when parsing export of imported element', () => {
    // import * as ns from "mod";
    // export { ns };
    it('exports a namespace import in localExportEntries', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath, `
import * as name1 from "someModule";
export { name1 };
        `.trim(),
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.localExportEntries.length).toBe(1);
      expect(testModule.localExportEntries).toEqual([
        {
          exportName: 'name1',
          moduleRequest: null,
          importName: null,
          localName: 'name1',
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.localExportEntries[0].location,
        },
      ]);
    });

    // import { v } from "mod";
    // export { v };
    it('exports a named import in indirectExportEntries', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath, `
import { name1 } from "someModule";
export { name1 };
        `.trim(),
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.indirectExportEntries.length).toBe(1);
      expect(testModule.indirectExportEntries).toEqual([
        {
          exportName: 'name1',
          moduleRequest: 'someModule',
          importName: 'name1',
          localName: null,
          // Don't care to create a proper 'location' object to pass the expect.
          location: testModule.indirectExportEntries[0].location,
        },
      ]);
    });
  });

  describe('when parsing modules with other elements', () => {
    // This is primarily here to increase coverage of branches like defaults
    it('still processes imports/exports', () => {
      const testModulePath = path.join(process.cwd(), 'esMod.js');
      fs.__setFile(
        testModulePath, `
// Sample comment
const name2 = 'test';
import * as name1 from "someModule";
let name3;
export { name1 };
        `.trim(),
        { isDirectory: () => false }
      );
      const testModule = new EsModuleModule({
        modulePath: testModulePath,
        hostResolveImportedModule: () => {},
      });
      expect(testModule.importEntries.length).toBe(1);
      expect(testModule.localExportEntries.length).toBe(1);
      expect(testModule.exportEntries.length).toBe(1);
    });
  });
});
