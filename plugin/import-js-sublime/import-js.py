import sublime, sublime_plugin, subprocess, os

importjs_path = os.path.expanduser('~/.rbenv/shims/import-js-sublime-text')

class ImportJsCommand(sublime_plugin.TextCommand):
  def run(self, edit):
    entire_file_region = sublime.Region(0, self.view.size())
    current_file_contents = self.view.substr(entire_file_region)

    environment = { 'LC_ALL': 'en_US.UTF-8', 'LC_CTYPE': 'UTF-8', 'LANG': 'en_US.UTF-8' }
    project_root = self.view.window().extract_variables()['folder']
    proc = subprocess.Popen(
      importjs_path,
      shell=True,
      cwd=project_root,
      env=environment,
      stdin=subprocess.PIPE,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE
    )

    result = proc.communicate(input=current_file_contents.encode('utf-8'))
    stderr = result[1].decode()
    if(len(stderr) > 0):
      print('Error when executing import-js: ' + stderr)
      return

    stdout = result[0].decode()
    self.view.replace(edit, entire_file_region, stdout)
