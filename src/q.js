var _  = require('lodash');

function $QProvider() {

  this.$get = ['$rootScope', function ($rootScope) {
    function Promise() {
      this.$$state = {};
    }

    Promise.prototype.then = function(onFulfilled, onRejected) {
      //onFulfilled is the callback to be called on resolve
      var result = new Deferred();
      this.$$state.pending = this.$$state.pending || [];
      this.$$state.pending.push([result, onFulfilled, onRejected]);
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

    Promise.prototype.finally = function(callback) {
      return this.then(function(value) {
          return handleFinallyCallback(callback, value, true);
        }, function(rejection) {
          return handleFinallyCallback(callback, rejection, false);
      });
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
          _.bind(this.reject, this)
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

    function defer() {
      return new Deferred();
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

    return {
      defer: defer
    };
  }];

}



module.exports = $QProvider;