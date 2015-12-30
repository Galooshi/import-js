import sublime, sublime_plugin, subprocess, os, json

importjs_path = os.path.expanduser('~/.rbenv/shims/import-js')

class ImportJsCommand(sublime_plugin.TextCommand):
  def run(self, edit, **args):
    entire_file_region = sublime.Region(0, self.view.size())
    current_file_contents = self.view.substr(entire_file_region)

    environment = { 'LC_ALL': 'en_US.UTF-8', 'LC_CTYPE': 'UTF-8', 'LANG': 'en_US.UTF-8' }
    project_root = self.view.window().extract_variables()['folder']
    command = [importjs_path]

    if(args.get('word')):
      word = self.view.substr(self.view.word(self.view.sel()[0]))
      command.append('--word')
      command.append(word)

    if(args.get('selections')):
      command.append('--selections')
      command.append(','.join(args.get('selections')))

    print(command)

    proc = subprocess.Popen(
      command,
      cwd=project_root,
      env=environment,
      stdin=subprocess.PIPE,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE
    )

    result = proc.communicate(input=current_file_contents.encode('utf-8'))
    stderr = result[1].decode()

    if(proc.returncode > 0):
      sublime.error_message('Error when executing import-js: ' + stderr)
      return

    if(len(stderr) > 0):
      meta = json.loads(stderr)
      if(meta.get('messages')):
        sublime.status_message(meta.get('messages'))
      if(meta.get('ask_for_selections')):
        rerun = lambda selections: self.rerun(edit, args, selections)
        self.ask_for_selections(meta.get('ask_for_selections'), rerun)
        return

    stdout = result[0].decode()
    self.view.replace(edit, entire_file_region, stdout)

  def rerun(self, edit, args, selections):
    args['selections'] = selections
    self.run(edit, **args)

  def ask_for_selections(self, selections, on_selections_done):
    selected = []
    selections_iter = iter(selections)

    def ask_recurse(selection):
      if (not(selection)):
        on_selections_done(selected)
        return

      def on_done(i):
        selected.append(selection.get('word') + ':' + str(i))
        ask_recurse(next(selections_iter, None))

      self.view.show_popup_menu(
        selection.get('alternatives'),
        on_done
      )

    ask_recurse(next(selections_iter, None))
