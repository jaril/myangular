var _  = require('lodash');

function $QProvider() {

  this.$get = ['$rootScope', function ($rootScope) {
    function Promise() {
      this.$$state = {};
    }

    Promise.prototype.then = function(onFulfilled, onRejected, onProgress) {
      //onFulfilled is the callback to be called on resolve
      var result = new Deferred();
      this.$$state.pending = this.$$state.pending || [];
      this.$$state.pending.push([result, onFulfilled, onRejected, onProgress]);
      if (this.$$state.status > 0) {
        scheduleProcessQueue(this.$$state);
      }
      return result.promise;
    };

    Promise.prototype.catch = function(onRejected) {
      //this part works with or without return
      //why? and does it matter?
      return this.then(null, onRejected);
    };

    Promise.prototype.finally = function(callback, progressBack) {
      return this.then(function(value) {
          return handleFinallyCallback(callback, value, true);
        }, function(rejection) {
          return handleFinallyCallback(callback, rejection, false);
      }, progressBack);
    };

    function makePromise(value, resolved) {
      var d = new Deferred();
      if (resolved) {
        d.resolve(value);
      } else {
        d.reject(value);
      }
      return d.promise;
    }

    function handleFinallyCallback(callback, value, resolved) {
      var callbackValue = callback();
      //check if callbackValue returns a promise
      if (callbackValue && callbackValue.then) {
        return callbackValue.then(function() {
          return makePromise(value, resolved);
        });
      //for non promise callbackValues
      //to be passed straight on
      } else {
        return makePromise(value, resolved);
      }
    }

    function Deferred() {
      this.promise = new Promise();
    }

    Deferred.prototype.resolve = function(value) {
      //calls the pending promise with the value
      if (this.promise.$$state.status) {
        return;
      }
      if (value && _.isFunction(value.then)) { //if the function returns a promise
        value.then(
          _.bind(this.resolve, this),
          _.bind(this.reject, this),
          _.bind(this.notify, this)
        );
      } else {
        this.promise.$$state.value = value;
        this.promise.$$state.status = 1;
        scheduleProcessQueue(this.promise.$$state);
      }
    };

    Deferred.prototype.reject = function(reason) {
    if (this.promise.$$state.status) {
      return;
    }
    this.promise.$$state.value = reason;
    this.promise.$$state.status = 2;
    scheduleProcessQueue(this.promise.$$state);
    };

    Deferred.prototype.notify = function(progress) {
      var pending = this.promise.$$state.pending;
      //if there's still something pending callback
      // does not run if the promise is already resolved/rejected
      if (pending && pending.length && !this.promise.$$state.status) {
        $rootScope.$evalAsync(function() {
          _.forEach(pending, function(handlers) {
            var progressBack = handlers[3];
            var deferred = handlers[0];
            try {
              deferred.notify(_.isFunction(progressBack) ?
              progressBack(progress) :
              progress
              );
            } catch (e) {
              console.log(e);
            }
          });
        });
      }
    };

    function all(promises) {
      var results = _.isArray(promises) ? [] : {};
      counter = 0;
      var d = defer();
      _.forEach(promises, function(promise, index) {
        counter++;
        when(promise).then(function(value) {
          results[index] = value;
          counter--;
          if (!counter) {
            d.resolve(results);
          }
        }, function(rejection) {
          d.reject(rejection);
        });
      });
      if (!counter) {
        d.resolve(results);
      }
      return d.promise;
    }

    function defer() {
      return new Deferred();
    }

    function reject(rejection) {
      var d = defer();
      d.reject(rejection);
      return d.promise;
    }

    function when(value, callback, errback, progressback) {
      var d = defer();
      d.resolve(value);
      return d.promise.then(callback, errback, progressback);
    }

    function scheduleProcessQueue(state) {
      $rootScope.$evalAsync(function() {
        processQueue(state);
      });
    }

    function processQueue(state) {
      //state.pending is emptied out so callbacks are invoked only once
      //note: better to do this is in a try/finally block in case an error is thrown
      //bad pattern to delete the original pending array before finishing invoking all the callbacks
      var pending = state.pending;
      delete state.pending;
      _.forEach(pending, function(handlers) {
        var deferred = handlers[0];
        var fn = handlers[state.status];
        try {
          if (_.isFunction(fn)) {
            deferred.resolve(fn(state.value));
          } else if (state.status === 1) {
            deferred.resolve(state.value);
          } else {
            deferred.reject(state.value);
          }
        } catch (e) {
          deferred.reject(e);
        }
      });
    }

    var $Q = function Q(resolver) {
      if (!_.isFunction(resolver)) {
        throw 'Expected function, got ' + resolver + '!';
      }
      var d = defer();
      resolver(
        _.bind(d.resolve, d),
        _.bind(d.reject, d));
      return d.promise;
    };

    return _.assignIn($Q, {
      defer: defer,
      reject: reject,
      when: when,
      resolve: when,
      all: all
    });
  }];

}



module.exports = $QProvider;
