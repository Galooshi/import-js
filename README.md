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

### `aliases`

Some variable names might not easily map to a file in the filesystem. For
those, you can add them to the `aliases` configuration.

```yaml
aliases:
  '$' => 'third-party-libs/jquery'
  '_' => 'third-party-libs/underscore'
```

## Dependencies

import-js requires Ruby 1.9, so in order to make it work in your Vim you need
support for this or a later version of Ruby. You can test for Ruby support by
typing `:echo has('ruby')` from within your Vim. If it shows `1` then you can
type the command `:ruby puts RUBY_VERSION` to see which version of Ruby Vim is
using.

(from http://junegunn.kr/2013/09/installing-vim-with-ruby-support/)

On Mac OSX the default installation of Vim will use Ruby 1.8.7. If you are using
a version earlier than 1.9, then you will see this type of error:

> Error detected while processing /Users/paradasia/.vim/bundle/import-js/autoload/importjs.vim:
> line 20:
> SyntaxError: (eval):1:in require': /Users/paradasia/.vim/bundle/import-js/ruby/import-js/importer.rb:71: syntax error, unexpected '.', expecting kEND Error detected while processing function importjs#ImportJSImport: line 1: NoMethodError: undefined methodimport' for nil:NilClass
> Press ENTER or type command to continue

To use a later version of Ruby, you must first set up and enable the correct
version of Ruby. [RVM][rvm] or [rbenv][rbenv] are two tools that can help with
managing the installation of different versions of Ruby.

[rvm]: http://rvm.io/
[rbenv]: https://github.com/sstephenson/rbenv

Uninstall Vim, and then re-install it while the correct version of Ruby is
enabled.

["Installing Vim with Ruby Support"][vim-with-ruby-post] has more detailed
instructions.

[vim-with-ruby-post]: http://junegunn.kr/2013/09/installing-vim-with-ruby-support/

## Contributing

See the
[CONTRIBUTING.md](https://github.com/trotzig/import-js/blob/master/CONTRIBUTING.md)
file for tips on how to run, test and develop import-js locally.

Happy hacking!
