'use strict';

var setupModuleLoader = require('../src/loader');

beforeEach(function() {
  delete window.angular;
});

describe('setupModuleLoader', function() {

  it('exposes angular on the window', function() {
    setupModuleLoader(window);
    expect(window.angular).toBeDefined();
  });

  it('creates angular just once', function() {
    setupModuleLoader(window);
    var ng = window.angular;
    setupModuleLoader(window);
    expect(window.angular).toBe(ng);
  });

  it('exposes the angular module function', function() {
    setupModuleLoader(window);
    expect(window.angular.module).toBeDefined();
  });

  it('exposes the angular module function just once', function() {
    setupModuleLoader(window);
    var module = window.angular.module;
    setupModuleLoader(window);
    expect(window.angular.module).toBe(module);
  });

});

describe('modules', function() {

  beforeEach(function() {
    setupModuleLoader(window);
  });

  it('allows registering a module', function() {
    var myModule = window.angular.module('myModule', []);
    expect(myModule).toBeDefined();
    expect(myModule.name).toBe('myModule');
  });

  it('replaces a module when registered with the same name again', function() {
    var myModule = window.angular.module('myModule', []);
    var myNewModule = window.angular.module('myModule', []);
    expect(myModule).not.toBe(myNewModule);
  });

  it('attaches the requires array to the registered module', function() {
    var myModule = window.angular.module('myModule', ['myOtherModule']);
    expect(myModule.requires).toEqual(['myOtherModule']);
  });

  it('allows getting a module', function() {
    var myModule = window.angular.module('myModule', []);
    var gotModule = window.angular.module('myModule');

    expect(gotModule).toBeDefined();
    expect(gotModule).toBe(myModule);
  });

  it('throws when getting a non-existent module', function() {
    expect(function() {
      window.angular.module('myModule');
    }).toThrow();
  });

  it('does not allow a module to be called hasOwnProperty', function() {
    expect(function() {
      window.angular.module('hasOwnProperty', []);
    }).toThrow();
  });
});
