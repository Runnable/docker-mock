'use strict'

var chai = require('chai')
var assert = chai.assert

var Image = require('../../lib/models/image')

describe('Image', function () {
  it('should exist', function () {
    assert.doesNotThrow(function () { return new Image({}) })
    assert.ok(new Image({}))
  })
})
