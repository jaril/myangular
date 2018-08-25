'use strict';

var _ = require('lodash');

function $FilterProvider($provide) {

  var filters = {};

  this.register = function(name, factory) {
    if (_.isObject(name)) {
      return _.map(name, function(factory, name) { //factory->name because value->index/key
        return this.register(name, factory);
      }.bind(this)); //bind(this)
    } else {
      return $provide.factory(name + 'Filter', factory);
      // var filter = factory();
      // filters[name] = filter;
      // return filter;
    }
  };

  // this.$get = function() {
  //   return function filter(name) {
  //     return filters[name];
  //   };
  // };
  this.$get = ['$injector', function($injector) {
    return function filter(name) {
      return $injector.get(name + 'Filter');
    };
  }];

  this.register('filter', require('./filter_filter')); //immediately register filter filter

}

$FilterProvider.$inject = ['$provide'];

module.exports = $FilterProvider;
