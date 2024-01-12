#!/usr/bin/env node

// eslint-disable-next-line import/no-unresolved, import/extensions
const importjs = require('../build/importjs').default;

importjs(process.argv);
