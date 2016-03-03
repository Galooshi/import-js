if !hasmapto(':ImportJSImport<CR>') && maparg('<Leader>j', 'n') == ''
  silent! nnoremap <buffer> <unique> <silent> <Leader>j :ImportJSImport<CR>
endif

if !hasmapto(':ImportJSFixImports<CR>') && maparg('<Leader>i', 'n') == ''
  silent! nnoremap <buffer> <unique> <silent> <Leader>i :ImportJSFixImports<CR>
endif

if !hasmapto(':ImportJSGoTo<CR>') && maparg('<Leader>g', 'n') == ''
  silent! nnoremap <buffer> <unique> <silent> <Leader>g :ImportJSGoTo<CR>
endif
