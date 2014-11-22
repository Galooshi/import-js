if exists("g:import_js_loaded") || &cp
  finish
endif
let g:import_js_loaded = 1

command ImportJSImport call importjs#ImportJSImport()

if !hasmapto(':ImportJSImport<CR>') && maparg('<Leader>j', 'n') == ''
  silent! nnoremap <unique> <silent> <Leader>j :ImportJSImport<CR>
endif
