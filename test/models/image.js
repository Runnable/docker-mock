'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
var assert = chai.assert;

var Image = require('../../lib/models/image');

describe('Image', function () {
  it('should exist', function () {
    assert.doesNotThrow(function () { new Image({}); });
    assert.ok(new Image({}));
  });
});
