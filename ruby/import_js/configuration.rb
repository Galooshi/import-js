require 'json'
require 'open3'

module ImportJS
  CONFIG_FILE = '.importjs.json'

  DEFAULT_CONFIG = {
    'aliases' => {},
    'declaration_keyword' => 'var',
    'excludes' => [],
    'jshint_cmd' => 'jshint',
    'lookup_paths' => ['.'],
  }

  # Class that initializes configuration from a .importjs file
  class Configuration
    def initialize
      @config = DEFAULT_CONFIG.merge(load_config)
    end

    # @return [Object] a configuration value
    def get(key)
      @config[key]
    end

    # @return [Number?]
    def text_width
      get_number('&textwidth')
    end

    # @return [String] shiftwidth number of spaces if expandtab is not set,
    #   otherwise `\t`
    def tab
      return "\t" unless expand_tab?
      ' ' * (shift_width || 2)
    end

    private

    # @return [Hash]
    def load_config
      File.exist?(CONFIG_FILE) ? JSON.parse(File.read(CONFIG_FILE)) : {}
    end

    # Check for the presence of a setting such as:
    #
    #   - g:CommandTSmartCase (plug-in setting)
    #   - &wildignore         (Vim setting)
    #   - +cursorcolumn       (Vim setting, that works)
    #
    # @param str [String]
    # @return [Boolean]
    def exists?(str)
      VIM.evaluate(%{exists("#{str}")}).to_i != 0
    end

    # @param name [String]
    # @return [Number?]
    def get_number(name)
      exists?(name) ? VIM.evaluate("#{name}").to_i : nil
    end

    # @param name [String]
    # @return [Boolean?]
    def get_bool(name)
      exists?(name) ? VIM.evaluate("#{name}").to_i != 0 : nil
    end

    # @return [Boolean?]
    def expand_tab?
      get_bool('&expandtab')
    end

    # @return [Number?]
    def shift_width
      get_number('&shiftwidth')
    end
  end
end
