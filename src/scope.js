
// Scope constructor function which is just a regular Object constructor

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
}

function initWatchVal() {};

Scope.prototype.$watch = function(watchFn, listenerFn) {
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    last: initWatchVal
  };

  this.$$watchers.push(watcher);
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var newValue, oldValue, dirty;

  _.forEach(this.$$watchers, function(watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;
    if (newValue !== oldValue) {
      watcher.last = newValue;
      watcher.listenerFn(newValue,
        (oldValue === initWatchVal ? newValue : oldValue),
        self);
      dirty = true;
    }
  });

  return dirty;
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  do { // runs this at least once
    dirty = this.$$digestOnce();
    if (dirty && !(ttl--)) { // will throw when both values = true. when ttl-- = -1, !-1 is true. ie throws after 10 repeats
      throw "10 digest iterations reached";
    }
  } while (dirty);
}

module.exports = Scope;
