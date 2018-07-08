
// Scope constructor function which is just a regular Object constructor

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
}

function initWatchVal() {}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!(valueEq),
    last: initWatchVal
  };

  this.$$lastDirtyWatch = null;
  this.$$watchers.push(watcher);
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var newValue, oldValue, dirty;

  _.forEach(this.$$watchers, function(watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;
    if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
      self.$$lastDirtyWatch = watcher;
      watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue) //clone deep creates a deep clone, instead of having the same reference which would ===
      watcher.listenerFn(newValue,
        (oldValue === initWatchVal ? newValue : oldValue),
        self);
      dirty = true;
    } else if (self.$$lastDirtyWatch === watcher){ //case where the value is no longer dirty
      return false;
    }
  });

  return dirty;
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$$lastDirtyWatch = null; //set to null at the beginning of every digest

  do { // runs this at least once
    dirty = this.$$digestOnce();
    if (dirty && !(ttl--)) { // will throw when both values = true. when ttl-- = -1, !-1 is true. ie throws after 10 repeats
      throw "10 digest iterations reached";
    }
  } while (dirty);
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue ||
      (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue)) //if first value falsy, check both values if NaN. if true, return true
  }
};

//$eval calls function expr and passes scope and locals as its arguments
Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

//calls $eval and starts $digest
//run debugger on this
Scope.prototype.$apply = function(expr) {
  try {
    return this.$eval(expr);
  } finally {
    this.$digest();
  }
};

module.exports = Scope;
