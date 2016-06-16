#!/usr/bin/env node

/* eslint-disable strict */

'use strict';

// This is hacky, but necessary to make eslint find plugins local to the files
// being linted. Without it, you'll get an error message of the following kind:
//
//   Error: Cannot find module 'eslint-config-brigade'
//
// This is because eslint will look for modules relative to where it installed.
// The eslint we are using is local to import-js, so any plugin referenced for
// the file we are linting will have to be looked up relative to that file.
//
// Technique from http://stackoverflow.com/questions/11969175
const oldPath = process.env.NODE_PATH;
process.env.NODE_PATH = `${oldPath || ''}:${process.cwd()}/node_modules/`;
require('module').Module._initPaths(); // eslint-disable-line no-underscore-dangle

require('../build/importjs.js')(process.argv);
