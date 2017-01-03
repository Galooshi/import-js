import Configuration from './Configuration';
import ModuleFinder from './ModuleFinder';

export default function initializeModuleFinder(
  workingDirectory = process.cwd()
): Promise {
  const config = new Configuration('importjs', workingDirectory);
  const moduleFinder = ModuleFinder.getForWorkingDirectory(
    workingDirectory, config.get('excludes'));
  return moduleFinder.initializeStorage(config.get('cacheLocation'))
    .then((): Promise => moduleFinder.startWatcher())
    .catch((err: Object) => {
      throw new Error(err);
    });
}
