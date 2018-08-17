'use strict';

var _ = require('lodash');

function createInjector(modulesToLoad) {
  var cache = {};
  var loadedModules = {};

  var $provide = {
    constant: function(key, value) {
      if (key === 'hasOwnProperty') {
        throw 'hasOwnProperty is not a valid constant name';
      }
      cache[key] = value;
    }
  };

  var invoke = function(fn, self, locals) {
    var args = _.map(fn.$inject, function(token) {
      if (_.isString(token)) {
          return locals && locals.hasOwnProperty(token) ?
            locals[token] :
            cache[token];
      } else {
        throw 'Incorrect injection token! Expected a string, got ' + token;
      }
    });
    return fn.apply(self, args);
  };

  var annotate = function(fn) {
    if (_.isArray(fn)) {
      return fn.slice(0, fn.length - 1);
    } else {
      return fn.$inject;
    }
  };

  _.forEach(modulesToLoad, function loadModule(moduleName) {
    if (!loadedModules.hasOwnProperty(moduleName)) {
      loadedModules[moduleName] = true;
      var module = window.angular.module(moduleName);
      _.forEach(module.requires, loadModule);
      _.forEach(module._invokeQueue, function(invokeArgs) {
        var method = invokeArgs[0];
        var args = invokeArgs[1];
        $provide[method].apply($provide, args);
      });
    }
  });

  return {
    has: function(key) {
      return cache.hasOwnProperty(key);
    },
    get: function(key) {
      return cache[key];
    },
    invoke: invoke,
    annotate: annotate
  };
}

module.exports = createInjector;
