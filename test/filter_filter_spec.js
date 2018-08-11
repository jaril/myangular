'use strict';

var parse = require('../src/parse');
var filter = require('../src/filter').filter;

describe('filter filter', function() {

  it('is available', function() {
    expect(filter('filter')).toBeDefined();
  });

  it('can filter an array with a predicate function', function() {
    var fn = parse('[1, 2, 3, 4] | filter:isOdd');
    var scope = {
      isOdd: function(n) {
        return n % 2 !== 0;
      }
    };
    expect(fn(scope)).toEqual([1, 3]);
  });

  it('can filter an array of strings with a string', function() {
    var fn = parse('arr | filter:"a"');
    expect(fn({arr: ["a", "b", "a"]})).toEqual(['a', 'a']);
  });
});
