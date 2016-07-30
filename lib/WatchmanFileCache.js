// @flow

import fbWatchman from 'fb-watchman';
import loglevel from 'loglevel';

import normalizePath from './normalizePath';

const SUBSCRIPTION_NAME = 'import-js-subscription';
const instances = {};

export default class WatchmanFileCache {
  workingDirectory: string;
  files: Set<string>;
  enabled: bool;

  /**
   * Factory method to get an instance for a specific working directory.
   */
  static getForWorkingDirectory(workingDirectory: string): WatchmanFileCache {
    let instance = instances[workingDirectory];
    if (!instance) {
      instance = new WatchmanFileCache(workingDirectory);
      instances[workingDirectory] = instance;
    }
    return instance;
  }

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
    this.files = new Set();

    // Flag to quickly check if the cache is enabled.
    this.enabled = false;
  }

  subscribe({
    client,
    fbWatch,
    relativePath,
  }: {
    client: fbWatchman.Client,
    fbWatch: string,
    relativePath: string,
  }): Promise<void> {
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

    return new Promise((resolve: Function, reject: Function) => {
      client.command(['subscribe', fbWatch, SUBSCRIPTION_NAME, subscription],
        (error: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });

      client.on('subscription', (resp: Object) => {
        if (resp.subscription !== SUBSCRIPTION_NAME) {
          return;
        }
        // Flag that we have a working subscription and that files are available.
        this.enabled = true;

        resp.files
          .filter((file: Object): bool => !file.name.startsWith('node_modules/'))
          .forEach((file: Object) => {
            const normalizedPath = normalizePath(file.name, this.workingDirectory);

            if (file.exists) {
              loglevel.debug(
                `ADDING file to WatchmanFileCache: ${normalizedPath}`);
              this.files.add(normalizedPath);
            } else {
              loglevel.debug(
                `REMOVING file from WatchmanFileCache: ${normalizedPath}`);
              this.files.delete(normalizedPath);
            }
          });
      });
    });
  }

  startSubscription({ client }: { client: fbWatchman.Client }): Promise<void> {
    return new Promise((resolve: Function, reject: Function) => {
      client.command(['watch-project', this.workingDirectory], (error: Error, resp: Object) => {
        if (error) {
          reject(error);
          return;
        }

        if ('warning' in resp) {
          loglevel.warn(`WARNING received during watchman init: ${resp.warning}`);
        }

        this.subscribe({
          client,
          fbWatch: resp.watch,
          relativePath: resp.relativePath,
        }).then(resolve).catch(reject);
      });
    });
  }

  /**
   * Get all files from the watchman-powered cache. Returns a promise that will
   * resolve if watchman is available, and the file cache is enabled. Will
   * resolve immediately if previously initialized.
   */
  initialize(): Promise<void> {
    return new Promise((resolve: Function, reject: Function) => {
      const client = new fbWatchman.Client();
      client.on('error', (error: Error) => {
        reject(error);
      });
      client.capabilityCheck({
        optional: [],
        required: ['relative_root'],
      }, (error: Error) => {
        if (error) {
          client.end();
          reject(error);
        } else {
          this.startSubscription({ client }).then(resolve).catch(reject);
        }
      });
    });
  }

  isEnabled(): bool {
    return this.enabled;
  }

  getFiles(): Set<string> {
    return this.files;
  }
}
