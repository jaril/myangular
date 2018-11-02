'use strict';

var _ = require('lodash');

function $InterpolateProvider() {

  this.$get = ['$parse', function($parse) {

    function $interpolate(text, mustHaveExpressions) {
      var index = 0;
      var parts = [];
      var startIndex, endIndex, exp, expFn;
      var expressions = [];
      var expressionFns = [];
      var expressionPositions = [];
      while (index < text.length) {
        startIndex = text.indexOf('{{', index);
        // endIndex = text.indexOf('}}', index);
        if (startIndex !== -1) {
          endIndex = text.indexOf('}}', startIndex + 2);
        }
        if (startIndex !== -1 && endIndex !== -1) {
          if (startIndex !== index) {
            parts.push(unescapeText(text.substring(index, startIndex)));
          }
          exp = text.substring(startIndex + 2, endIndex);
          expFn = $parse(exp);
          expressions.push(exp);
          expressionFns.push(expFn);
          expressionPositions.push(parts.length);
          parts.push(expFn);
          index = endIndex + 2;
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

      function unescapeText(text) {
        return text.replace(/\\{\\{/g, '{{')
          .replace(/\\}\\}/g, '}}');
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

    return $interpolate;

  }];

}

module.exports = $InterpolateProvider;
