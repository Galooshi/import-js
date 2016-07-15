import fs from 'fs';
import path from 'path';

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
  const packages = fs.readFileSync(meteorPackagesPath, 'utf8')
    // extract an array of package names from the packages file
    .match(/^\s*([^# @\n]+)/gm)
    // add 'meteor/' to the start of each name per Meteor convention
    .map((pkg: string) => `meteor/${pkg}`)
    // eliminate those packages that are considered to be core
    .filter((pkg: string) => !coreModules.includes(pkg));
  return packages;
}

export default {
  coreModules,

  namedExports: {
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
  },

  packageDependencies: ({ config }: Object): Array<String> =>
    meteorPackageDependencies({ config })
      // add NPM packages to the list
      .concat(findPackageDependencies(
        config.workingDirectory,
        config.get('importDevDependencies'))),
};
