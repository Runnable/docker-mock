'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
var assert = chai.assert;

var assign = require('101/assign');
var ImageStore = require('../../lib/models/image-store');
var NotFoundError = require('../../lib/models/base-store').NotFoundError;

describe('Image Store', function () {
  var images;
  var image;
  beforeEach(function () {
    image = assign({}, { Id: '4' });
    images = new ImageStore();
    images._store['4'] = image;
    images._tags['ubuntu:latest'] = '4';
  });

  describe('findOneByName', function () {
    it('should find an image by name', function () {
      assert.isFulfilled(images.findOneByName('ubuntu'))
        .then(function (o) { assert.deepEqual(o, image); });
    });
    it('should find an image by name with tag', function () {
      assert.isFulfilled(images.findOneByName('ubuntu:latest'))
        .then(function (o) { assert.deepEqual(o, image); });
    });
    it('should find an image by id', function () {
      assert.isFulfilled(images.findOneByName('4'))
        .then(function (o) { assert.deepEqual(o, image); });
    });

    it('should return NotFoundError if cannot find image', function () {
      assert.isRejected(images.findOneByName('node'), NotFoundError);
    });
    it('should return NotFoundError if image was lost', function () {
      // this is a really weird state, but we'll test for it
      // the tag still exists, but the image does not
      delete images._store['4'];
      assert.isRejected(images.findOneByName('ubuntu'), NotFoundError);
    });
  });

  describe('deleteByName', function () {
    it('should delete an image', function () {
      assert.isFulfilled(images.deleteByName('ubuntu'))
        .then(function () { return images.listImages(); })
        .then(function (images) { assert.lengthOf(images, 0); });
    });
  });

  describe('listImages', function () {
    it('should list images', function () {
      images._tags.foo = 'bar';
      assert.isFulfilled(images.listImages())
        .then(function (images) { assert.lengthOf(images, 1); });
    });
    it('should list images with container config', function () {
      image.container_config = {}; // eslint-disable-line camelcase
      assert.isFulfilled(images.listImages())
        .then(function (images) { assert.lengthOf(images, 1); });
    });
  });
});
