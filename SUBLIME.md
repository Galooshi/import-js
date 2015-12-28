# Running import-js in Sublime Text

1. Install import-js
  * `gem install import-js`
2. Install eslint
  * `npm install -g eslint`
3. Configure import-js
  * See [Configuration](README.md#configuration)
4. Copy plugins/import-js-sublime to your Sublime packages directory
5. Open the root of your project as a folder (Project -> Add Folder to Project…)
6. Import a file!
  * Whenever you have undefined variables, open the Command Palette
    (CTRL/CMD+SHIFT+P) and select "ImportJS: Import all dependencies".
  * It will be helpful to bind `import-js-import` to an easy-to-use binding,
    such as:

    ```
    { "keys": ["super+alt+i"], "command": "import_js" }
    ```
