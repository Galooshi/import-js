# Running import-js in Sublime Text

1. Install the [ImportJS plugin via Package
   Control](https://packagecontrol.io/packages/ImportJS)
2. Install the import_js gem
  * `gem install import_js`
3. Install eslint
  * `npm install -g eslint`
4. Configure import-js
  * See [Configuration](README.md#configuration)
5. Open the root of your project as a folder (Project -> Add Folder to Project…)
6. Import a file!
  * Whenever you have undefined variables, open the Command Palette
    (CTRL/CMD+SHIFT+P) and select "ImportJS: fix all imports",
    or "ImportJS: import word under cursor".
  * It will be helpful to bind `import_js` to easy-to-use bindings,
    such as:

    ```
    { "keys": ["super+alt+i"], "command": "import_js" },
    { "keys": ["super+alt+j"], "command": "import_js", "args": { "word": true } },
    { "keys": ["super+alt+g"], "command": "import_js", "args": { "word": true, "goto": true } },
    ```
