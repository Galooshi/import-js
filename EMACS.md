# Running import-js in Emacs

1. Install import-js
  * `gem install import-js`
2. Configure import-js
  * See [Configuration](README.md#configuration)
2. Install import-js.el for Emacs
  * This is not yet available on elpa/melpa, so for now this means dropping
    import-js.el somewhere in your .emacs.d
3. Configure your project root
  * `(setq import-js-project-root "/path/to/project")`
4. Start the import js project
  * `(M-x) run-import-js`
5. Import a file!
  * You can use something like `(M-x) import-js-import` with your cursor over
    the desired module
  * It will be helpful to bind `import-js-import` to an easy-to-use binding,
    such as:

    ```
    (define-prefix-command 'my-keymap)
    (global-set-key (kbd "s-a") 'my-keymap)
    (define-key my-keymap (kbd "a u") 'import-js-import)
    ```
