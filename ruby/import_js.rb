# Namespace declaration
module ImportJS
  # We initialize an empty "ImportJS" namespace here so that we can define
  # classes under that namespace, e.g. `ImportJS::Importer`.
end

require_relative 'import_js/js_module'
require_relative 'import_js/importer'
require_relative 'import_js/configuration'

# @deprecated we've moved to JSON configuration, so the old YAML file is no
# longer supported
if File.exist?('.importjs')
  fail <<-EOS.split.join(' ')
    [import-js] this project is no longer configured with YAML. Please
    migrate your .importjs file to a JSON file called ".importjs.json"
    instead.'
  EOS
end
