import fbWatchman from 'fb-watchman';

const SUBSCRIPTION_NAME = 'import-js-subscription';

const CACHE = new Set();

// Flag to quickly check if the cache is enabled.
let enabled = false;

function subscribe({ client, fbWatch, relativePath }): Promise {
  const subscription = {
    // Match any `.js` file
    expression: ['allof', ['match', '*.js*']],
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

    // Subscription results are emitted via the subscription event.
    // Note that this emits for all subscriptions.  If you have
    // subscriptions with different `fields` you will need to check
    // the subscription name and handle the differing data accordingly.
    // `resp`  looks like this in practice:
    //
    // { root: '/private/tmp/foo',
    //   subscription: 'mysubscription',
    //   files: [ { name: 'node_modules/fb-watchman/index.js',
    //       size: 4768,
    //       exists: true,
    //       type: 'f' } ] }
    client.on('subscription', (resp) => {
      if (resp.subscription !== SUBSCRIPTION_NAME) {
        return;
      }
      // Flag that we have a working subscription and that files are available.
      enabled = true;

      const filteredFiles = resp.files.filter((file) =>
        !file.name.startsWith('node_modules/'));
      filteredFiles.forEach((file) => {
        if (file.exists) {
          CACHE.add(file.name);
        } else {
          CACHE.delete(file.name);
        }
      });
    });
  });
}

function startSubscription({ client }): Promise {
  return new Promise((resolve, reject) => {
    client.command(['watch-project', process.cwd()], (error, resp) => {
      if (error) {
        reject(error);
        return;
      }

      // It is considered to be best practice to show any 'warning' or
      // 'error' information to the user, as it may suggest steps
      // for remediation
      if ('warning' in resp) {
        console.log('warning: ', resp.warning);
      }

      // `watch-project` can consolidate the watch for your
      // dir_of_interest with another watch at a higher level in the
      // tree, so it is very important to record the `relative_path`
      // returned in resp
      console.log('watch established on', resp.watch,
                  'relative_path', resp.relative_path);

      subscribe({
        client,
        fbWatch: resp.watch,
        relativePath: resp.relativePath,
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
  initialize(): Promise {
    return new Promise((resolve, reject) => {
      const client = new fbWatchman.Client();
      client.capabilityCheck({
        optional: [],
        required: ['relative_root'],
      }, (error) => {
        if (error) {
          client.end();
          reject(error);
        } else {
          startSubscription({ client }).then(resolve).catch(reject);
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
