function $QProvider() {

  this.$get = function() {

    function Promise() {
    }

    function Deferred() {
      this.promise = new Promise();
    }

    function defer() {
      return new Deferred();
    }

    return {
      defer: defer
    };

  };

}

module.exports = $QProvider;
