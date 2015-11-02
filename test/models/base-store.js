'use strict'

var chai = require('chai')
var assert = chai.assert

var BaseStore = require('../../lib/models/base-store')

describe('Base Store', function () {
  var store
  before(function () {
    store = new BaseStore()
  })

  describe('NotModifiedError', function () {
    it('should expose NotModifiedError', function () {
      assert.ok(BaseStore.NotModifiedError)
      assert.doesNotThrow(function () {
        return new BaseStore.NotModifiedError()
      })
      assert.ok(new BaseStore.NotModifiedError())
    })
  })

  describe('NotFoundError', function () {
    it('should expose NotFoundError', function () {
      assert.ok(BaseStore.NotFoundError)
      assert.doesNotThrow(function () {
        return new BaseStore.NotFoundError()
      })
      assert.ok(new BaseStore.NotFoundError())
    })
  })

  describe('findOneById', function () {
    before(function () {
      store._store[4] = { hello: 'world' }
    })

    it("should find something in it's store by id", function () {
      return assert.isFulfilled(store.findOneById(4))
        .then(function (o) {
          assert.deepEqual(o, { hello: 'world' })
        })
    })

    it('should return NotFoundError if cannot find object', function () {
      return assert.isRejected(store.findOneById(5), BaseStore.NotFoundError)
    })
  })
})
