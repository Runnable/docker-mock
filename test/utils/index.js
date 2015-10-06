'use strict';

var utils = require('../../lib/utils');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

describe('utils', function () {
  describe('randomId', function () {
    it('should always return a 32 bit string in hex', function (done) {
      // just check 10, for kicks
      var seen = [];
      for (var i = 0; i < 10; ++i) {
        var id = utils.randomId();
        expect(seen.indexOf(id)).to.equal(-1);
        seen.push(id);
      }
      done();
    });
  });

  describe('newPid', function () {
    it('should always return a new integer pid', function (done) {
      // just check 10, for kicks
      var seen = [];
      for (var i = 0; i < 10; ++i) {
        var id = utils.newPid();
        expect(seen.indexOf(id)).to.equal(-1);
        seen.push(id);
      }
      done();
    });
  });

  describe('newPort', function () {
    it('should always return a new integer port', function (done) {
      // just check 10, for kicks
      var seen = [];
      for (var i = 0; i < 10; ++i) {
        var id = utils.newPort();
        expect(seen.indexOf(id)).to.equal(-1);
        seen.push(id);
      }
      done();
    });
  });

  describe('capitalize', function () {
    it('should capitalize strings', function (done) {
      expect(utils.capitalize('foo')).to.equal('Foo');
      expect(utils.capitalize('Bar')).to.equal('Bar');
      expect(utils.capitalize('BAR')).to.equal('BAR');
      done();
    });
    it('should do nothing to not a string', function (done) {
      var obj = {};
      expect(utils.capitalize(obj)).to.equal(obj);
      expect(utils.capitalize([])).to.deep.equal([]);
      expect(utils.capitalize(3)).to.deep.equal(3);
      done();
    });
  });
});
