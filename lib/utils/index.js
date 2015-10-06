'use strict';

var crypto = require('crypto');
var isString = require('101/is-string');

module.exports = {
  _pid: 0,
  _port: 0,
  randomId: function () { return crypto.randomBytes(32).toString('hex'); },
  newPid: function () { return module.exports._pid++; },
  newPort: function () { return module.exports._port++; },
  capitalize: function (str) {
    if (!isString(str)) { return str; }
    return str.slice(0,1).toUpperCase() + str.slice(1);
  }
};
