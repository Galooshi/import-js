Here are a few tips to make it simpler to test a local copy of import-js:

## Symlink
Make a symlink inside your pathogen bundles folder to the local copy of
import-js to make it easier to try out your changes.

```bash
ln -s ~/import-js import-js
```

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
