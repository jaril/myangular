'use strict';

var _ = require('lodash');

function $ControllerProvider() {

  var controllers = {};
  var globals = false;

  function addToScope(locals, identifier, instance) {
    if (locals && _.isObject(locals.$scope)) {
      locals.$scope[identifier] = instance;
    } else {
      throw 'Cannot export controller as ' + identifier +
        '! No $scope object provided via locals';
    }
  }

  this.allowGlobals = function() {
    globals = true;
  };

  this.register = function(name, controller) {
    if (_.isObject(name)) {
      _.extend(controllers, name);
    } else {
      controllers[name] = controller;
    }
  };

  this.$get = ['$injector', function($injector) {
    return function(ctrl, locals, later, identifier) { //the provider returns a function
      if (_.isString(ctrl)) {
        if (controllers.hasOwnProperty(ctrl)) {
          ctrl = controllers[ctrl];
        } else if (globals) {
          ctrl = window[ctrl];
        }
      }

      // var instance = $injector.instantiate(ctrl, locals);
      var instance;
      if (later) {
        var ctrlConstructor = _.isArray(ctrl) ? _.last(ctrl) : ctrl;
        instance = Object.create(ctrlConstructor.prototype);
        if (identifier) {
          addToScope(locals, identifier, instance);
        }
        return _.extend(function() {
          $injector.invoke(ctrl, instance, locals);
          return instance;
        }, {
          instance: instance
        });
      } else {
        instance = $injector.instantiate(ctrl, locals);
        if (identifier) {
          //pass locals since scope reference is a locals property
          addToScope(locals, identifier, instance)
        }

        return instance; //the function is $controller, return obj
      }
    };
  }];

}

module.exports = $ControllerProvider;
