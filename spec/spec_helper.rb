# Add `ruby` folder to load path
$LOAD_PATH << File.join(File.dirname(__FILE__), '../ruby')
require 'import_js'

# Import mocks used in testing
require 'import_js/mock_vim_buffer'
require 'import_js/mock_vim_window'
