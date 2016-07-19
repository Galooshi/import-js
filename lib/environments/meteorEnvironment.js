// @flow

import fs from 'fs';
import os from 'os';
import path from 'path';

import FileUtils from '../FileUtils';

import findPackageDependencies from '../findPackageDependencies';

const coreModules = [
  'meteor/accounts-base',
  'meteor/blaze',
  'meteor/check',
  'meteor/ddp-client',
  'meteor/ddp-rate-limiter',
  'meteor/ejson',
  'meteor/email',
  'meteor/http',
  'meteor/check',
  'meteor/meteor',
  'meteor/mongo',
  'meteor/random',
  'meteor/reactive-var',
  'meteor/session',
  'meteor/templating',
  'meteor/tracker',
];

const coreNamedExports = {
  'meteor/accounts-base': ['AccountsClient', 'Accounts', 'AccountsServer'],
  'meteor/blaze': ['Blaze'],
  'meteor/check': ['check', 'Match'],
  'meteor/ddp-client': ['DDP'],
  'meteor/ddp-rate-limiter': ['DDPRateLimiter'],
  'meteor/ejson': ['EJSON'],
  'meteor/email': ['Email'],
  'meteor/http': ['HTTP'],
  'meteor/meteor': ['Meteor'],
  'meteor/mongo': ['Mongo'],
  'meteor/random': ['Random'],
  'meteor/reactive-var': ['ReactiveVar'],
  'meteor/session': ['Session'],
  'meteor/templating': ['Template'],
  'meteor/tracker': ['Tracker'],
};

function meteorPackageDependencies(
  { config }: Object
): Array<string> {
  const meteorPackagesPath = path.join(config.workingDirectory, '.meteor/packages');
  if (!fs.existsSync(meteorPackagesPath)) {
    return [];
  }
  // Meteor is an "app" framework. As such, it has both apps and packages. When working with a
  // module that is part of an app, the list of Meteor packages that a module may import is found in
  // '.meteor/packages'. This file is actually called a ProjectConstraintsFile in the meteor code.
  // The internal meteor routine that parses it may be found at
  // https://github.com/meteor/meteor/blob/f8b1bba606678303ea4e82b8da7c8ae0683b0b7c/tools/project-context.js#L841.
  // After reverse engineering ProjectConstraintsFile.prototype._readfile at that location, the
  // following appears to be the pertinent facts for any parser.
  //  - the only true information within the file is a list of constraints
  //  - a constraint may not span a line
  //  - only one constraint may appear on a line
  //  - a constraint consists of a package name and an optional version constraint separated by
  //    the '@' symbol
  //  - white space may not appear within a constraint
  //  - the '#' symbol signifies that the rest of the line is a comment
  //  - all white space is ignored
  //  - package names
  //      - are allowed to contain [a-z0-9:.\-]
  //      - must have at least one lowercase letter
  //      - may not begin or end with a dot or colon
  //      - may not begin with a hyphen
  //      - may not contain two consecutive dots
  //
  // This routine is only interested in extracting the package names and has no concern for
  // precisely validating them. An assumption is made that the file is basically valid.
  // Thus, they may be extracted with a simple global, multiline match of characters allowed
  // to be in a package name that are at the beginning of a line, possibly following white space.
  const packages: Array<string> = (fs.readFileSync(meteorPackagesPath, 'utf8')
    // extract an array of package names (possibly with preceding whitespace) from the packages file
    .match(/^\s*[a-z0-9:.\-]+/gm) || [])
    // add 'meteor/' to the start of each name per Meteor convention
    .map((pkg: string): string => `meteor/${pkg.trimLeft()}`)
    // eliminate those packages that are considered to be core
    .filter((pkg: string): boolean => coreModules.indexOf(pkg) === -1);
  return packages;
}

function meteorPackageNamedExports({ config }: Object): Object {
  // This function seeks to extract the named exports from all non-core, 3rd party or local meteor
  // packages being utilized in the application. The meteorPackageDependencies function identifies
  // that list of packages.
  //
  // Meteor packages are deployed as "isopacks". These can usually be found within the meteor
  // warehouse directory on the system at ~/.meteor/packages. isopacks for local Meteor packages,
  // i.e. those whose source is in the <project-root>/packages directory, can usually be found in
  // at <project-root>/.meteor/local/isopacks.
  //
  // These isopacks do not exactly contain the original package source. In particular, they are
  // always missing a "package.js" file. This is important to us because it is the one that
  // specifies the interface. They do however contain build products that resulted from that
  // specification.
  //
  // Meteor is an isomorphic environment. An isopack contains multiple builds, one for each
  // targeted platform. Typically, this will include at least a client and a server build.  An
  // isopack contains an isopack.json file that details which platforms are represented and
  // leads us to other platform specific isopack.json files that contain the interface details
  // needed by this routine.
  //
  // This routine will find all interfaces from all build platforms and create namedExport
  // entries for them.
  //
  // So, for example, if a project includes version 1.5.3 of package "aldeed:simple-schema", the
  // isopack for that package will usually be located at
  //    ~/.meteor/packages/aldeed_simple-schema/1.5.3/
  // Within that directory, we will find the following important files
  //
  //    isopack.json
  //    os.json
  //    web.browser.json
  //    web.cordova.json
  //
  // isopack.json will point us to the others which all represent specific platforms.
  //
  // There are two ways that meteor packages expose their exported interface, pre-ES6 and post-ES6.
  //
  // The pre-ES6 modules method is to call api.exports within the package.js file for each variable
  // exported. These calls all result in declaredExports entries in the individual platform's json
  // files. Within aldeed:simple-schema's web.browser.json for example, we find
  //
  //  "declaredExports": [
  //      {
  //        "name": "SimpleSchema",
  //        "testOnly": false
  //      },
  //      {
  //        "name": "MongoObject",
  //        "testOnly": false
  //      },
  //      {
  //        "name": "humanize",
  //        "testOnly": true
  //      }
  //    ],
  //
  // From this, we can determine that the namedExports entry should be
  //
  //   'aldeed:simple-schema': ['SimpleSchema', 'MongoObject']
  //
  // "humanize" was left off because it is testOnly. We may try to get smarter and include that for
  // some modules in the future.
  //
  // Post-ES6 modules, things become a bit more difficult. The package.js file in a post-ES6 world
  // specifies a mainModule. Each build will have no more than one mainModule and they may be
  // different. The mainModule's are denoted in the same build json files that we process to find
  // the pre-ES6 declaredExports. They are in the resources section which looks like
  //
  //   "resources": [
  //       {
  //         "type": "source",
  //         "extension": "js",
  //         "file": "web.browser/client_main.js",
  //         "length": 752,
  //         "offset": 0,
  //         "path": "client_main.js",
  //         "hash": "cf1eeaf24f21f7755a7cb3fe1e247d56b5e97acf",
  //         "fileOptions": {
  //           "mainModule": true
  //         }
  //       },
  //
  // We are interested only in the one resource that has fileOptions.mainModule = true.
  //
  // The exports are defined by the export statements in the build's mainModule file,
  // "web.browser/client_main.js" in the above example. So, we'll have to parse the file and
  // identify the exports. If the file uses ES6 module export syntax, we should be able to
  // achieve this. If its using CommonJS, we may have to punt and let the user define their
  // own namedExports for that package.

  // Retrieve the package versions for all meteor packages used by the application.
  // .meteor/versions is a simple file in which each line has the syntax
  //    <pkgname>@<version>
  // We'll extract them into a Map of versions keyed by package names.
  const meteorVersionsPath = path.join(config.workingDirectory, '.meteor/versions');
  if (!fs.existsSync(meteorVersionsPath)) {
    // If we're even in an application directory, it must be broken. In any case, we can't
    // find the packages without their versions.
    return {};
  }
  const pkgVersions = new Map();
  const pkgVersionPairs: Array<string> = fs.readFileSync(meteorVersionsPath, 'utf8')
    .match(/^[^@\s]+@[^\s]+$/gm) || [];
  for (const pkgVersionPair of pkgVersionPairs) {
    const [pkg, version] = pkgVersionPair.split('@');
    pkgVersions.set(pkg, version);
  }

  // Try to identify the exports of all packages identified by meteorPackageDependencies
  const namedExports = {};
  const meteorPackagesDir = path.join(os.homedir(), '.meteor/packages');
  for (const meteorPkg of meteorPackageDependencies({ config })) {
    // The isopack's are usually found at
    //   ~/.meteor/packages/<pkg>/<pkgVersion>
    // where pkg is the meteorPkg without the 'meteor/' prefix and colons replaced with
    //       underlines.

    // Strip 'meteor/' off the front of the meteorPkg
    const pkg = meteorPkg.slice(7);
    const pkgVersion = pkgVersions.get(pkg) || '';
    let isopackRoot = path.join(meteorPackagesDir, pkg.replace(':', '_'), pkgVersion);
    let isopackPath = path.join(isopackRoot, 'isopack.json');
    let isopack = FileUtils.readJsonFile(isopackPath);
    if (!isopack) {
      // It is possible that this is a local package as opposed to a 3rd party package. If so, it's
      // isopack may be in <project-root>/.meteor/isopacks/<pkg>.
      isopackRoot = path.join(
        config.workingDirectory, '.meteor', 'local', 'isopacks', pkg.replace(':', '_'));
      isopackPath = path.join(isopackRoot, 'isopack.json');
      isopack = FileUtils.readJsonFile(isopackPath);
      if (!isopack) {
        // Can't get anywhere without the main isopack.json. Go to the next package.
        continue;
      }
    }

    // isopack.json often contains separate sections for every version of the isopacks that
    // has ever been made available. We're only interested in isopack-2 or isopack-1 at this
    // time. Prefer the newer isopack-2 specification if available
    const isopackVer = isopack['isopack-2'] || isopack['isopack-1'];
    if (!isopackVer || !isopackVer.builds) {
      // If we didn't find an isopack version we understand or documented builds within it,
      // we're done. Go to the next package.
      continue;
    }
    // We can't guess which build the current module is being included in. So, we'll find all
    // declaredExports from all builds and combine them into one namedExports specification.
    const declaredExports: Array<string> = [];
    for (const build of isopackVer.builds) {
      const buildIsopackPath = path.join(isopackRoot, build.path);
      const buildIsopack = FileUtils.readJsonFile(buildIsopackPath);
      if (!buildIsopack) {
        // Something is wrong with this build. Try the next one.
        continue;
      }
      if (!buildIsopack || !buildIsopack.declaredExports) {
        // Either this build is missing or it has no declaredExports. Try the next one.
        continue;
      }
      for (const declaredExport of buildIsopack.declaredExports) {
        // If this declaredExport is not a "testOnly" export and is not already amongst those we've
        // gathered, push it into our collection.
        if (!declaredExport.testOnly && declaredExports.indexOf(declaredExport.name) === -1) {
          declaredExports.push(declaredExport.name);
        }
      }

      // TODO: If the "resources" section of the buildIsopack specifies a mainModule, we need to
      // attempt to scan it to find exports.
    }
    // If we found declared exports, create a namedExports entry for them.
    if (declaredExports.length) {
      namedExports[`meteor/${pkg}`] = declaredExports;
    }
  }
  return namedExports;
}

export default {
  coreModules,

  moduleNameFormatter: ({ moduleName, pathToImportedModule }: Object): string => {
    // If the module being imported is a Meteor package, it will begin with 'meteor/' and should
    // not be altered.
    if (moduleName.startsWith('meteor/')) {
      return moduleName;
    }
    // If the module being imported is an npm package, the path to the module will start with
    // 'node_modules/' and the moduleName should not be altered.
    // not be altered.
    if (pathToImportedModule.startsWith('node_modules/')) {
      return moduleName;
    }
    // If the moduleName does not start with a '.', then import-js is trying to reference it via
    // an absolute path. In this case, Meteor wants it to start with a '/' and will interpret it
    // as relative to the project directory root.
    if (!moduleName.startsWith('.')) {
      return `/${moduleName}`;
    }
    // Otherwise, return the moduleName unchanged.
    return moduleName;
  },

  namedExports: ({ config }: Object): Object => {
    const allNamedExports = coreNamedExports;
    // There are no worries about this overwriting the definitions of core
    // namedExports. meteorPackageNamedExports skips core packages. Even if
    // it did not, it would presumably find correct definitions.
    Object.assign(allNamedExports, meteorPackageNamedExports({ config }));
    return allNamedExports;
  },

  packageDependencies: ({ config }: Object): Array<string> =>
    meteorPackageDependencies({ config })
      // add NPM packages to the list
      .concat(findPackageDependencies(
        config.workingDirectory,
        config.get('importDevDependencies'))),
};
