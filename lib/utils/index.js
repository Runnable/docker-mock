'use strict';

var crypto = require('crypto');

module.exports = {
  _pid: 0,
  _port: 0,
  randomId: function () { return crypto.randomBytes(32).toString('hex'); },
  newPid: function () { return module.exports._pid++; },
  newPort: function () { return module.exports._port++; }
};
