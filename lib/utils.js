'use strict';

var crypto = require('crypto');

module.exports = {
  randomId: function () {
    return crypto.randomBytes(32).toString('hex');
  }
};
