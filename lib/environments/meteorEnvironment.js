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
