'use strict';

var chai = require('chai');
var assert = chai.assert;

var createCount = require('callback-count');

var StringStream = require('../../lib/utils/string-stream');

describe('string-stream', function () {
  it('should not allow passing it a string', function () {
    assert.throws(
      function () { new StringStream({}); },
      Error,
      'first argument must be a string'
    );
  });
  it('should accept passing additional ops', function () {
    var ss = new StringStream('', { key: true });
    assert.ok(ss);
  });
  it('should work without passing opts', function () {
    var ss = new StringStream('');
    assert.ok(ss);
  });
  it('should output data', function (done) {
    var count = createCount(2, done);
    var ss = new StringStream('Hello, World!');
    ss.on('data', function (d) {
      assert.instanceOf(d, Buffer);
      assert.equal(d.toString(), 'Hello, World!');
      count.next();
    });
    ss.on('end', count.next);
  });
});
