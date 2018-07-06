var sayHello = require('../src/hello');

console.log('check');

describe("Hello", function() {

  it("says hello", function() {
    expect(sayHello('world')).toBe("Hello, world!");
  });

});
