var crypto = require('crypto');
var join = require('path').join;

module.exports = {
  randomId: function () {
    return crypto.randomBytes(32).toString('hex');
  },
  combine: function (req, res, next) {
    if (req.params.namespace && req.params.repository) {
      req.params.repository = join(req.params.namespace, req.params.repository);
    }
    next();
  }
};
