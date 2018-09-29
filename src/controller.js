'use strict';

var _ = require('lodash');

function $ControllerProvider() {

  var controllers = {};

  this.register = function(name, controller) {
    if (_.isObject(name)) {
      _.extend(controllers, name);
    } else {
      controllers[name] = controller;
    }
  };

  this.$get = ['$injector', function($injector) {
    return function(ctrl, locals) { //the provider returns a function
      if (_.isString(ctrl)) {
        ctrl = controllers[ctrl];
      }
      return $injector.instantiate(ctrl, locals); //the function is $controller, return obj
    };
  }];

}

module.exports = $ControllerProvider;
