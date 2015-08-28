'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');

module.exports = Base;

function Base () {
  this._store = {};
}
util.inherits(Base, EventEmitter);

Base.prototype.findOneById = function (id) {
  var self = this;
  return Promise.resolve()
    .then(function () {
      var o = self._store[id];
      if (!o) { throw new NotFoundError('Not found'); }
      return o;
    });
};

module.exports.NotFoundError = NotFoundError;

function NotFoundError (message) {
  Error.call(this, message);
}
util.inherits(NotFoundError, Error);

module.exports.NotModifiedError = NotModifiedError;

function NotModifiedError (message) {
  Error.call(this, message);
}
util.inherits(NotModifiedError, Error);
