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
available.

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

If you have a library that expose a single object that has a bunch of objects
on it that you want to use, you can list those in a `destructure` array inside
the alias (which then has to be turned into an object):

```json
"aliases": {
  "$": "third-party-libs/jquery",
  "_": {
    "path": "third-party-libs/underscore",
    "destructure": ["memoize", "debounce"]
  }
}
```

Imports then use [ES6 Destructuring Assigment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment),
e.g.

```javascript
const { memoize } = require('underscore');

memoize(() => { foo() });
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

### `declaration_keyword`

The default value for this property is `import`, making your import statements
use the [ES2015 modules
syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import):

```js
import Foo from 'foo';
```

If you aren't ready for ES2015 yet, you have the option to use `var`, `let`, or
`const` instead.

```json
"declaration_keyword": "const"
```

In such case, your import statements will look something like this:

```js
var Foo = require('foo'); // "declaration_keyword": "var"
let Foo = require('foo'); // "declaration_keyword": "let"
const Foo = require('foo'); // "declaration_keyword": "const"
```

### `import_function`

*Note: this only applies if you are using `var`, `let`, or `const` as
`declaration_keyword`.*

The default value for this configuration option is `"require"`, which is [the
standard CommonJS function name used for
importing](http://wiki.commonjs.org/wiki/Modules/1.1).

```json
"import_function": "myCustomRequireFunction"
```

### `strip_file_extensions`

An array that controls what file extensions are stripped out from the resulting
`require` statement. The default configuration strips out `[".js", ".jsx"]`.
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

## Local configuration

If different directory trees within your project have different importing
needs, local configuration can come in handy. One way to add local
configuration is by creating an `.importjs.json` file in a folder descending
from the project root.  When configuration is resolved, import-js will walk up
the directory tree, merging configuration as it's discovered.

You can also apply configuration selectively by turning the configuration file
into an array of configurations, each with a corresponding `applies_to` glob
pattern.

```json
[
  {
    "applies_to": "app/**",
    "declaration_keyword": "const"
  },
  {
    "applies_from": "tests/**",
    "declaration_keyword": "var"
  },
  {
    "declaration_keyword": "import"
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

When using `applies_from` only a subset of configurations are supported:

- `declaration_keyword`
- `import_function`

The first matching configuration containing the configuration key will be used.
It is therefore a good idea to put a catch-all configuration at the bottom
(like in the example above).

## Contributing

See the
[CONTRIBUTING.md](https://github.com/trotzig/import-js/blob/master/CONTRIBUTING.md)
document for tips on how to run, test and develop import-js locally.

Happy hacking!
