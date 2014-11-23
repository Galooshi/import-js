# Introduction

`import-js` is a vim plugin that simplifies your CommonJS project by
automatically resolving variables in a `require` statement. Use it by placing
the cursor on a variable, then hit `<leader>j` to import it at the top of the
file.

## Example

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

At this point, `Button` is undefined, we need to import it. You begin by
placing your cursor on "Button". Then hit `<leader>j`. The Vim buffer changes to the following:

```js
var Button = require('components/button');
document.createElement(new Button({ text: 'Save' }).toDOMElement());
```

There, you just saved yourself having to type ~40 characters and doing a manual
lookup to see where in the file system that button component was located.

## Things to note

- Only files ending in .js\* are considered when importing
- All imports are expressed on one line each, starting with `var`
- As part of resolving an import, all imports will be sorted
- The plugin is written in Ruby. You need a Vim with Ruby support.

## Configuration

Create a file called `.importjs` in the root folder of your project to
configure import-js. The format of this file is YAML. It has the following
configuration options.

### `lookup_paths`

Configure where import-js should look to resolve imports. If you are using
Webpack, these should match the `modulesDirectories` configuration. Example:

```yaml
lookup_paths:
  - 'app/assets/javascripts'
  - 'vendor/bower_components'
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
