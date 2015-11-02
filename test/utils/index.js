'use strict'

var chai = require('chai')
var assert = chai.assert

var utils = require('../../lib/utils')

describe('utils', function () {
  describe('randomId', function () {
    it('should always return a 32 bit string in hex', function () {
      // just check 10, for kicks
      var seen = []
      for (var i = 0; i < 10; ++i) {
        var id = utils.randomId()
        assert.notInclude(seen, id)
        seen.push(id)
      }
    })
  })

  describe('newPid', function () {
    it('should always return a new integer pid', function () {
      // just check 10, for kicks
      var seen = []
      for (var i = 0; i < 10; ++i) {
        var id = utils.newPid()
        assert.notInclude(seen, id)
        seen.push(id)
      }
    })
  })

  describe('newPort', function () {
    it('should always return a new integer port', function () {
      // just check 10, for kicks
      var seen = []
      for (var i = 0; i < 10; ++i) {
        var id = utils.newPort()
        assert.notInclude(seen, id)
        seen.push(id)
      }
    })
  })

  describe('capitalize', function () {
    it('should capitalize strings', function () {
      assert.equal(utils.capitalize('foo'), 'Foo')
      assert.equal(utils.capitalize('Bar'), 'Bar')
      assert.equal(utils.capitalize('BAR'), 'BAR')
    })
    it('should do nothing to not a string', function () {
      var obj = {}
      assert.deepEqual(utils.capitalize(obj), obj)
      assert.deepEqual(utils.capitalize([]), [])
      assert.deepEqual(utils.capitalize(3), 3)
    })
  })
})
