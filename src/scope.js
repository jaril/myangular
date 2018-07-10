
// Scope constructor function which is just a regular Object constructor

var _ = require('lodash');

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$applyAsyncId = null;
  this.$$postDigestQueue = [];
  this.$$phase = null;
}

function initWatchVal() {}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var self = this;
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!(valueEq),
    last: initWatchVal
  };

  this.$$lastDirtyWatch = null;
  this.$$watchers.unshift(watcher);

  return function() {
    var index = self.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$$lastDirtyWatch = null;
    }
  }
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var newValue, oldValue, dirty;

  _.forEachRight(this.$$watchers, function(watcher) {
    try {
      if (watcher) {
        newValue = watcher.watchFn(self);
        oldValue = watcher.last;
        if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
          self.$$lastDirtyWatch = watcher;
          watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue); //clone deep creates a deep clone, instead of having the same reference which would ===
          watcher.listenerFn(newValue,
            (oldValue === initWatchVal ? newValue : oldValue),
            self);
          dirty = true;
        } else if (self.$$lastDirtyWatch === watcher){ //case where the value is no longer dirty
          return false;
        }
      }
    } catch (e) {
      console.error(e);
    }
  });
  return dirty;
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$$lastDirtyWatch = null; //set to null at the beginning of every digest
  this.$beginPhase("$digest"); // starting digest phase

  //if there's a timeout set and digest gets called, flush the timeout
  if (this.$$applyAsyncId) {
    clearTimeout(this.$$applyAsyncId);
    this.$$flushApplyAsync();
  }

  do { // runs this at least once
    while (this.$$asyncQueue.length) {
      try {
        var aSyncTask = this.$$asyncQueue.shift();
        aSyncTask.scope.$eval(aSyncTask.expression);
      } catch (e) {
        console.error(e);
      }
    }
    dirty = this.$$digestOnce();
    if ((dirty || this.$$asyncQueue.length) && !(ttl--)) { // will throw when both values = true. when ttl-- = -1, !-1 is true. ie throws after 10 repeats
      throw "10 digest iterations reached";
    }
  } while (dirty || this.$$asyncQueue.length);

  while (this.$$postDigestQueue.length) {
    try {
      this.$$postDigestQueue.shift()();
    } catch (e) {
      console.error(e);
    }
  }

  this.$clearPhase();
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue ||
      (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue)); //if first value falsy, check both values if NaN. if true, return true
  }
};

//$eval calls function expr and passes scope and locals as its arguments
Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

//calls $eval and starts $digest
//run debugger on this
//do all the functions passed into apply have to take as argument scope??
Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase("$apply");
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$digest();
  }
};

Scope.prototype.$evalAsync = function(expr) {
  //note: the new aSyncTask is assigned as properrty the scope, and can access the scope methods from there
  var self = this;
  if (!self.$$phase && !self.$$asyncQueue.length) { //at time of execution, if a digest isnt going on and there's nothing in the queue
    setTimeout(function() { //something should digest this at some point, but in cast it doesnt, set a reminder to check later
      if(self.$$asyncQueue.length) { //if there is something in the queue at that point
        self.$digest(); //run digest()
      }
    }, 0);
  }
  self.$$asyncQueue.push({scope: this, expression: expr});
};

Scope.prototype.$beginPhase = function(phase) {
  if (this.$$phase) {
    throw this.$$phase + " already in progress";
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
  this.$$phase = null;
};

Scope.prototype.$applyAsync = function(expr) {
  var self = this;
  self.$$applyAsyncQueue.push(function() {
    self.$eval(expr);
  });
  if (self.$$applyAsyncId === null) {
    self.$$applyAsyncId = setTimeout(function() {
        self.$apply(_.bind(self.$$flushApplyAsync, self));
    }, 0);
  }
};

Scope.prototype.$$flushApplyAsync = function() {
  while (this.$$applyAsyncQueue.length) {
    try {
      this.$$applyAsyncQueue.shift()();
    } catch (e) {
      console.error(e);
    }
  }
  this.$$applyAsyncId = null;
};

Scope.prototype.$$postDigest = function(fn) {
  this.$$postDigestQueue.push(fn);
}
module.exports = Scope;
