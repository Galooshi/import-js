require 'json'
require 'open3'

module ImportJS
  CONFIG_FILE = '.importjs.json'

  DEFAULT_CONFIG = {
    'aliases' => {},
    'declaration_keyword' => 'import',
    'eslint_executable' => 'eslint',
    'excludes' => [],
    'ignore_package_prefixes' => [],
    'import_function' => 'require',
    'lookup_paths' => ['.'],
    'strip_file_extensions' => ['.js', '.jsx'],
    'use_relative_paths' => false
  }

  # Class that initializes configuration from a .importjs.json file
  class Configuration
    def initialize
      @config = DEFAULT_CONFIG.merge(load_config)
    end

    def refresh
      return if @config_time == config_file_last_modified
      @config = DEFAULT_CONFIG.merge(load_config)
    end

    # @return [Object] a configuration value
    def get(key)
      @config[key]
    end

    # @param variable_name [String]
    # @param path_to_current_file [String?]
    # @return [ImportJS::JSModule?]
    def resolve_alias(variable_name, path_to_current_file)
      path = @config['aliases'][variable_name]
      return resolve_destructured_alias(variable_name) unless path

      path = path['path'] if path.is_a? Hash

      if path_to_current_file && !path_to_current_file.empty?
        path = path.sub(/\{filename\}/,
                        File.basename(path_to_current_file, '.*'))
      end
      ImportJS::JSModule.new(import_path: path)

    end

    def resolve_destructured_alias(variable_name)
      @config['aliases'].each do |_, path|
        next if path.is_a? String
        if (path['destructure'] || []).include?(variable_name)
          js_module = ImportJS::JSModule.new(import_path: path['path'])
          js_module.is_destructured = true
          return js_module
        end
      end
      nil
    end

    # @return [Array<String>]
    def package_dependencies
      return [] unless File.exist?('package.json')

      package = JSON.parse(File.read('package.json'))
      dependencies = package['dependencies'] ?
        package['dependencies'].keys : []
      peer_dependencies = package['peerDependencies'] ?
        package['peerDependencies'].keys : []

      dependencies.concat(peer_dependencies)
    end

    private

    # @return [Hash]
    def load_config
      @config_time = config_file_last_modified
      File.exist?(CONFIG_FILE) ? JSON.parse(File.read(CONFIG_FILE)) : {}
    end

    # @return [Time?]
    def config_file_last_modified
      File.exist?(CONFIG_FILE) ? File.mtime(CONFIG_FILE) : nil
    end
  end
end
