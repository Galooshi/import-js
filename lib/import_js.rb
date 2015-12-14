# Namespace declaration
module ImportJS
  # We initialize the "ImportJS" namespace here so that we can define classes
  # under that namespace, e.g. `ImportJS::Importer`.

  class ParseError < StandardError
    # Error thrown when a JS file can't be parsed
  end
end

require_relative 'import_js/js_module'
require_relative 'import_js/import_statement'
require_relative 'import_js/importer'
require_relative 'import_js/vim_editor'
require_relative 'import_js/emacs_editor'
require_relative 'import_js/command_line_editor'
require_relative 'import_js/configuration'
