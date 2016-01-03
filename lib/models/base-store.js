'use strict'

var util = require('util')
var EventEmitter = require('events').EventEmitter
var Promise = require('bluebird')

module.exports = Base
Base.NotFoundError = NotFoundError
Base.NotModifiedError = NotModifiedError
Base.ConflictError = ConflictError

function Base () {
  this._store = {}
}
util.inherits(Base, EventEmitter)

Base.prototype.findOneById = function (id) {
  var self = this
  return Promise.resolve()
    .then(function () {
      var o = self._store[id]
      if (!o) { throw new NotFoundError('Not found') }
      return o
    })
}

function NotFoundError (message) {
  Error.call(this, message)
  this.message = message
}
util.inherits(NotFoundError, Error)

function NotModifiedError (message) {
  Error.call(this, message)
  this.message = message
}
util.inherits(NotModifiedError, Error)

function ConflictError (message) {
  Error.call(this)
  this.message = message
  this.statusCode = 409
}
util.inherits(ConflictError, Error)
