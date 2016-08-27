# Review
## ImportJS Mission
From README.md:
>ImportJS is a tool to automatically import dependencies in your JavaScript
project. Use it along with one of our editor integrations...

The primary instantiation of this mission is the ability to place the cursor on
an unresolved variable in the editor window and activate ImportJS to find a
module that resolves that variable and insert an appropriate import statement
for that module at the top of the current module. The command line version of
this command is
```
importjs word <word> <pathToFile>
```
In order to perform this operation, ImportJS leverages three fundamental
capabilities:
1. the ability to parse the current file just enough to find its current import
statements and add to them
2. the ability to construct import statements
3. the ability to identify which module(s) might resolve the unresolved variable

Having these capabilities opened the door to further operations. The most
notable of these in the current instantiation are the "fix" and "goto"
operations.

"Fix" identifies all unresolved variables and attempts to construct import
statements to resolve them. It is also able to place those statements in groups
and sort them within the groups.

"Goto" attempts to open the module that resolves the import. I do not believe at
this time that it also places the cursor at the appropriate export statement.
That would be an interesting, and possible, future enhancement.

## Legacy Theory of Operation
In CommonJS (CJS) days, most imports involved "require"ing the whole module in a
statement such as
```javascript
someVar = require('someModuleSpecifier');
```
This leaves the door open to `someVar` being anything at all, giving no clue to
which module might resolve it.

Luckily, there is widespread convention that 'someVar' ===
'someModuleSpecifier'. Thus, to resolve the unresolved variable 'minimatch',
ImportJS would first verify that there is either a package named 'minimatch' in
the package.json or a local module named minimatch.js somewhere within the
project and then insert an import such as either
```javascript
// if found in an npm package...
import minimatch from 'minimatch';
// or if found in a local module
import minimatch from '../somepath/minimatch.js';
```
Though widespread, there are holes in the convention. To patch these, a number
of options were added included "aliases" and "namedExports". "aliases" allow
users to specify an explicit one-to-one mapping of a variable to a
moduleSpecifier. "namedExports" allow users to specify an explicit many-to-one
mapping of variables to a moduleSpecifier.

Still, the overhead of using this convention plus the explicit workarounds to
find the module from which to import has been low enough to date to allow the
operation that determines the appropriate moduleSpecifier to be performed on
demand with little caching of knowledge from one invocation to the next.
# The Problem and Goal
With the advent of EcmaScript modules (ES modules) in ES6, named exports were
introduced and made easy to utilize. Something like these has been available
prior to ES modules using CommonJS in this manner.
```javascript
//------ lib.js ------
var sqrt = Math.sqrt;
function square(x) {
    return x * x;
}
function diag(x, y) {
    return sqrt(square(x) + square(y));
}
module.exports = {
    sqrt: sqrt,
    square: square,
    diag: diag,
};

//------ main.js ------
var square = require('lib').square;
var diag = require('lib').diag;
```
In ES modules, this is achievable a bit more directly as follows.
```javascript
//------ lib.js ------
    export const sqrt = Math.sqrt;
    export function square(x) {
        return x * x;
    }
    export function diag(x, y) {
        return sqrt(square(x) + square(y));
    }

    //------ main.js ------
    import { square, diag } from 'lib';
```
This initially led ImportJS developers to create the "namedExports" option that
allows a user to specify the many-to-one mapping from "square" and "diag" to
"lib" as follows.
```json
namedExports: { "lib": ["square", "diag"] }
```
As long as the usage of the named export variation of the import syntax remained
limited and/or projects remained small, this was an effective and acceptable
solution. That is now changing.

[ImportJS issue #199](https://github.com/Galooshi/import-js/issues/199) was
created in recognition that it is not reasonable in a growing number of cases to
ask users to manually define the named exports of all modules and packages
within a project.

The goal of this enhancement effort is **to eliminate or greatly reduce the need
to define namedExports and aliases by automatically deriving the same
information through static analysis**.
# Investigation
## Overview
This effort is focused on enhancing fundamental capability #3 above "the ability
to identify which module(s) might resolve the unresolved variable". To date,
this identification has been performed using nothing but directory information
and static definitions provided in the ImportJS configuration. Satisfying the
goal will require the identification effort to go beyond directory information
and perform static analysis on the content of the identified modules.

The ES module specification aids this effort in that the ES module syntax was
specifically designed with static analysis in mind.

However, few projects will consist of nothing more than ES modules. CJS modules
do not lend themselves to static analysis.

This investigation will focus on identifying knowledge needed to perform static
analysis as accurately as possible.
## Sub Investigations
### What do we analyze?
Every operation ImportJS can perform requires knowledge of what is exported by
modules within the containing scope of the file being edited. ImportJS has an
unusual problem in identifying modules. A typical loader or translator can let
the imports of a starting file lead them to the other files in a cascading
fashion that should only load what is necessary for the application to run.
ImportJS cannot rely on existing imports to guide it. They are assumed to be
incomplete. So ImportJS must analyze everything that a loader might be ordered
by an import statement to load. All of the places that a loader could be
directed to look at by an import statement in the file being edited comprise a
"scope".

Because EcmaScript did not define the semantics of the import statement's
ModuleSpecifier element, this "scope" is defined by the environment in which the
module is being used, not the standard. Here, the richness of the JS community
works against us.

Within most environments studied, the definition of the scope is usually
contained by a "resolver". Resolvers typically take a RequestingModule and an
import statement's ModuleSpecifier as input and "resolve" the ModuleSpecifier to
a path to a file to be loaded.

Also working against us is that we can't just focus on ES modules. ES modules
can and will include CJS modules as well as modules from other systems. We'll be
in a mixed environment for many years to come.

To explore the problems we'll encounter in determining what to analyze, this
section will dissect the "scope"s found in Node and Meteor environments.

#### Node module scope

##### Node CJS module (and transpiled ES module) resolution

Node does not yet contain explicit support for ES modules. But, transpilers are
routinely being used to convert ES modules to CJS modules. Primarily due to
this, the resolver of most interest for ES modules today is the CJS resolver. It
uses an algorithm [documented
here](https://nodejs.org/api/modules.html#modules_all_together) and inserted
below.

```
require(X) from module at path Y
1. If X is a core module,
   a. return the core module
   b. STOP
2. If X begins with './' or '/' or '../'
   a. LOAD_AS_FILE(Y + X)
   b. LOAD_AS_DIRECTORY(Y + X)
3. LOAD_NODE_MODULES(X, dirname(Y))
4. THROW "not found"

LOAD_AS_FILE(X)
1. If X is a file, load X as JavaScript text.  STOP
2. If X.js is a file, load X.js as JavaScript text.  STOP
3. If X.json is a file, parse X.json to a JavaScript Object.  STOP
4. If X.node is a file, load X.node as binary addon.  STOP

LOAD_AS_DIRECTORY(X)
1. If X/package.json is a file,
   a. Parse X/package.json, and look for "main" field.
   b. let M = X + (json main field)
   c. LOAD_AS_FILE(M)
2. If X/index.js is a file, load X/index.js as JavaScript text.  STOP
3. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
4. If X/index.node is a file, load X/index.node as binary addon.  STOP

LOAD_NODE_MODULES(X, START)
1. let DIRS=NODE_MODULES_PATHS(START)
2. for each DIR in DIRS:
   a. LOAD_AS_FILE(DIR/X)
   b. LOAD_AS_DIRECTORY(DIR/X)

NODE_MODULES_PATHS(START)
1. let PARTS = path split(START)
2. let I = count of PARTS - 1
3. let DIRS = []
4. while I >= 0,
   a. if PARTS[I] = "node_modules" CONTINUE
   c. DIR = path join(PARTS[0 .. I] + "node_modules")
   b. DIRS = DIRS + DIR
   c. let I = I - 1
5. return DIRS
```
The code that implements this can be found in Node in the
[Module.\_resolveFilename routine in
lib/module.js](https://github.com/nodejs/node/blob/master/lib/module.js#L441).
This is the routine that implements require.resolve().

To say the least, this routine is non-trivial. It is also expansive. The "while"
loop in NODE_MODULES_PATHS may identify a node_modules directory in any parent
directory of the file being analyzed. In addition, further reading of the
document this pseudocode is pulled from will reveal that the paths listed in the
NODE_PATH environment variable are searched. So, Node's CJS scope can be any
file in reach of the system, but is limited by the package.json, the project's
directory location, and NODE_PATH environment variable.

Also, there is no good interface to the Node function implementing this routine.
The require.resolve() function does not allow you to specify the
RequestingModule. It always works from the caller's point of view. It is not
worthwhile to resolve a ModuleSpecifier relative to our own code.

Wait, **that is a lie** or, at least, a half-truth. Module.\_resolveFilename,
though private by convention, is in fact available and has a parameter for a
"parent" which can take the necessary information to make it work as if a module
that we are processing is calling it. An example of how to accomplish this is
shown [here in the npm package
"resolveFrom"](https://github.com/sindresorhus/resolve-from/blob/master/index.js).

A further twist to keep in mind is that the scope accessible by a module being
analyzed is not the same for every file under a project's working directory.
There can be and almost always are many node_modules directories in parallel
structures underneath the working directory. Users working with complex projects
will often develop multiple packages simultaneously. You can't count on the
package.json or node_modules found in the working directory being the correct
one for the file under edit. It is very important that the search for packages
always be performed from the point of view of the file being analyzed.

##### Proposal for Node support of ES modules defines a new resolution algorithm

There is a Node specification in-work for handling ES modules and it [defines a
new, more limited resolution
algorithm](https://github.com/nodejs/node-eps/blob/master/002-es6-modules.md#52-es-import-path-resolution).
The problem with this is that too many npm packages are already using ES modules
via transpilation to CJS. So, this simplification will actually be a
complication. When npm packages start using this new specification, we'll need
to detect whether the modules being analyzed are going to be transpiled to CJS
or are using the new native Node support for ES modules. The answer determines
which resolution algorithm to use. Choosing the wrong algorithm could result in
creating import statements for modules located out of reach of the native Node
ES module resolution algorithm.

##### Possible resolution for multiple Node resolvers

A possibility for dealing with this and simplifying our implementation of the
Node resolver is to become opinionated. There is support within the Node
documentation for this. First, they are breaking with it for ES modules and
include the statement

>In the case that an import statement is unable to find a module, Node should
make a best effort to see if require would have found the module and print out
where it was found, if NODE_PATH was used, if HOME was used, etc.

Second, there is a note in the CJS modules documentation for [Loading from
Global
Folders](https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders)
advising

>These [capabilities] are mostly for historic reasons. **You are highly
encouraged to place your dependencies locally in node_modules folders.** They
will be loaded faster, and more reliably.

In order to be able to find the modules in bad places and give warnings, we'd
implement the full CJS resolution algorithm. Then, when inserting the imports
that result, we could warn about modules being imported that were found in
locations that may not be found by some resolution algorithms. This would
eliminate the need (which might not even be possible) to ever detect whether we
are processing an ES module being used via a transpiler versus direct Node
support. This approach **would** require that the Node resolver we implement
return a flag indicating that the module was found in a deprecated location and
that that flag be stored with the rest of our analysis results for that module.

##### Some explorations of scopes in Node environments

The following directory tree is derived from our own project which is utilizing
ES modules via babel transpilation. It is notable that in our simple little
project, the full tree has over 15,000 lines that include 2,017 directories and
12,999 files. Of those files, 10,946 are .js or .json files that could be the
targets of imports. Hopefully, this shines some light on why making good choices
in our definition of scope is critical!
```
<project (usually working directory when editing)>
├── bin (all contents should be ignored by our analysis - how do we know?)
├── build (all contents should be ignored by our analysis - how do we know?)
├── .eslintignore (could this be useful?)
├── .git (all contents should be ignored by our analysis - ignore all hidden?)
├── .gitignore (could be useful...)
├── lib (herein lies our source... local modules)
│   ├── benchmark.js
│   ├── CommandLineEditor.js
│   ├── Configuration.js
│   ├── daemon.js
│   ├── environments
│   │   ├── meteorEnvironment.js
│   │   └── nodeEnvironment.js
│   ├── EsModule.js
│   ├── EsModuleMeteor.js
│   ├── EsModuleModule.js
│   ├── EsModules.js
│   ├── FileUtils.js
│   ├── findCurrentImports.js
│   ├── findJsModulesFor.js
│   ├── findMatchingFiles.js
│   ├── findPackageDependencies.js
│   ├── formattedToRegex.js
│   ├── getEslintWithPathCorrected.js
│   ├── Importer.js
│   ├── importjs.js
│   ├── ImportStatement.js
│   ├── ImportStatements.js
│   ├── JsModule.js
│   ├── __mocks__ (ignore outside test??? What tells us?)
│   │   ├── .eslintrc.js
│   │   ├── FileUtils.js
│   │   ├── findMatchingFiles.js
│   │   ├── fs.js
│   │   ├── requireResolve.js
│   │   └── version.js
│   ├── normalizePath.js
│   ├── requireResolve.js
│   ├── rerouteConsoleLog.js
│   ├── resolveImportPathAndMain.js
│   ├── __tests__ (ignore outside test??? What tells us?)
│   │   ├── Configuration-test.js
│   │   ├── .eslintrc.js
│   │   ├── FileUtils-test.js
│   │   ├── findMatchingFiles-test.js
│   │   ├── Importer-test.js
│   │   ├── ImportStatements-test.js
│   │   ├── ImportStatement-test.js
│   │   ├── JsModule-test.js
│   │   ├── normalizePath-test.js
│   │   ├── requireResolve-test.js
│   │   └── resolveImportPathAndMain-test.js
│   ├── version.js
│   └── WatchmanFileCache.js
├── node_modules (bulk of files!)
│   ├── abab (not a direct dependency!)
│   │   ├── index.js
│   │   ├── lib
│   │   │   ├── atob.js
│   │   │   └── btoa.js
│   │   └── package.json (has no non-dev dependencies!)
|   ... many others
│   ├── xregexp (one of our direct dependencies)
│   │   ├── package.json
│   │   └── src
│   │       ├── addons
│   │       │   ├── build.js
│   │       │   ├── matchrecursive.js
│   │       │   ├── unicode-base.js
│   │       │   ├── unicode-blocks.js
│   │       │   ├── unicode-categories.js
│   │       │   ├── unicode-properties.js
│   │       │   └── unicode-scripts.js
│   │       ├── index.js (CJS main pointed to by package.json)
│   │       └── xregexp.js
├── package.json
```
###### '<project>/lib/EsModuleModule.js' analysis scope

If the file being edited was '<project>/lib/EsModuleModule.js', the desired
scope for its analysis would be
- lib/\*.js (~24 files, ES modules)
- lib/environments/\*.js (2 files, ES modules)
- node_modules/commander/index.js (CJS module)
- node_modules/eslint/lib/api.js (CJS module)
- node_modules/fb-watchman/index.js (CJS module) (import as fbWatchman)
- node_modules/glob/glob.js (CJS module)
- node_modules/lodash.escaperegexp/index.js (CJS module)
- node_modules/lodash.flattendeep/index.js (CJS module)
- node_modules/lodash.partition/index.js (CJS module)
- node_modules/lodash.sortby/index.js (CJS module)
- node_modules/lodash.uniqby/index.js (CJS module)
- node_modules/loglevel/loglevel.js (dual CJS/AMD module)
- node_modules/loglevel-message-prefix/lib/main.js (dual CJS/AMD module) (import as loglevelMessagePrefix)
- node_modules/minimatch/minimatch.js (CJS module)
- node_modules/semver/semver.js (CJS module)
- node_modules/StringScanner/lib/StringScanner.js (CJS module)
- node_modules/xregexp/src/index.js (CJS module)

The scope in this case could be mostly found by looking at package.json
dependencies combined with the exclusions that are found in .gitignore. The
missing piece is how to exclude 'lib/__mocks__/\*.js' and 'lib/__tests__/\*.js'.

Note that this definition of scope is vastly less than what is implied by the
Node CJS resolution algorithm! It is legal in Node to reference all of those
indirectly loaded dependencies in node_modules without listing them as
dependencies in package.json! So, if we use this more limited strategy, we are
being opinionated. We will not work with all code.

But the reduction in scope is so huge that it is likely the way we should go.

###### '<project>/lib/__tests__/Importer-test.js' analysis scope
Importer-test.js is meant to be used for testing. It's analysis scope should be
the above scope plus the following test related files.
- lib/\__tests__/\*.js
- lib/\__mocks__/\*.js
- node_modules/babel-cli/index.js (CJS module)
- node_modules/babel-eslint/index.js (CJS module)
- node_modules/babel-jest/build/index.js (CJS module)
- node_modules/babel-plugin-add-module-exports/lib/index.js (CJS module)
- node_modules/babel-plugin-transform-class-properties/lib/index.js (CJS module - transpiled from ES module)
- node_modules/babel-plugin-transform-flow-strip-types/lib/index.js (CJS module - transpiled from ES module)
- node_modules/babel-preset-es2015/index.js (CJS module)
- node_modules/deasync/index.js (CJS module)
- node_modules/eslint-config-airbnb-base/index.js (CJS module)
- node_modules/eslint-plugin-flow-vars/index.js (CJS module)
- node_modules/eslint-plugin-flowtype/index.js (CJS module)
- node_modules/eslint-plugin-import/lib/index.js (CJS module)
- node_modules/eslint-plugin-react/lib/index.js (CJS module)
- node_modules/flow-bin/index.js (CJS module)
- node_modules/jest-cli/build/jest.js (CJS module)
- node_modules/mkdirp/index.js (CJS module)
- node_modules/rimraf/rimraf.js (CJS module)

The node_modules dependencies come from the package.json devDependencies key. To
properly edit files in the \__tests__ and \__mocks__ directories we would need
something that tells us that they are of a different nature than those in the
lib/ and lib/environments/ directories and that that nature requires the
processing of devDependencies.

So, the .importjs.js file in the working directory needs to be able to describe
how to process files according to their full filename. It should be able to say
that files matching lib/\*.js and lib/environments/\*.js are processed with one
scope and files matching lib/\__tests__/\*.js and lib/\__mocks__/\*.js are
processed with another scope.

###### '<project>/node_modules/xregexp/src/index.js' analysis scope
If the file being edited was '<project>/node_modules/xregexp/src/index.js', the
desired scope for analysis is
- node_modules/xregexp/src/xregexp.js
- node_modules/xregexp/src/addons/\*.js

In this case, the package.json had no dependencies. But its presence alone
reduces the scope because it identifies the project directory above which we
don't need to rise. There is also no .gitignore to reduce the directories within
that project directory. But that's OK. There aren't any spurious directories to
eliminate.

This is an example of how the scope can vary widely within a working directory.
Yet, if we use the full Node algorithm, all of the parallel node_modules
directories would be considered. Again, the opinionated approach produces a huge
reduction in scope.

Note that another problem here is that there is unlikely to be a
node_modules/xregexp/.importjs.js file to guide us on settings. We know that
this is a node module though and should be able to reasonably default.

##### Some explorations of scopes in Meteor environments

The Meteor framework is rich in scopes and is thus especially valuable for
exploring the concept of what needs to be analyzed and how that might relate to
the file being edited.

A Meteor project directory is usually that of a Meteor application like this
contrived example:
```
meteorApp/
1├── .meteor
1│   ├── packages
1│   └── versions
1├── client
1│   └── main.js
1├── server
1│   └── main.js
1├── imports
1│   ├── api
1│   │   └── lists
1│   │       └── lists.js
1│   └── startup
1│       ├── client
1│       │   └── index.js
1│       └── server
1│           └── index.js
2├── packages
2│   └── meteorPackage
2│       ├── mainModule.js
2│       ├── node_modules
2│       │   └── npmPackage2
2│       │       └── package.json
2│       └── package.js
3├── package.json
3└── node_modules
3    └── npmPackage
3        ├── index.js
3        └── package.json
```
But not always. Sometimes it is the directory of a Meteor package that is under
development as in this contrived example:
```
meteorPkg2/
2├── package.js
2├── mainModule.js
3└── node_modules
3  └── npmPackage3
3       ├── index.js
3       └── package.json
```
In both of these cases multiple environments exist. To be more precise, within
the same editing session, JavaScript files may be edited from Meteor application
(denoted with a "1"), Meteor package ("2"), and/or npm ("3") environments. All
of these environments are at home coexisting under the Meteor umbrella.

Before going into the scopes found within the individual environments above,
there are a few special rules (derived from the ["Special Directories" section
in the Meteor
Guide](https://guide.meteor.com/structure.html#special-directories)) applicable
in both the Meteor application ("1") and Meteor package ("2") environments.
1. A module with a "client" directory at any point in its path may not import a module with a "server" directory at any point in its path and vice-versa.
2. A module with a "test" directory at any point in its path may not be imported by any module not in a test directory. It is for use by third party testing tools only.
3. A module within a "packages" directory is part of a "local package" and should be imported as a package rather than via its relative or absolute location.
4. No modules should ever be under a "public" directory. These are special locations for placing other assets like favicon.ico, etc. If those assets were referenced from a module, it would be as if they were at root. But this should never happen in an import statement. So, ignore the contents of "public" directories.
5. No modules should ever be under a "private" directory. These assets are only accessible from the server using a special interface.

There is also a caveat having to do with the definition of "core modules" within
Meteor. Meteor is an isomorphic environment. Modules may be run on the client,
the server, or both. In general, if the module is under a "client" directory, it
will only be loaded on the client. If it is under a "server" directory, it will
only be loaded on the server. If editing a file under a "server" directory, the
full set of Node core modules are available in addition to the Meteor core
modules. If editing a file under a "client" directory, the Node modules
available are limited by the capabilities of browserify. Modules not under a
"client" or "server" directory usually run on both and perhaps should be limited
to the "client" set of core modules.

###### Meteor case #1 analysis scope

If the user is editing a js file with a 1 in front of it in the above tree,
1. the core environment is meteor,
2. packages that may be imported are defined by .meteor/packages and the root package.json,
3. modules that may be imported are those with 1 in front of them, and
4. absolute references are relative to the application root (where .meteor/packages is located).

A reasonable scope of analysis in this case can be prepared with the following steps:
- define the appropriate meteor core modules
- process .meteor/packages and analyze all the package isopacks included to determine their interfaces
- process package.json and analyze all the package dependencies to determine the package interfaces
- analyze the appropriate local modules

Note that in no case did we try to analyze all packages available. Many more are
included indirectly. The idea is to both limit our overhead and encourage
developers to include all of their dependencies.

But, there is another point of view we could take here as a future enhancement.
We could add a capability to go deeper and suggest other Meteor packages or
node_modules that are present that could satisfy an unresolved reference, and
add the direct dependencies if they choose to accept our suggestion.


###### Meteor case #2 analysis scope

If the user is editing a js file with a 2 in front of it in the above tree,
1. the core environment is still meteor,
2. packages that may be imported are defined in package.js (including the npm dependencies),
3. modules that may be imported are those with a 2 in front of them, and
4. absolute references are relative to the package root (where package.js is located).

A reasonable scope of analysis in this case can be prepared with the following
steps:
- define the appropriate meteor core modules
- process package.js for "api.use" statements and analyze the Meteor packages they point to to determine their interfaces, and
- process package.js for "npm.depends" statements and analyze the npm packages they point to to determine their interfaces.
- analyze the appropriate local modules

###### Meteor case #3 analysis scope

If the user is editing a js file with a 3 in front of it, it is a standard
node/npm environment and meteor's packages and modules should not be available.
Analyze using the Node environments algorithms.

This is an interesting case of an environment using another environment.

### What data do we collect?

Each module's path and ExportedNames. [A good definition for
ExportedNames](https://tc39.github.io/ecma262/#sec-module-semantics-static-semantics-exportednames)
is
>ExportedNames are the externally visible names that a Module explicitly maps to
one of its local name bindings.

Another more explicit definition is expressed in the [pseudocode given by the
ES7 specification for
GetExportedNames](https://tc39.github.io/ecma262/#sec-getexportednames).

There has been question whether we should be tracking modules by path or
moduleName (formally known as "moduleSpecifier"). The answer may be both. There
are situations, especially in Node, where one module specifier might refer to
different files depending on where it is used.

For example:
```
.
├── appIndex.js
└── node_modules
    ├── a
    │   ├── b
    │   └── index.js
    └── b
```

In the tree above, the statement `import b from 'b';` will resolve to
"node_modules/b" if used in appIndex.js and "node_modules/a/b" if used in
node_modules/a/index.js.

It is likely that we will end up using a flyweight-like pattern in which there
is one module data pool that crosses realms like this and realm specific pools
that contain just the modules that are in the scope of that realm. The global
module data pool would need to be keyed by realpaths but the realm-specific data
pool might be keyed by a modified version of moduleNames in which local modules
are always relative to the project directory.

### ES modules

The ES7 specification defines two objects that provide a good start to defining
the information we need to collect about modules and how it might be organized -
the ["abstract module
record"](https://tc39.github.io/ecma262/#sec-abstract-module-records) and the
["source text module
record"](https://tc39.github.io/ecma262/#sec-source-text-module-records).

The abstract module record is useful more due to the organization suggestion
than its actual contents. Basically, it suggests that we have a class that
represents all module types and that each module type then be handled by a
concrete subclass of the abstract class. Our code finding exports to satisfy
unresolved variables and creating import statements from them should then be
able to be written to the abstract class interface isolating it from the many
"module" sources.

The abstract module record's content suggestions are more geared to execution.
The ones that appear of most use to us are "GetExportedNames(exportStarSet)" and
[[Namespace]].

The source text module record is much more interesting. Even though it is a
subclass, many of its components appear to be universally applicable and I
believe we can choose to have at least some of them in our abstract level
instead (note that I'm not seeing it as very abstract). Note that the WHATWG
loader specification cherry-picked some of these properties to move up to the
abstract module record's level too in its definition of [Reflective Module
Records](https://whatwg.github.io/loader/#reflective-module-record).

Basically, all fields in the source text module record definition except
[[ECMAScriptCode]] appear to be of interest. [Tables
39-42](https://tc39.github.io/ecma262/#table-38) nicely summarize these.

In addition, the operations defined in [15.2.1.16.1 ParseModule ( sourceText,
realm, hostDefined )](https://tc39.github.io/ecma262/#sec-parsemodule),
[15.2.1.16.2 GetExportedNames( exportStarSet ) Concrete
Method](https://tc39.github.io/ecma262/#sec-getexportednames), and
[15.2.1.17Runtime Semantics: HostResolveImportedModule (referencingModule,
specifier )](https://tc39.github.io/ecma262/#sec-hostresolveimportedmodule) are
very directly useful.

Note that there are two stage 1 proposals for adding functionality to export at
this time. Both should be easily implementable for us. Might as well go ahead
and add them. They are [export ns
from](https://github.com/leebyron/ecmascript-export-ns-from) and [export default
from](https://github.com/leebyron/ecmascript-export-default-from).


### Node's Implementation of ES modules

As the Node proposals stand today, it appears that we need to process modules as
ES modules first. If they parse and have at least one import or export
statement, we're done. If not, try parsing as a script. If all is good, consider
it a CJS module. See the Node ES Modules proposal [Section 5.1. Determining if
source is an ES
Module](https://github.com/nodejs/node-eps/blob/master/002-es6-modules.md#51-determining-if-source-is-an-es-module)
for more information.

### CommonJS

As of this point in time, it appears as though CJS modules should be treated as
if they export "default" only. See the "No Property Plucking" section in [this
discussion](https://github.com/nodejs/node-eps/issues/26#issuecomment-230572661).

Given that situation, we should default to allowing derivations of the package
or file name to be the expected variable name. Whatever algorithm we use for
matching this up can serve for ES modules that export defaults too.

The one question might be whether we try to at least detect the presence of an
assignment to module.exports or exports and not give it a "default" export if we
don't find one. That wouldn't bar it being imported for side-effects, but would
cause us not to resolve to it.

### npm

There are two possible points of view of an npm package that we must support -
the view from the inside and from the outside. If the module being edited is
inside an npm package, then we need to know that package's dependencies but care
nothing about its exports. If the module being edited is outside an npm package,
it would be nice to know its exports.

#### The current state of npm packages from the inside view

When determining what can be imported by a module within an npm package, we have
two big questions to answer - what packages are available for import, and what
local modules are available for import. The packages available for import are
defined in package.json. Simple.

The local modules available for import are not defined in package.json. You'd
think that you could just look for every .js file not in a node_modules
directory (and that is what we may have to do absent a local importjs
configuration). The problem with that approach is that many npm packages today
use babel or some other transpiler to convert ES6+ source code to ES5. Both the
true source and the transpiler's output are usually present in the project.
Distinguishing between the two to identify the true source may not be easy.

One possible strategy for handling this situation is to find the module that
Node would use as its entry point. That will be the ES5 entry point. It may be
possible then to follow all of the "require" statements and identify all ES5
files (there is a javascript file in Meteor's isobuild system, analyze-js.js,
that I believe does this). If there are then files left over, especially if the
one being edited is in the left over group, they are likely the true source
modules. If not, it is either a true ES5 package or a package that was deployed
without its ES6 source.

#### The current state of consuming npm packages

Regrettably, the npm system's package.json has absolutely no interface
specification. The closest to it is "main" which specifies the main entry point
for packages not using one of the recognizable default entry points.

As ES modules appear (it seems as though the majority of actively developed node
code I look at has already started using ES modules), the first instinct is to
use the "main" property's value or one of the default entry points as a starting
point for analysis in hopes that it points to an ES module. Wrong. Node doesn't
yet support ES modules so the entry point is for the transpiler output, not the
ES module source. Otherwise, the npm package would be incompatible.

Worse, in most cases, the ES6+ module source does still get packaged up and
distributed, but, since the source is of no value to execution, some popular
packages only distribute the ES5 transpiler output. To see the real code for
these modules, you have to go to github.

In general, the end effect of this is that the only thing that we can assume is
that the package has a default export (most of the time).

#### The future state of consuming npm packages

When the [Node proposal for ES Module
support](https://github.com/nodejs/node-eps/blob/master/002-es6-modules.md)
makes it into implementation, the "main" key in package.json will be able to
point to an ES module instead of the transpiled output. The transpiler will be
eliminated. This will enable static analysis to be successful, if and only if
the module is an ES module. There will be a mix for a long time though because
many environments that use npm packages can't use the latest Node. Meteor, for
example, didn't move past node 0.10.x until August 2016, years after other
versions came out.

#### Is there any way around this dismal state of affairs?

We've discussed creating our own external interface definition standard. We may
not have to.

The typescript community has already created a far more detailed interface
definition than what we need (we don't need types). Because the typescript
community consumes npm packages, there are typescript \*.d.js interface
definition files for most of the commonly used npm packages. It's overkill, but
we could create a capability to automatically query one of the typescript
interface definition repositories, download available interfaces, and process
them for their exports.

### Meteor packages

Meteor packages include some interface definition! Oddly, with the advent of ES
Module support, the ease of accessing this has decreased. Yet, it is still well
beyond npm.

Two different points of view have to be implemented for analyzing a Meteor
package - the view of a package under development and the view of a deployed
package.

The only time we need to understand a package under development (that has not
been deployed) is when our source module is in a package. Packages are developed
in two contexts, standalone and within a Meteor application. If developed
standalone, the working directory starts out looking like:
```
my-package
├── README.md
├── package.js
├── my-package-tests.js
└── my-package.js
```
The only required element of that directory is 'package.js'. This is the
defining element of a Meteor package. It is similar in purpose to package.json
in npm packages. Most important for our purpose, it declares the package
dependencies of the Meteor package.

If we encounter a package under development within a Meteor application, it will
look like:
```
my-meteor-application
...
├── packages
│   ├── README.md
│   ├── package.js
│   ├── my-package-tests.js
│   └── my-package.js
...
```
Again, package.js is the main file and defines both the meteor and npm package
dependencies.

The more common way to encounter a Meteor package is in its deployed form. The
current generation of Meteor packages are deployed in "isopacks".

Because a user would never be "developing" a deployed package's files, normally,
we will only be analyzing a deployed package to determine its interface. But, a
user may have used "goto" to visit a deployed package in the editor and might
desire to use "goto" from there to visit other modules. So, it is not impossible
to be required to process a deployed package from the internal point of view.

In a similar fashion to how packages.json leads us to npm package dependencies,
we are led to deployed Meteor packages by the contents of ".meteor/packages" if
the module we're processing is in a Meteor application or "package.js" if the
module we're processing is in a Meteor package. We should never search
~/.meteor/packages or .meteor/local/isopacks otherwise.

#### package.js

Below is a somewhat stripped example of a package.js file.
```
Package.describe({
  summary: "A user account system",
  version: "1.2.8"
});

Package.onUse(function (api) {
  api.use('underscore', ['client', 'server']);
  api.use('ecmascript', ['client', 'server']);
  api.use('ddp-rate-limiter');
  api.use('localstorage', 'client');
  api.use('tracker', 'client');
  api.use('check', 'server');

  api.use('oauth-encryption', 'server', {weak: true});

  // Though this "Accounts" symbol is the only official Package export for
  // the accounts-base package, modules that import accounts-base will
  // have access to anything added to the exports object of the main
  // module, including AccountsClient and AccountsServer (those symbols
  // just won't be automatically imported as "global" variables).
  api.export('Accounts');

  Npm.depends({
    moment: "2.8.3",
    async:"https://github.com/caolan/async/archive/71fa2638973dafd8761fa5457c472a312cc820fe.tar.gz"
  });

  // These main modules import all the other modules that comprise the
  // accounts-base package, and define exports that will be accessible to
  // modules that import the accounts-base package.
  api.mainModule('server_main.js', 'server');
  api.mainModule('client_main.js', 'client');
});

Package.onTest(function (api) {
  api.use([
    'accounts-base',
    'ecmascript',
    'tinytest',
    'random',
    'test-helpers',
    'oauth-encryption',
    'underscore',
    'ddp',
    'accounts-password'
  ]);

  api.mainModule('server_tests.js', 'server');
  api.mainModule('client_tests.js', 'client');
});
```

Important things to note here include:
- There are two main sections defined by Package.onUse() and Package.onTest(). The onUse is defining normal usage and the onTest call is defining test only usage. Note that the onTest function api.uses 'accounts-base' which is in fact this package.
- The api.use calls are the equivalent of npm's dependencies. The first parameter is the dependency and the second is the build target that has the dependency. If the build target is omitted, then all build target's get that dependency.
- The api.export call is the old means of declaring the interface. Multiple calls can be made. Each thing exported can be imported using a named import.
- The api.mainModule is the new means of declaring the interface. Note that each build target can have its own interface. Since it is just defining a module, we have to then go statically analyze that module to actually find the exports. It should be an ES module.
- Npm.depends lists the npm dependencies. package.json is not used. An npm-shrinkwrap.json will be created after analyzing both the direct and implied requirements of the Npm.depends.

In general, when we access this file it will be because the file being edited is
within this package. We won't be looking for this package's interface and thus
won't care about the api.export and api.mainModule calls. We'll be interested in
api.use and Npm.depends as these denote the packages that the modules within
this package may import. There is also an api.imply call that declares that a
certain package should be assumed to be available for import.

For more information on package.js, see
- The Meteor Guide entry [Writing Atmosphere Packages](https://guide.meteor.com/writing-atmosphere-packages.html)
- The Meteor API Docs entry for [package.js](http://docs.meteor.com/api/packagejs.html).
- The source code implementing packageAPI is at https://github.com/meteor/meteor/blob/devel/tools/isobuild/package-api.js

#### isopack.json

Meteor deploys packages in the form of "isopacks". Meteor is isomorphic meaning
that an app is designed to execute in multiple environments that may all have
the exact same code but likely have a mix of shared code and environment
specific code. An "isopack" is designed to package multiple builds, one for each
targeted environment. The individual builds are called "unibuilds". Unibuilds
are in a state that is gathered by targeted environment but not yet transpiled.
So, ES7 is still ES7.

A typical isopack looks like:
```
my-packages-isopack
├── isopack.json
├── os.json
├── os
│   ├── <source files for os target>
│   ├── ...
│   └── ...
├── web.browser.json
├── web.browser
│   ├── <source files for web client target>
│   ├── ...
│   └── ...
├── web.cordova.json
└── web.cordova
│   ├── <source files for iPhone app target>
│   ├── ...
│   └── ...
└── npm
    └── node_modules
        ├── .npm-shrinkwrap.json
        ├── <npm package>
        ├── ...
        └── <npm package>
```

The isopack.json file contains a bit of metadata and a directory of unibuilds.
The important aspects of each unibuild record are the targeted architecture and
the path. For the "os" build above, the targeted architecture is "os" and the
path is "os.json".

Each unibuild has its own equivalent to an npm package's "package.json" file, in
the above case, these are "os.json", "web.browser.json", and "web.cordova.json".

The fact that there are multiple unibuilds for different build targets is a
problem for us. Each can have its own interface. It is not unusual for the "os"
unibuild (which corresponds to the "server" in most applications) and the
"web.browser" unibuild (which is the most common "client") to have different
interfaces. But, when analyzing application code, it isn't always easy to
determine which modules are client and which are server. We will likely have to
compromise with an approach of using the "os" interface for modules that are
definitely server, the union of all client interfaces for modules that are
definitely client, and the union of all interfaces for modules that are possibly
both client and server.

The interesting contents of a build target's .json file look like:
```
{
  "format": "isopack-2-unibuild",
  "declaredExports": [
    {
      "name": "Babel",
      "testOnly": false
    },
    {
      "name": "BabelCompiler",
      "testOnly": false
    }
  ],
  "uses": [
    {
      "package": "meteor"
    },
    {
      "package": "ecmascript-runtime",
    },
    {
      "package": "npm-bcrypt",
      "constraint": "0.9.0"
    }
  ],
  "node_modules": "npm/node_modules",
  "resources": [
    {
      "type": "source",
      "extension": "js",
      "file": "os/babel.js",
      "length": 883,
      "offset": 0,
      "usesDefaultSourceProcessor": true,
      "path": "babel.js",
      "hash": "5c85824a99e73d18dbe2161a53d7024a1b6faa14",
      "fileOptions": {}
    },
    {
      "type": "source",
      "extension": "js",
      "file": "os/babel-compiler.js",
      "length": 9397,
      "offset": 0,
      "usesDefaultSourceProcessor": true,
      "path": "babel-compiler.js",
      "hash": "aa14ade9115a110cb67e1b871529ca724b56000f",
      "fileOptions": {}
    }
  ]
}
```
In this, the "declaredExports" are created from the package.js api.exports
calls. They represent the pre ES modules method for defining a Meteor package's
interface. They are valid targets for namedImports.

The "resources" section defines the unibuild's source files. The "file" property
states where the file is located in the isopack. The "path" property gives the
original path to the file relative to the package's root. This is important in
mapping back to original moduleNames. i.e. the source files above are now in an
"os" directory as indicated by the "file" properties, but were originally
located in the package root.

Also in the "resources" section, if the fileOptions include "mainModule: true"
then that file is an ES module that is the entry point for this unibuild. This
is where the new interface definition kicks off. There will only be one
"mainModule" in any unibuild and that module can be statically analyzed as an ES
module to determine the package's interface for builds with that target.

It is during that static analysis that the other elements of the unibuild's
.json file come into play. An ES module can re-export interfaces from other
packages without specifying them using the `export * from 'somePackage';`
syntax. The only way to then no what is being exported is to analyze that other
package. The "uses" section of the unibuild's .json file gives us a source for
the version "constraint" of each Meteor package used. This is critical to
finding its isopack. The "node_modules" property points to the location within
the isopack of the Node modules that the package depends on. This directory
contains a .npm-shrinkwrap.json file that includes both the direct and indirect
dependencies. There is no source for the original direct dependencies as
specified by npm.depends() statements in the package.js, but that is OK. We
don't need to know them because we aren't supporting true development within the
isopack.

For more information on Meteor isopacks, see
- The Meteor Guide entry [Writing Atmosphere Packages](https://guide.meteor.com/writing-atmosphere-packages.html)
- The README for the isobuild tool https://github.com/meteor/meteor/tree/devel/tools/isobuild (and the source code within the tool)
