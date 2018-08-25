var setupModuleLoader = require('./loader');

function publishExternalAPI() {
  'use strict';

  setupModuleLoader(window);

  var ngModule = angular.module('ng', []);
  ngModule.provider('$filter', require('./filter'));
  ngModule.provider('$parse', require('./parse'));
  ngModule.provider('$rootScope', require('./scope'));
}

module.exports = publishExternalAPI;
