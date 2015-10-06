'use strict';

var Image = require('../../lib/models/image');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

describe('Image', function () {
  it('should exist', function (done) {
    expect(function () { new Image({}); }).to.not.throw();
    done();
  });
});
