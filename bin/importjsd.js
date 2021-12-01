#!/usr/bin/env node

// The `importjsd` command is deprecated and will be removed in a future
// version. `importjs` should be used instead.
// eslint-disable-next-line import/no-unresolved
const importjs = require('../build/importjs').default;

importjs(process.argv);
