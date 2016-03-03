if exists("g:import_js_loaded") || &cp
  finish
endif
let g:import_js_loaded = 1

command ImportJSImport call importjs#ImportJSImport()
command ImportJSGoTo call importjs#ImportJSGoTo()
command ImportJSRemoveUnusedImports call importjs#ImportJSRemoveUnusedImports()
command ImportJSFixImports call importjs#ImportJSFixImports()
