'use strict';

var _ = require('lodash');

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;

function createInjector(modulesToLoad, strictDi) {
  var providerCache = {};
  var instanceCache = {};
  var loadedModules = {};
  strictDi = (strictDi === true);

  var $provide = {
    constant: function(key, value) {
      if (key === 'hasOwnProperty') {
        throw 'hasOwnProperty is not a valid constant name';
      }
      instanceCache[key] = value;
    },
    provider: function(key, provider) {
      providerCache[key + 'Provider'] = provider;
    }
  };

  function invoke(fn, self, locals) {
    var args = _.map(annotate(fn), function(token) {
      if (_.isString(token)) {
          return locals && locals.hasOwnProperty(token) ?
            locals[token] :
            getService(token);
      } else {
        throw 'Incorrect injection token! Expected a string, got ' + token;
      }
    });
    if (_.isArray(fn)) {
      fn = _.last(fn);
    }
    return fn.apply(self, args);
  }

  function getService(name) {
    if (instanceCache.hasOwnProperty(name)) {
      return instanceCache[name];
    } else if (providerCache.hasOwnProperty(name + 'Provider')) {
      var provider = providerCache[name + 'Provider'];
      var instance = instanceCache[name] = invoke(provider.$get, provider);
      return instance;
    }
  }

  var annotate = function(fn) {
    if (_.isArray(fn)) {
      return fn.slice(0, fn.length - 1);
    } else if (fn.$inject) {
      return fn.$inject;
    } else if (!fn.length) {
      return [];
    } else {
      if (strictDi) {
        throw 'fn is not using explicit annotation and ' +
          'cannot be invoked in strict mode';
      }
      var source = fn.toString().replace(STRIP_COMMENTS, '');
      var argDeclaration = source.match(FN_ARGS);
      return _.map(argDeclaration[1].split(','), function(argName) {
        return argName.match(FN_ARG)[2];
        // return argName.trim();
      });
    }
  };

  function instantiate(Type, locals) {
    var unwrappedType = _.isArray(Type) ? _.last(Type) : Type;
    var instance = Object.create(unwrappedType.prototype);
    invoke(Type, instance, locals);
    return instance;
  }

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
      return instanceCache.hasOwnProperty(key) ||
        providerCache.hasOwnProperty(key + 'Provider');
    },
    get: getService,
    invoke: invoke,
    annotate: annotate,
    instantiate: instantiate
  };
}

module.exports = createInjector;
