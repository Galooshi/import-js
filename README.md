# Introduction

`import-js` is a vim plugin that simplifies your CommonJS project by
automatically resolving variables in a `require` statement. Use it by placing
the cursor on a variable, then hit `<leader>j` to import it at the top of the
file.

![Demo of import-js in action](https://raw.github.com/trotzig/import-js/master/import-js-demo.gif)

[Using with Emacs](EMACS.md)

## Importing: Example

Let's say that you have a project with the following setup:

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

And let's pretend that you're editing `pages/index.js` in Vim. It currently
looks like this:

```js
document.createElement(new Button({ text: 'Save' }).toDOMElement());
```

At this point, `Button` is undefined. We need to import it. You begin by
placing your cursor on "Button". Then hit `<leader>j` (or enter
`:ImportJSImport`). The Vim buffer changes to the following:

```js
var Button = require('components/button');

document.createElement(new Button({ text: 'Save' }).toDOMElement());
```

There, you just saved yourself having to type ~40 characters and doing a manual
lookup to see where in the file system that button component was located.

## Import all undefined variables

If you use [jshint](http://jshint.com/) or
[jsxhint](https://github.com/STRML/JSXHint/) import-js can be used to
automatically import all undefined variables. Just type `:ImportJSImportAll`
(or hit `<leader>i`), and all your variables will be resolved. By default,
import-js expects a global `jshint` command to be available. You can override
that through the `jshint_cmd` configuration option.

## Experimental: Go to module

Since Import-JS is pretty good at finding js modules, it makes sense that
there's an option to open/go to a file rather than import it. This is similar
to VIM's built in ["Open file under
cursor"](http://vim.wikia.com/wiki/Open_file_under_cursor). Use it by placing
the cursor on a variable and type `:ImportJSGoTo`, or hit `<leader>g`.

## Things to note

- Only files ending in .js\* are considered when importing
- All imports are expressed on one line each, starting with `var`/`const`/`let`
  (configurable)
- As part of resolving an import, all imports will be sorted
- The plugin is written in Ruby. You need a Vim with Ruby support.

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

*Tip:* Don't put `node_modules` here. Import-JS will find your Node
dependencies through your `package.json` file.

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

### `declaration_keyword`

If you are using ES6 (ES 2015), you have access to `let` and `const` in addition
to `var` as ways to declare variables. To use one of these, set the
`declaration_keyword` configuration.

```json
"declaration_keyword": "const"
```

### `jshint_cmd`

Configure a path to a `jshint` compatible command, e.g. `jsxhint` or `eslint`.

```json
"jshint_cmd": "jsxhint"
```

### `keep_file_extensions`

Set to true to make Import-JS keep the file extension of the imported js file.
E.g. `const Foo = require('foo.js')`.

```json
"keep_file_extensions": true
```

## Dependencies

import-js is written in Ruby, so in order to make it work in your Vim you need
Ruby support. You can test for Ruby support by typing `:ruby 1` from within
your Vim. If your Vim doesn't have Ruby support, you'll see something like
this:

```
 E319: Sorry, the command is not available in this version
```

(from https://github.com/wincent/command-t/blob/master/README.txt)

## Contributing

See the
[CONTRIBUTING.md](https://github.com/trotzig/import-js/blob/master/CONTRIBUTING.md)
file for tips on how to run, test and develop import-js locally.

Happy hacking!
