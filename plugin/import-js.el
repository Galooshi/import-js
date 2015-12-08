(require 'comint)

(defvar import-js-buffer nil "Current import-js process buffer")
(defvar import-js-project-root "." "Root of your project")
(defvar import-buffer nil "The current buffer under operation")

(defun import-js-send-input (command word path)
  (comint-send-string import-js-buffer
                      (concat command ":" word ":" path "\n")))

(defun import-js-word-at-point ()
  (save-excursion
    (skip-chars-backward "A-Za-z0-9:_")
    (let ((beg (point)) module)
      (skip-chars-forward "A-Za-z0-9:_")
      (setq module (buffer-substring beg (point)))
      module)))

(defun import-js-import ()
  (interactive)
  (save-some-buffers)
  (setq import-buffer (current-buffer))
  (import-js-send-input "import" (import-js-word-at-point) buffer-file-name))

(defun import-js-goto ()
  (interactive)
  (import-js-send-input "goto" (import-js-word-at-point) buffer-file-name))

(defun import-js-output-filter (output)
  "Check if the current prompt is a top-level prompt."
  (if (string-match "import:success" output)
      (progn
        (let ((old-buffer (current-buffer)))
          (save-current-buffer
            (set-buffer import-buffer)
            (revert-buffer t t t))))))

(defun run-import-js ()
  "Open a process buffer to run import-js"
  (interactive)

  (setq command
        (concat "ruby -e \"require 'import_js';Dir.chdir('"
                import-js-project-root "');ImportJS::EmacsEditor.new\""))
  (setq name "import-js")

  (if (not (comint-check-proc import-js-buffer))
      (let ((commandlist (split-string-and-unquote command))
            (buffer (current-buffer))
            (process-environment process-environment))
        (setenv "PAGER" (executable-find "cat"))
        (set-buffer (apply 'make-comint name (car commandlist)
                           nil (cdr commandlist)))))
  (setq import-js-buffer (format "*%s*" name))
  (add-hook 'comint-output-filter-functions 'import-js-output-filter nil t))

(provide 'import-js)
