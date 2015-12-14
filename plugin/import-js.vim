if exists("g:import_js_loaded") || &cp
  finish
endif
let g:import_js_loaded = 1

command ImportJSImport call importjs#ImportJSImport()
command ImportJSImportAll call importjs#ImportJSImportAll()
command ImportJSGoTo call importjs#ImportJSGoTo()
command ImportJSRemoveUnusedImports call importjs#ImportJSRemoveUnusedImports()
command ImportJSFixImports call importjs#ImportJSFixImports()

if !hasmapto(':ImportJSImport<CR>') && maparg('<Leader>j', 'n') == ''
  silent! nnoremap <unique> <silent> <Leader>j :ImportJSImport<CR>
endif

if !hasmapto(':ImportJSFixImports<CR>') && maparg('<Leader>i', 'n') == ''
  silent! nnoremap <unique> <silent> <Leader>i :ImportJSFixImports<CR>
endif

if !hasmapto(':ImportJSGoTo<CR>') && maparg('<Leader>g', 'n') == ''
  silent! nnoremap <unique> <silent> <Leader>g :ImportJSGoTo<CR>
endif
