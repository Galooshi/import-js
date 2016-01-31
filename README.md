[![Build Status](https://travis-ci.org/trotzig/import-js.svg?branch=master)](https://travis-ci.org/trotzig/import-js)
[![Gem Version](https://badge.fury.io/rb/import_js.svg)](https://badge.fury.io/rb/import_js)
[![MELPA](http://melpa.org/packages/import-js-badge.svg)](http://melpa.org/#/import-js)

# Introduction

`import-js` is a tool to automatically import dependencies in your JavaScript
project. Use it in Vim, Emacs, or Sublime by placing your cursor on a variable
and hit `<leader>j` (Vim), or `(M-x) import-js-import` (Emacs), or select
"ImportJS: import word under cursor" from the Command Palette (Sublime).

![Demo of import-js in action](https://raw.github.com/trotzig/import-js/master/import-js-demo.gif)

## Editor support

import-js comes with plugins for the following editors:

- [Emacs](EMACS.md) (Thanks to
  [@kevinkehl](https://github.com/kevinkehl)!)
- [Vim](VIM.md)
- [Sublime](SUBLIME.md) (Thanks to
  [@janpaul123](https://github.com/janpaul123))
- [(your editor here?)](CONTRIBUTING.md)

Detailed instructions on how to install import-js can be found in the editor
links above.

*Want to add another editor to the list?* [See how to
contribute](CONTRIBUTING.md).

## Importing: Example

To demonstrate what import-js can do, let's use an example. Let's say that you
have a JavaScript project with the following setup:

```
.
|-- index.html
|-- components
|     |-- button.js
|     |-- icon.js
|-- vendor
|     |--
|-- pages
|     |-- index.js
```

Let's pretend that you're editing `pages/index.js` that currently looks like
this:

```js
document.createElement(new Button({ text: 'Save' }).toDOMElement());
```

At this point, `Button` is undefined. We need to import it. If you are used to
doing this manually, this involves figuring out the path to the JavaScript
module that defines `Button`. With import-js, you instead place your cursor on
the word "Button", then hit `<leader>j` (Vim), `(M-x) import-js-import`
(Emacs), or choose "ImportJS: import word under cursor" (Sublime). The file
buffer will now change to the following:

```js
import Button from 'components/button';

document.createElement(new Button({ text: 'Save' }).toDOMElement());
```

That's basically it. Import-js will help you find modules and automatically add
an `import` statement. But keep reading for some more neat features.

## Fix imports

If you have [eslint](http://eslint.org/) installed, import-js can be used to
automatically fix all imports. By hiting `<leader>i` (Vim), `(M-x)
import-js-fix` (Emacs), or choose `ImportJS: fix all imports` (Sublime), all
your undefined variables will be resolved, and all your unused imports will be
removed. By default, import-js expects a global `eslint` command to be
available, but you can change that with the [`eslint_executable` configuration
option](#eslint_executable).

If you're using React, import-js will automatically import `React` for you, but
only if you have
[eslint-plugin-react](https://github.com/yannickcr/eslint-plugin-react)
installed and the
[`react-in-jsx-scope`](https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/react-in-jsx-scope.md)
rule enabled in your `.eslintrc` configuration file.

## Experimental: Go to module

Since import-js is pretty good at finding JS modules, it makes sense that
there's an option to open/go to a file rather than import it. This is similar
to VIM's built in ["Open file under
cursor"](http://vim.wikia.com/wiki/Open_file_under_cursor). Use it by placing
the cursor on a variable and hit `<leader>g` (Vim), `(M-x) import-js-goto`
(Emacs), or choose "ImportJS: goto module" (Sublime).

## Things to note

- Only files ending in .js\* are considered when importing
- As part of resolving imports, all imports will be sorted
- The core of the plugin is written in Ruby. If you are using Vim, you need a
  [Vim with Ruby support](VIM.md).

## Configuration

Create a file called `.importjs.json` in the root folder of your project to
configure import-js. The following configuration options can be used.

### `lookup_paths`

Configure where import-js should look to resolve imports. If you are using
Webpack, these should match the `modulesDirectories` configuration. Example:

```json
"lookup_paths": [
  "app/assets/javascripts",
  "react-components"
]
```

*Tip:* Don't put `node_modules` here. import-js will find your Node
dependencies through your `package.json` file.

### `eslint_executable`

By default, import-js will call out to the globally installed `eslint` command
when fixing imports. If you are using ESLint in your project and have a local
`.eslintrc` file, you may want import-js to use the locally installed `eslint`
instead. This is especially useful if your `.eslintrc` includes dependencies on
other `eslint-*` packages such as shared configurations, plugins, or parsers.

To configure this to use the locally installed `eslint`, set the
`eslint_executable` configuration. Example:

```json
"eslint_executable": "node_modules/.bin/eslint"
```

### `excludes`

Define a list of glob patterns that match files and directories that you don't
want to include for importing.

```json
"excludes": [
  "react-components/**/test/**"
]
```

### `aliases`

Some variable names might not easily map to a file in the filesystem. For
those, you can add them to the `aliases` configuration.

```json
"aliases": {
  "$": "third-party-libs/jquery",
  "_": "third-party-libs/underscore"
}
```

Aliases can be made dynamic by using the `{filename}` string. This part of the
alias will be replaced by the name of the file you are currently editing.

e.g.

```json
"aliases": {
  "styles": "./{filename}.scss"
}
```

will for a file `foo/bar.js` result in

```javascript
import styles from './bar.scss';
```


### `named_exports`

If you have a ES2015 module that exports multiple things (named exports), or a
CommonJS module that exports an object with properties on it that you want to
destructure when importing, you can add those to a `named_exports` configuration
option.

```json
"named_exports": {
  "underscore": [
    "omit",
    "debounce"
  ],
  "lib/utils": [
    "escape",
    "hasKey"
  ]
}
```

Imports that use the `import` declaration keyword then use [named imports syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import),
e.g.

```javascript
import { memoize } from 'underscore';

memoize(() => { foo() });
```

and imports that use `const` or `var` use [ES2015 Destructuring
Assigment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment),
e.g.

```javascript
const { memoize } = require('underscore');

memoize(() => { foo() });
```

The key used to describe the named exports should be a valid import path. This
can be e.g. the name of a package found under `node_modules`, a path to a
module you created yourself without the `lookup_path` prefix, or a relative
import path.

### `declaration_keyword`

The default value for this property is `import`, making your import statements
use the [ES2015 modules
syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import):

```js
import Foo from 'foo';
```

If you aren't ready for ES2015 yet, you have the option to use `var` or `const`
instead.

```json
"declaration_keyword": "const"
```

In such case, your import statements will look something like this:

```js
var Foo = require('foo'); // "declaration_keyword": "var"
const Foo = require('foo'); // "declaration_keyword": "const"
```

### `import_dev_dependencies`

Import-js will look for package dependencies listed in `package.json` when
importing. By default, only modules listed under `dependencies` and
`peerDependencies` will be used. By setting `import_dev_dependencies` to
`true`, `devDependencies` will also be taken into account.

```json
"import_dev_dependencies": true
```

### `import_function`

*Note: this only applies if you are using `var` or `const` as
`declaration_keyword`.*

The default value for this configuration option is `"require"`, which is [the
standard CommonJS function name used for
importing](http://wiki.commonjs.org/wiki/Modules/1.1).

```json
"import_function": "myCustomRequireFunction"
```

### `strip_from_path`

This option is used to trim imports by removing a slice of the path. The main
rationale for using this option is if you have a custom `import_function` that
has different logic than the default `require` and `import from` behavior.

```json
"strip_from_path": "app/assets/",
"import_function": "requireFromAppAssets"
```

### `strip_file_extensions`

An array that controls what file extensions are stripped out from the resulting
import statement. The default configuration strips out `[".js", ".jsx"]`.
Set to an empty array `[]` to avoid stripping out extensions.

```json
"strip_file_extensions": [".web.js", ".js"]
```

### `use_relative_paths`

This option is disabled by default. By enabling it, imports will be resolved
relative to the current file being edited.

```js
import Foo from './foo';
import Bar from '../baz/bar';
```

Only imports located in the same `lookup_path` will be made relative to each
other. Package dependencies (located in `node_modules`) will not be imported
relatively.

```json
"use_relative_paths": true
```

### `ignore_package_prefixes`

If you have package dependencies speficied in `package.json` that are prefixed
with e.g. an organization name but want to be able to import these without the
package prefix, you can set the `ignore_package_prefixes` configuration option.

```json
"ignore_package_prefixes": ["my-company-"]
```

When package dependencies are matched, these prefixes will be ignored. As an
example, a variable named `validator` would match a package named
`my-company-validator`.

### `minium_version`

Setting `minimum_version` will warn people who are running a version of
Import-JS that is older than what your `.importjs.json` configuration file
requires. If your plugin version is older than this value, you will be shown a
warning that encourages you to upgrade your plugin.

```json
"minimum_version": "0.4.0"
```

## Local configuration

You can dynamically apply configuration to different directory trees within
your project by turning the `.importjs.json` file into an array of
configuration objects. Each configuration specifies what part of the tree it
applies to through the `applies_to` and `applies_from` options.

```json
[
  {
    "applies_to": "app/**",
    "declaration_keyword": "import",
    "use_relative_paths": true
  },
  {
    "applies_to": "app/**",
    "declaration_keyword": "const"
  },
  {
    "applies_from": "tests/**",
    "applies_to": "app/**",
    "declaration_keyword": "var",
    "import_function": "mockRequire",
    "use_relative_paths": false
  },
]
```

Use glob patterns supported by [Ruby's `File.fnmatch`
method](http://ruby-doc.org/core-2.3.0/File.html#method-c-fnmatch) for the
`applies_to` and `applies_from` values. If any of the patterns are omitted, the
default catch-all pattern (`*`) is used. The difference between the two
patterns is that `applies_to` is matched with the file you are currently
editing (relative to the project root). The `applies_from` pattern is matched
with the file you are currently importing (also relative to the project root)
will be used when matching.

Put more specific configuration at the bottom of the configuration file and the
default, catch-all configuration at the top.

When using `applies_from` only a subset of configurations are supported:

- `declaration_keyword`
- `import_function`
- `strip_file_extensions`
- `strip_from_path`
- `use_relative_paths`

## Contributing

See the
[CONTRIBUTING.md](https://github.com/trotzig/import-js/blob/master/CONTRIBUTING.md)
document for tips on how to run, test and develop import-js locally.

Happy hacking!
