'use strict';

var BaseStore = require('../../lib/models/base-store');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var before = lab.before;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

describe('Base Store', function () {
  var store;
  before(function (done) {
    store = new BaseStore();
    done();
  });

  describe('NotModifiedError', function () {
    it('should expose NotModifiedError', function (done) {
      expect(BaseStore.NotModifiedError).to.exist();
      expect(function () { new BaseStore.NotModifiedError(); })
        .not.to.throw();
      done();
    });
  });

  describe('findOneById', function () {
    before(function (done) {
      store._store[4] = { hello: 'world' };
      done();
    });

    it('should find something in it\'s store by id', function (done) {
      store.findOneById(4)
        .then(function (o) {
          expect(o).to.deep.equal({ hello: 'world' });
        })
        .finally(done);
    });

    it('should return NotFoundError if cannot find object', function (done) {
      store.findOneById(5)
        .then(function () {
          throw new Error('it should have returned NotFoundError');
        })
        .catch(function (err) {
          expect(err).to.be.an.instanceof(BaseStore.NotFoundError);
        })
        .finally(done);
    });
  });
});
