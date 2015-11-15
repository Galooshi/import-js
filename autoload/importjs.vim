function importjs#ImportJSImport()
  ruby $import_js.import
endfunction
function importjs#ImportJSImportAll()
  ruby $import_js.import_all
endfunction
function importjs#ImportJSGoTo()
  ruby $import_js.goto
endfunction

" WideMsg() prints [long] message up to (&columns-1) length
" guaranteed without "Press Enter" prompt.
" http://vim.wikia.com/wiki/How_to_print_full_screen_width_messages
function! importjs#WideMsg(msg)
  let x=&ruler | let y=&showcmd
  set noruler noshowcmd
  redraw
  echo a:msg
  let &ruler=x | let &showcmd=y
endfun

ruby << EOF
  begin
    require 'import_js'
    $import_js = ImportJS::Importer.new
  rescue LoadError
    load_path_modified = false
    ::VIM::evaluate('&runtimepath').to_s.split(',').each do |path|
      lib = "#{path}/lib"
      if !$LOAD_PATH.include?(lib) and File.exist?(lib)
        $LOAD_PATH << lib
        load_path_modified = true
      end
    end
    retry if load_path_modified
  end
EOF
