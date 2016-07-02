import fbWatchman from 'fb-watchman';
import loglevel from 'loglevel';

import normalizePath from './normalizePath';

const SUBSCRIPTION_NAME = 'import-js-subscription';

const CACHE = new Set();

// Flag to quickly check if the cache is enabled.
let enabled = false;

function subscribe({ client, fbWatch, relativePath, workingDirectory }): Promise {
  const subscription = {
    // Match javascript files
    expression: [
      'anyof',
      ['suffix', 'js'],
      ['suffix', 'jsx'],
      ['suffix', 'json'],
    ],
    // We're only interested in the file name
    fields: ['name', 'exists'],
    relative_root: relativePath,
  };

  return new Promise((resolve, reject) => {
    client.command(['subscribe', fbWatch, SUBSCRIPTION_NAME, subscription],
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });

    client.on('subscription', (resp) => {
      if (resp.subscription !== SUBSCRIPTION_NAME) {
        return;
      }
      // Flag that we have a working subscription and that files are available.
      enabled = true;

      const filteredFiles = resp.files.filter((file) =>
        !file.name.startsWith('node_modules/'));
      filteredFiles.forEach((file) => {
        const normalizedPath = normalizePath(file.name, workingDirectory);
        if (file.exists) {
          loglevel.debug(`ADDING file to WatchmanFileCache: ${normalizedPath}`);
          CACHE.add(normalizedPath);
        } else {
          loglevel.debug(`REMOVING file from WatchmanFileCache: ${normalizedPath}`);
          CACHE.delete(normalizedPath);
        }
      });
    });
  });
}

function startSubscription({ client, workingDirectory }): Promise {
  return new Promise((resolve, reject) => {
    client.command(['watch-project', workingDirectory], (error, resp) => {
      if (error) {
        reject(error);
        return;
      }

      if ('warning' in resp) {
        loglevel.warn(`WARNING received during watchman init: ${resp.warning}`);
      }

      subscribe({
        client,
        fbWatch: resp.watch,
        relativePath: resp.relativePath,
        workingDirectory,
      }).then(resolve).catch(reject);
    });
  });
}

export default {
  /**
   * Get all files from the watchman-powered cache. Returns a promise that will
   * resolve if watchman is available, and the file cache is enabled. Will
   * resolve immediately if previously initialized.
   */
  initialize(workingDirectory: string = process.cwd()): Promise {
    return new Promise((resolve, reject) => {
      const client = new fbWatchman.Client();
      client.on('error', (error) => {
        reject(error);
      });
      client.capabilityCheck({
        optional: [],
        required: ['relative_root'],
      }, (error) => {
        if (error) {
          client.end();
          reject(error);
        } else {
          startSubscription({ client, workingDirectory }).then(resolve).catch(reject);
        }
      });
    });
  },

  isEnabled(): bool {
    return enabled;
  },

  getFiles(): Set<string> {
    return CACHE;
  },
};
