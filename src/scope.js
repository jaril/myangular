
// Scope constructor function which is just a regular Object constructor

var _ = require('lodash');
var parse = require('./parse');

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$applyAsyncId = null;
  this.$$postDigestQueue = [];
  this.$root = this;
  this.$$children = [];
  this.$$phase = null;
  this.$$listeners = {};
}

function initWatchVal() {}

function isArrayLike(obj) {
  if (_.isNull(obj) || _.isUndefined(obj)) {
    return false;
  }
  var length = obj.length;
  return length === 0 ||
    (_.isNumber(length) && length > 0 && (length - 1) in obj);
}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var self = this;

  watchFn = parse(watchFn);

  if (watchFn.$$watchDelegate) {
    return watchFn.$$watchDelegate(self, listenerFn, valueEq, watchFn)
  }
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!(valueEq),
    last: initWatchVal
  };

  this.$root.$$lastDirtyWatch = null;
  this.$$watchers.unshift(watcher);

  return function() {
    var index = self.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$root.$$lastDirtyWatch = null;
    }
  };
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var continueLoop = true;
  var dirty;

  //runs at least once for the scope, which calls it on its $$children
  //on second run, it provides falsy value if no longer dirty
  //self changed to scope as this value, scope referring to the current Scope
  //self binding is reserved for the parent $$digestOnce is called on
  this.$$everyScope(function(scope) {
    var newValue, oldValue;
    _.forEachRight(scope.$$watchers, function(watcher) {
      try {
        if (watcher) {
          newValue = watcher.watchFn(scope);
          oldValue = watcher.last;
          if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            self.$root.$$lastDirtyWatch = watcher;
            watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue); //clone deep creates a deep clone, instead of having the same reference which would ===
            watcher.listenerFn(newValue,
              (oldValue === initWatchVal ? newValue : oldValue),
              scope);
            dirty = true;
          } else if (self.$root.$$lastDirtyWatch === watcher){ //case where the value is no longer dirty
            continueLoop = false;
            return false;
          }
        }
      } catch (e) {
        console.error(e);
      }
    });
    return continueLoop;
  });
  return dirty;
};

Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$root.$$lastDirtyWatch = null; //set to null at the beginning of every digest
  this.$beginPhase("$digest"); // starting digest phase

  //if there's a timeout set and digest gets called, flush the timeout
  if (this.$root.$$applyAsyncId) {
    clearTimeout(this.$root.$$applyAsyncId);
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
  return parse(expr)(this, locals);
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
    this.$root.$digest();
  }
};

Scope.prototype.$evalAsync = function(expr) {
  //note: the new aSyncTask is assigned as properrty the scope, and can access the scope methods from there
  var self = this;
  if (!self.$$phase && !self.$$asyncQueue.length) { //at time of execution, if a digest isnt going on and there's nothing in the queue
    setTimeout(function() { //something should digest this at some point, but in cast it doesnt, set a reminder to check later
      if(self.$$asyncQueue.length) { //if there is something in the queue at that point
        self.$root.$digest(); //run digest()
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
  if (self.$root.$$applyAsyncId === null) {
    self.$root.$$applyAsyncId = setTimeout(function() {
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
  this.$root.$$applyAsyncId = null;
};

Scope.prototype.$$postDigest = function(fn) {
  this.$$postDigestQueue.push(fn);
};

Scope.prototype.$watchGroup = function(watchFns, listenerFn) {
  var self = this;
  var newValues = new Array(watchFns.length);
  var oldValues = new Array(watchFns.length);
  var changeReactionScheduled = false;
  var firstRun = true;

  if(watchFns.length === 0) {
    var shouldCall = true;
    self.$evalAsync(function() {
      if (shouldCall) {
        listenerFn(newValues, newValues, self);
      }
    });
    return function() {
      //short circuits the function and returns a function that changes flag to false
      //first time an empty array gets passed into watchgroup, it calls its listenerFn later
      //second time, it just returns and changes shouldCall to false
      //this way listener doesn't get called when it's already gone
      shouldCall = false;
    };
  }

  function watchGroupListener() {
    //firstRun to mimic the same implementation of listenerFn called within $digestOnce l50
    if (firstRun) {
      firstRun = false;
      listenerFn(newValues, newValues, self);
    } else {
      listenerFn(newValues, oldValues, self);
    }
    changeReactionScheduled = false;
  }

  var destroyFunctions = _.map(watchFns, function(watchFn, i) {
    return self.$watch(watchFn, function(newValue, oldValue) {
      newValues[i] = newValue;
      oldValues[i] = oldValue;
      if (!changeReactionScheduled) {
        changeReactionScheduled = true;
        self.$evalAsync(watchGroupListener);
      }
    });
  });

  return function() {
    _.forEach(destroyFunctions, function(destroyFunction) {
      destroyFunction();
    });
  };
};

Scope.prototype.$new = function(isolated, parent) {
  var child;
  parent = parent || this;
  if (isolated) {
    child = new Scope();
    child.$root = parent.$root;
    child.$$asyncQueue = parent.$$asyncQueue;
    child.$$postDigestQueue = parent.$$postDigestQueue;
    child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
  } else {
    var ChildScope = function() { };
    ChildScope.prototype = this;
    child = new ChildScope();
  }
  parent.$$children.push(child);
  child.$$watchers = [];
  child.$$listeners = {};
  child.$$children = [];
  child.$parent = parent;
  return child;
};

Scope.prototype.$$everyScope = function(fn) {
  //this value is the current scope
  //runs the anonymous function provided in $digestOnce
  if (fn(this)) {
    return this.$$children.every(function(child) {
      return child.$$everyScope(fn);
    });
  //will only run this case if falsy
  //happens when the return value (continueLoop) is false
  } else {
    return false;
  }
};

Scope.prototype.$destroy = function() {
  this.$broadcast('$destroy');
  if (this.$parent) {
    var siblings = this.$parent.$$children;
    var indexOfThis = siblings.indexOf(this);
    if (indexOfThis >= 0) {
      siblings.splice(indexOfThis, 1);
    }
  }
  this.$$watchers = null;
  this.$$listeners = {};
};

Scope.prototype.$watchCollection = function(watchFn, listenerFn) {
  var self = this;
  var newValue, oldValue;
  var changeCount = 0;
  var oldLength;
  var veryOldValue;
  var trackVeryOldValue = (listenerFn.length > 1);
  var firstRun = true;

  watchFn = parse(watchFn);

  var internalwatchFn = function(scope) {
    var newLength;
    newValue = watchFn(scope);

    if (_.isObject(newValue)) {
      if (isArrayLike(newValue)) {
        if (!_.isArray(oldValue)) {
          changeCount++;
          oldValue = [];
        }
        if (newValue.length !== oldValue.length) {
          changeCount++;
          oldValue.length = newValue.length;
        }
        _.forOwn(newValue, function(newItem, i) {
          var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);

          if (!bothNaN && newItem !== oldValue[i]) {
            changeCount++;
            oldValue[i] = newItem;
          }
        });
        //if object
      } else {
        if (!_.isObject(oldValue) || isArrayLike(oldValue)) {
          changeCount ++;
          oldValue = {};
          oldLength = 0;
        }
        newLength = 0;
        _.forOwn(newValue, function(newVal, key) {
          newLength++;
          if (oldValue.hasOwnProperty(key)) {
            var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
            if (!bothNaN && oldValue[key] !== newVal) {
              changeCount++;
              oldValue[key] = newVal;
            }
          } else {
            changeCount++;
            oldLength++;
            oldValue[key] = newVal;
          }
        });
        if (oldLength > newLength) {
          changeCount++;
          _.forOwn(oldValue, function(oldVal, key) {
            if (!newValue.hasOwnProperty(key)) {
              oldLength--;
              delete oldValue[key];
            }
          });
        }
      }
    //if !object
    } else {
      if (!self.$$areEqual(oldValue, newValue, false)) {
        changeCount++;
      }
      oldValue = newValue;
    }

    return changeCount;
  };

  var internalListenerFn = function() {
    if (firstRun) {
      listenerFn(newValue, newValue, self);
      firstRun = false;
    } else {
      listenerFn(newValue, veryOldValue, self);
    }

    if(trackVeryOldValue) {
      veryOldValue = _.clone(newValue);
    }
  };

  return this.$watch(internalwatchFn, internalListenerFn);
};

Scope.prototype.$on = function(eventName, listener) {
  var listeners = this.$$listeners[eventName];
  if (!listeners) {
    this.$$listeners[eventName] = listeners = [];
  }

  listeners.push(listener);

  return function() {
    var index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners[index] = null;
    }
  };
};

Scope.prototype.$emit = function(eventName) {
  var propagationStopped = false;

  var event = {
    name: eventName,
    targetScope: this,
    stopPropagation: function() {
      propagationStopped = true;
    },
    preventDefault: function() {
      this.defaultPrevented = true;
    }
  };
  // _.rest() no longer does what we used to want it to, implemented this differently
  var additionalArgs = Array.prototype.slice.call(arguments, 1);
  Array.prototype.shift.call(this, additionalArgs);
  var listenerArgs = [event].concat(additionalArgs);
  var scope = this;

  do {
    event.currentScope = scope;
    scope.$$fireEventOnScope(eventName, listenerArgs);
    scope = scope.$parent;
  } while (scope && !propagationStopped);

  event.currentScope = null;
  return event;
};

Scope.prototype.$broadcast = function(eventName) {
  var event = {
    name: eventName,
    targetScope: this,
    preventDefault: function() {
      this.defaultPrevented = true;
    }};
  // _.rest() no longer does what we used to want it to, implemented this differently
  var additionalArgs = Array.prototype.slice.call(arguments, 1);
  Array.prototype.shift.call(this, additionalArgs);
  var listenerArgs = [event].concat(additionalArgs);

  this.$$everyScope(function(scope) {
    event.currentScope = scope;
    scope.$$fireEventOnScope(eventName, listenerArgs);
    return true;
  });

  event.currentScope = null;
  return event;
};

Scope.prototype.$$fireEventOnScope = function(eventName, listenerArgs) {
  var listeners = this.$$listeners[eventName] || [];

  var i = 0;

  //this implementation doesnt skip the listener after a removed listener
  //because it doesn't i++ unless the previous listener was !null
  while (i < listeners.length) {
    if (listeners[i] === null) {
      listeners.splice(i, 1);
    }  else {
      try {
        listeners[i].apply(null, listenerArgs);
      } catch (e) {
        console.error(e);
      } finally {
        i++;
      }
    }
  }
};

module.exports = Scope;
