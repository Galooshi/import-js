// @flow

import fbWatchman from 'fb-watchman';
import loglevel from 'loglevel';
import minimatch from 'minimatch';

import normalizePath from './normalizePath';

const SUBSCRIPTION_NAME = 'import-js-subscription';

export default class WatchmanFileCache {
  workingDirectory: string;
  listeners: Set<object>;
  excludes: Array<string>;
  enabled: bool;

  constructor(
    workingDirectory: string = process.cwd(),
    excludes: Array<string> = []
  ) {
    this.workingDirectory = workingDirectory;
    this.excludes = excludes;
    this.listeners = new Set();

    // Flag to quickly check if the cache is enabled.
    this.enabled = false;
  }

  addListener(listener: object) {
    this.listeners.add(listener);
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
      fields: ['name', 'exists', 'mtime_ms'],
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

        const added = [];
        const removed = [];
        resp.files.forEach((file: Object) => {
          const normalizedPath = normalizePath(file.name, this.workingDirectory);
          if (normalizedPath.startsWith('./node_modules/')) {
            return;
          }
          if (this.excludes.some((pattern: string): boolean =>
            minimatch(normalizedPath, pattern))) {
            return;
          }
          if (file.exists) {
            added.push({ path: normalizedPath, mtime: +file.mtime_ms });
          } else {
            removed.push({ path: normalizedPath });
          }
        });
        if (added.length) {
          this.listeners.forEach((listener: object) => {
            listener.filesAdded(added);
          });
        }
        if (removed.length) {
          this.listeners.forEach((listener: object) => {
            listener.filesDeleted(removed);
          });
        }
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
}
