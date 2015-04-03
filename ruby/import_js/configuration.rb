require 'yaml'
require 'open3'

module ImportJS
  # @deprecated The project is changing name to "vim-import-js"
  DEPRECATED_CONFIG_FILE = '.importjs'
  CONFIG_FILE = '.vim-import-js.yaml'

  # Class that initializes configuration from a .vim-importjs.yaml file
  class Configuration
    def initialize
      @config = load_config
    end

    # @return [Object] a configuration value
    def get(key)
      @config[key]
    end

    private

    # @return [Hash]
    def load_config
      default_config = {
        'aliases' => {},
        'declaration_keyword' => 'var',
        'jshint_cmd' => 'jshint',
        'lookup_paths' => ['.'],
        'text_width' => 80,
      }
      config_file = if File.exist?(CONFIG_FILE)
                      CONFIG_FILE
                    else
                      DEPRECATED_CONFIG_FILE
                    end
      if File.exist? config_file
        return default_config.merge(YAML.load_file(config_file))
      end
      default_config
    end
  end
end
