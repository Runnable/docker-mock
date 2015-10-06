'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;
var createCount = require('callback-count');

var StringStream = require('../../lib/utils/string-stream');

describe('string-stream', function () {
  it('should not allow passing it a string', function (done) {
    expect(function () { new StringStream({}); })
      .to.throw(Error, 'first argument must be a string');
    done();
  });
  it('should accept passing additional ops', function (done) {
    var ss = new StringStream('', { key: true });
    expect(ss).to.exist();
    done();
  });
  it('should work without passing opts', function (done) {
    var ss = new StringStream('');
    expect(ss).to.exist();
    done();
  });
  it('should output data', function (done) {
    var count = createCount(2, done);
    var ss = new StringStream('Hello, World!');
    ss.on('data', function (d) {
      expect(d).to.be.an.instanceof(Buffer);
      expect(d.toString()).to.equal('Hello, World!');
      count.next();
    });
    ss.on('end', count.next);
  });
});
