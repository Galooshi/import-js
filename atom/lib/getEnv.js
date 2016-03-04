'use strict';

const consistentEnv = require('consistent-env');

const envPromise = consistentEnv.async()
  .catch(error => {
    atom.notifications.addError(error.message);
    throw error;
  });

module.exports = () => envPromise;
