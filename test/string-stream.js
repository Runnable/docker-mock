'use strict';

var StringStream = require('../lib/string-stream');

var Code = require('code');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

describe('string-stream', function () {
  it('should not allow passing it a string', function (done) {
    var ss;
    try {
      ss = new StringStream({});
    } catch (err) {
      expect(err.message).to.contain('must be a string');
      return done();
    }
    done(new Error('string-stream should have thrown an error'));
  });
  it('should accept passing additional ops', function (done) {
    var ss;
    try {
      ss = new StringStream('', { key: true });
    } catch (err) {
      return done(err);
    }
    done();
  });
  it('should work without passing opts', function (done) {
    var ss;
    try {
      ss = new StringStream('');
    } catch (err) {
      return done(err);
    }
    done();
  });
});
