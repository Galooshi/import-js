# Running import-js in Sublime Text

1. Install the [ImportJS plugin via Package
   Control](https://packagecontrol.io/packages/ImportJS)

2. Install the import_js gem

   ```sh
   gem install import_js
   ```

3. Install eslint

   ```sh
   npm install -g eslint
   ```

4. [Configure import-js](README.md#configuration)

5. Open the root of your project as a folder (Project -> Add Folder to Project…)

6. Import a file!

   Whenever you have undefined variables, open the Command Palette
   (`CTRL+SHIFT+P`/`CMD+SHIFT+P`) and select "ImportJS: fix all imports", or
   "ImportJS: import word under cursor".

It will be helpful to bind `import_js` to easy-to-use bindings, such as:

```json
{ "keys": ["super+alt+i"], "command": "import_js" },
{ "keys": ["super+alt+j"], "command": "import_js", "args": { "word": true } },
{ "keys": ["super+alt+g"], "command": "import_js", "args": { "word": true, "goto": true } },
```

## Troubleshooting

If you get an error message saying something like "Can't find import-js
executable", you may need to specify a path to the `import-js` executable in
configuration. This likely means that you are using a tool like
[rbenv](https://github.com/rbenv/rbenv) or [rvm](https://rvm.io/) to
manage multiple Ruby versions on your system.

To fix this, edit the ImportJS User Settings from the Preferences > Package
Settings > ImportJS > Settings — User menu and set the `executable` option to
point to the path to the `import-js` executable. Example:

```json
{
  "executable": "/Users/USERNAME/.rbenv/shims/import-js"
}
```

Please note that you can't use ~ to refer to the home directory, you need to
specify the full path. To figure out where your import-js executable is located,
you can run `which import-js` from your project's directory.
