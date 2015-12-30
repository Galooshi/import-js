# Running import-js in Sublime Text

1. Install import-js
  * `gem install import-js`
2. Install eslint
  * `npm install -g eslint`
3. Configure import-js
  * See [Configuration](README.md#configuration)
4. Symlink ipmort-js (root folder) to your Sublime packages directory, e.g. `ln
   -s ~/import-js import-js`.
5. Open the root of your project as a folder (Project -> Add Folder to Project…)
6. Import a file!
  * Whenever you have undefined variables, open the Command Palette
    (CTRL/CMD+SHIFT+P) and select either "ImportJS: import all dependencies" or
    "ImportJS: import word under cursor".
  * It will be helpful to bind `import_js` to easy-to-use bindings,
    such as:

    ```
    { "keys": ["super+alt+i"], "command": "import_js" },
    { "keys": ["super+alt+j"], "command": "import_js", "args": {"word": true} },
    { "keys": ["super+alt+g"], "command": "import_js", "args": {"word": true, "goto": true} },
    ```
