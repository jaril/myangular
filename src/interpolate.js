'use strict';

var _ = require('lodash');

function $InterpolateProvider() {

  var startSymbol = '{{';
  var endSymbol = '}}';

  this.startSymbol = function(value) {
    if (value) {
      startSymbol = value;
      return this;
    } else {
      return startSymbol;
    }
  };

  this.endSymbol = function(value) {
    if (value) {
      endSymbol = value;
      return this;
    } else {
      return endSymbol;
    }
  };

  this.$get = ['$parse', function($parse) {
    var escapedStartMatcher =
      new RegExp(startSymbol.replace(/./g, escapeChar), 'g');
    var escapedEndMatcher =
      new RegExp(endSymbol.replace(/./g, escapeChar), 'g');

    function escapeChar(char) {
      return '\\\\\\' + char;
    }

    function unescapeText(text) {
      return text.replace(escapedStartMatcher, startSymbol)
        .replace(escapedEndMatcher, endSymbol);
    }

    function $interpolate(text, mustHaveExpressions) {
      var index = 0;
      var parts = [];
      var startIndex, endIndex, exp, expFn;
      var expressions = [];
      var expressionFns = [];
      var expressionPositions = [];
      while (index < text.length) {
        startIndex = text.indexOf(startSymbol, index);
        // endIndex = text.indexOf('}}', index);
        if (startIndex !== -1) {
          endIndex = text.indexOf(endSymbol, startIndex + startSymbol.length);
        }
        if (startIndex !== -1 && endIndex !== -1) {
          if (startIndex !== index) {
            parts.push(unescapeText(text.substring(index, startIndex)));
          }
          exp = text.substring(startIndex + startSymbol.length, endIndex);
          expFn = $parse(exp);
          expressions.push(exp);
          expressionFns.push(expFn);
          expressionPositions.push(parts.length);
          parts.push(expFn);
          index = endIndex + endSymbol.length;
        } else {
          parts.push(unescapeText(text.substring(index)));
          break;
        }
      }

      function stringify(value) {
        if (_.isNull(value) || _.isUndefined(value)) {
          return '';
        } else if (_.isObject(value)) {
          return JSON.stringify(value);
        } else {
          return '' + value;
        }
      }

      function compute(values) {
        //after compute, everything in parts is strings, no functions mixed in
        _.forEach(values, function(value, i) {
          parts[expressionPositions[i]] = stringify(value);
        });
        return parts.join('');
      }

      if (!mustHaveExpressions || expressions.length) {
        return _.extend(function interpolationFn(context) {
          var values = _.map(expressionFns, function(expressionFn) {
            return expressionFn(context);
          });
          //compute now only takes strings, need to pre-evaluate fns beforehand
          return compute(values);
        }, {
          expressions: expressions,
          $$watchDelegate: function(scope, listener) {
            var lastValue;
            return scope.$watchGroup(expressionFns, function(newValues, oldValues) {
              //no expressions to be concerned about since duplication is gone
              var newValue = compute(newValues);
              listener(
                newValue,
                (newValues === oldValues ? newValue : lastValue),
                scope
              );
              lastValue = newValue;
            });
          }
        });
      }
    }

    $interpolate.startSymbol = _.constant(startSymbol);
    $interpolate.endSymbol = _.constant(endSymbol);

    return $interpolate;

  }];

}

module.exports = $InterpolateProvider;
