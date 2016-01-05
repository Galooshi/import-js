# Contributing

## Adding support for another editor

Depending on how plugins for your editor work, you can either make the repo
itself work as a plugin (as the Vim plugin is built), or make use of the
`import_js` gem (which also comes with command-line utilities):

```bash
gem install import_js
```

All editor plugins will need to implement an `ImportJS::FooEditor` class. Look
at the one implemented by the Vim plugin (`ImportJS::VIMEditor`), or the Emacs
plugin (`ImportJS::EmacsEditor`) for inspiration. The Vim editor class works as
a reference implementation. Any public methods defined for that class will have
to be implemented in all editor classes.

## Testing

import-js uses RSpec to test its behavior. To run tests, you might first have
to install the `rspec` gem:

```bash
gem install rspec
```

Once you have RSpec installed, you just type `rspec` in the root folder of the
project to run all tests.

```bash
⨠ rspec
......................

Finished in 0.02133 seconds (files took 0.19664 seconds to load)
22 examples, 0 failures
```

## Developing for Vim

Here are a few tips to make it simpler to test a local copy of import-js in
Vim:

### Symlink

Make a symlink inside your pathogen bundles folder to the local copy of
import-js to make it easier to try out your changes.

```bash
ln -s ~/import-js import-js
```

## Developing for Sublime

Here are a few tips to make it simpler to test a local copy of import-js in
Sublime:

### Symlink

Make a symlink inside your Sublime packages folder to the local copy of
import-js. Every time you change the `import_js.py` file the plugin will
reload.

```bash
cd ~/Library/Application Support/Sublime Text 3/Packages
ln -s ~/import-js import-js
```

### Build and install the gem locally

Since the Sublime plugin uses the `import-js` CLI tool, you need to rebuild and
install the `import_js` Ruby gem whenever you make changes to the Ruby code
powering import-js.

First, update `lib/import_js/version.rb` and bump the version number.

```
gem build import_js.gemspec && gem install --local import_js-__version__.gem
```

Replace `__version__` with the bumped version number.
