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
    'strip_from_path' => nil,
    'use_relative_paths' => false
  }

  # Class that initializes configuration from a .importjs.json file
  class Configuration
    def initialize(path_to_current_file)
      @path_to_current_file = normalize_path(path_to_current_file)
      @configs = []
      Pathname.new(File.dirname(@path_to_current_file)).ascend do |path|
        local_config = load_config(File.join(path, CONFIG_FILE))
        @configs.concat([local_config].flatten) if local_config
      end
      @configs << DEFAULT_CONFIG
    end

    # @return [Object] a configuration value
    def get(key, from_file: nil)
      @configs.find do |config|
        applies_to = config['applies_to'] || '*'
        applies_from = config['applies_from'] || '*'
        next unless config.has_key?(key)
        File.fnmatch(normalize_path(applies_to), @path_to_current_file) &&
          File.fnmatch(normalize_path(applies_from), normalize_path(from_file))
      end[key]
    end

    # @param variable_name [String]
    # @param path_to_current_file [String?]
    # @return [ImportJS::JSModule?]
    def resolve_alias(variable_name, path_to_current_file)
      path = get('aliases')[variable_name]
      return resolve_destructured_alias(variable_name) unless path

      path = path['path'] if path.is_a? Hash

      if path_to_current_file && !path_to_current_file.empty?
        path = path.sub(/\{filename\}/,
                        File.basename(path_to_current_file, '.*'))
      end
      ImportJS::JSModule.new(import_path: path)
    end

    def resolve_destructured_alias(variable_name)
      get('aliases').each do |_, path|
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

    # @param file [File]
    # @return [Hash]
    def load_config(file)
      return unless File.exist?(file)
      JSON.parse(File.read(file))
    end

    # @param path [String]
    # @return [String]
    def normalize_path(path)
      return './' unless path
      path = path.sub(/^#{Regexp.escape(Dir.pwd)}/, '.')
      path = "./#{path}" unless path.start_with?('.')
      path
    end
  end
end
