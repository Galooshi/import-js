# Vim support

import-js is meant to be used as a Pathogen plugin. Just `git clone` this repo
into the `bundles` folder and you are good to go!

## Dependencies

import-js is written in Ruby, so in order to make it work in your Vim you need
Ruby support. You can test for Ruby support by typing `:ruby 1` from within
Vim. If you don't have Ruby support, you'll see something like this:

```
 E319: Sorry, the command is not available in this version
```

(from https://github.com/wincent/command-t/blob/master/README.txt)

## Default mappings

By default, import-js attempts to set up the following mappings:

Mapping     | Command               | Description
------------|-----------------------|---------------------------------------------------------------------
`<Leader>j` | `:ImportJSImport`     | Import the module for the variable under the cursor.
`<Leader>i` | `:ImportJSFixImports` | Import any missing modules and remove any modules that are not used.
`<Leader>g` | `:ImportJSGoTo`       | Go to the module of the variable under the cursor.
