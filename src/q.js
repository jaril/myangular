function $QProvider() {

  this.$get = ['$rootScope', function ($rootScope) {
    function Promise() {
      this.$$state = {};
    }

    Promise.prototype.then = function(onFulfilled) {
      //onFulfilled is the callback to be called on resolve
      this.$$state.pending = onFulfilled;
    };

    function Deferred() {
      this.promise = new Promise();
    }

    Deferred.prototype.resolve = function(value) {
      //calls the pending promise with the value
      this.promise.$$state.value = value;
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
      state.pending(state.value);
    }

    return {
      defer: defer
    };
  }];

}



module.exports = $QProvider;
