import fs from 'fs';

import fbWatchman from 'fb-watchman';

import FileUtils from './FileUtils';

const SUBSCRIPTION_NAME = 'import-js-subscription';
const INDEX_FILE = '.importjs.index.json';

function subscribe({ client, fbWatch, relativePath }) {
  const subscription = {
    // Match any `.js` file in the dir_of_interest
    expression: ['allof', ['match', '*.js*']],
    // We're only interested in the file name
    fields: ['name', 'exists'],
    relative_root: relativePath,
  };

  client.command(['subscribe', fbWatch, SUBSCRIPTION_NAME, subscription],
    (error, resp) => {
      if (error) {
        throw error;
      }
      console.log('subscription established', resp.subscribe);
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
    const filteredFiles = resp.files.filter((file) =>
      !file.name.startsWith('node_modules/'));
    const files = new Set(FileUtils.readJsonFile(INDEX_FILE) || []);
    filteredFiles.filter((file) => !file.exists).forEach((file) => {
      files.delete(file.name);
    });

    const toAdd = filteredFiles.filter((file) => file.exists);
    const newIndex = new Set([...files].concat(toAdd.map((f) => f.name)));
    fs.writeFile(INDEX_FILE, JSON.stringify([...newIndex]), (err) => {
      if (err) {
        throw err;
      }
    });
  });
}

function initialize({ client }) {
  client.command(['watch-project', process.cwd()], (error, resp) => {
    if (error) {
      throw error;
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
    });
  });
}

export default function watch() {
  const client = new fbWatchman.Client();
  client.capabilityCheck({
    optional: [],
    required: ['relative_root'],
  }, (error) => {
    if (error) {
      client.end();
      throw error;
    }
    initialize({ client });
  });
}
