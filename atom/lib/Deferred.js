'use strict';

class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = function promiseReject() {
        return reject.apply(this.promise, arguments);
      }.bind(this);

      this.resolve = function promiseResolve() {
        return resolve.apply(this.promise, arguments);
      }.bind(this);
    });

    this.then = function promiseThen() {
      return this.promise.then.apply(this.promise, arguments);
    }.bind(this);

    this.catch = function promiseCatch() {
      this.promise.catch.apply(this.promise, arguments);
    }.bind(this);
  }
}

module.exports = Deferred;
