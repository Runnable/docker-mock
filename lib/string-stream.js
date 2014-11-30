var ReadableStream = require('stream').Readable;

module.exports = StringStream;

function StringStream (str, opts) {
  if (typeof str !== 'string') { throw new Error('str must be a string'); }
  this.str = str;
  ReadableStream.call(this, opts || {});
}

require('util').inherits(StringStream, ReadableStream);

StringStream.prototype._read = function () {
  var self = this;
  setTimeout(function () {
    self.push(self.str);
    self.str = null;
  }, 10);
};
