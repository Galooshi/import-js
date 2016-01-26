# frozen_string_literal: true
require 'json'
require 'open3'

module ImportJS
  CONFIG_FILE = '.importjs.json'.freeze

  DEFAULT_CONFIG = {
    'aliases' => {},
    'declaration_keyword' => 'import',
    'named_exports' => {},
    'eslint_executable' => 'eslint',
    'excludes' => [],
    'ignore_package_prefixes' => [],
    'import_dev_dependencies' => false,
    'import_function' => 'require',
    'lookup_paths' => ['.'],
    'strip_file_extensions' => ['.js', '.jsx'],
    'strip_from_path' => nil,
    'use_relative_paths' => false,
  }.freeze

  # Class that initializes configuration from a .importjs.json file
  class Configuration
    def initialize(path_to_current_file)
      @path_to_current_file = normalize_path(path_to_current_file)
      @configs = []
      user_config = load_config(CONFIG_FILE)
      @configs.concat([user_config].flatten.reverse) if user_config
      @configs << DEFAULT_CONFIG
    end

    # @return [Object] a configuration value
    def get(key, from_file: nil)
      @configs.find do |config|
        applies_to = config['applies_to'] || '*'
        applies_from = config['applies_from'] || '*'
        next unless config.key?(key)
        File.fnmatch(normalize_path(applies_to), @path_to_current_file) &&
          File.fnmatch(normalize_path(applies_from), normalize_path(from_file))
      end[key]
    end

    # @param variable_name [String]
    # @param path_to_current_file [String?]
    # @return [ImportJS::JSModule?]
    def resolve_alias(variable_name, path_to_current_file)
      path = get('aliases')[variable_name]
      return unless path

      path = path['path'] if path.is_a? Hash

      if path_to_current_file && !path_to_current_file.empty?
        path = path.sub(/\{filename\}/,
                        File.basename(path_to_current_file, '.*'))
      end
      ImportJS::JSModule.new(import_path: path)
    end

    # @param variable_name [String]
    # @return [ImportJS::JSModule?]
    def resolve_named_exports(variable_name)
      get('named_exports').each do |import_path, named_exports|
        next unless named_exports.include?(variable_name)

        js_module = ImportJS::JSModule.new(import_path: import_path)
        js_module.has_named_exports = true
        return js_module
      end
      nil
    end

    # @return [Array<String>]
    def package_dependencies
      return [] unless File.exist?('package.json')

      keys = %w[dependencies peerDependencies]
      keys << 'devDependencies' if get('import_dev_dependencies')
      package_json = JSON.parse(File.read('package.json'))
      keys.map do |key|
        package_json[key].keys if package_json[key]
      end.compact.flatten
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
