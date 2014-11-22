function importjs#ImportJSImport()
  ruby $import_js.import
endfunction

ruby << EOF
  begin
    require 'import-js/importer'
    $import_js = ImportJS::Importer.new
  rescue LoadError
    load_path_modified = false
    ::VIM::evaluate('&runtimepath').to_s.split(',').each do |path|
      lib = "#{path}/ruby"
      if !$LOAD_PATH.include?(lib) and File.exist?(lib)
        $LOAD_PATH << lib
        load_path_modified = true
      end
    end
    retry if load_path_modified
  end
EOF
