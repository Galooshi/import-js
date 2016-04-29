# Contributing

## Adding support for another editor

Most editor plugins will integrate with ImportJS via the command line utility.
Execute the `importjs` command in the project's root directory with the options
needed for the command you want to add, and parse the resulting JSON.

If your editor can consume plugins written in JavaScript (e.g. Atom), then you
can depend on the import-js package directly, which exports the base `Importer`
class.

## Testing

ImportJS uses Jest to test its behavior. To run tests, first ensure that this
project's dependencies are installed:

```sh
npm install
```

Once you have the dependencies installed, you just type `npm test` in the root
folder of the project to run all tests.

```sh
⨠ npm test

> import-js@0.7.0 test /path/to/import-js
> npm run --silent lint; npm run --silent jest

Using Jest CLI v11.0.2, jasmine2, babel-jest
 PASS  lib/__tests__/resolveImportPathAndMain-test.js (0.743s)
 PASS  lib/__tests__/ImportStatements-test.js (1.459s)
 PASS  lib/__tests__/JsModule-test.js (0.923s)
 PASS  lib/__tests__/Configuration-test.js (0.321s)
 PASS  lib/__tests__/ImportStatement-test.js (0.158s)
 PASS  lib/__tests__/FileUtils-test.js (0.094s)
 PASS  lib/__tests__/Importer-test.js (27.172s)
285 tests passed (285 total in 7 test suites, run time 29.123s)
```

## Code of conduct

This project adheres to the [Open Code of Conduct][code-of-conduct]. By
participating, you are expected to honor this code.

[code-of-conduct]: http://todogroup.org/opencodeofconduct/#Import-JS/henric.trotzig@gmail.com
