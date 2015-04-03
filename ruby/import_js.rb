# Namespace declaration
module ImportJS
  # We initialize an empty "ImportJS" namespace here so that we can define
  # classes under that namespace, e.g. `ImportJS::Importer`.
end

require_relative 'import_js/importer'
require_relative 'import_js/configuration'
