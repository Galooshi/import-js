export default {
  // As listed in https://github.com/nodejs/node/tree/master/lib
  //
  // Note that we do not include `process` in this list because that is
  // available globally in node environments and will cause the following error
  // if imported:
  //
  //   Error: Cannot find module 'process' from 'Foo.js'
  coreModules: [
    'assert',
    'buffer',
    'child_process',
    'cluster',
    'console',
    'constants',
    'crypto',
    'dgram',
    'dns',
    'domain',
    'events',
    'fs',
    'http',
    'https',
    'module',
    'net',
    'os',
    'path',
    'punycode',
    'querystring',
    'readline',
    'repl',
    'stream',
    'string_decoder',
    'sys',
    'timers',
    'tls',
    'tty',
    'url',
    'util',
    'v8',
    'vm',
    'zlib',
  ],
};
