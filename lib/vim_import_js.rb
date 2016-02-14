# This is a proxy file for ./import_js.rb. Vim needs it so that we can prevent
# any installed import_js gems from being loaded before the files in the local
# filesystem.
require_relative './import_js'
