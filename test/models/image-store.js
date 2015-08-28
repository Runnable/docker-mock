'use strict';

var ImageStore = require('../../lib/models/image-store');
var NotFoundError = require('../../lib/models/base-store').NotFoundError;
var assign = require('101/assign');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

describe('Image Store', function () {
  var images;
  var image;
  beforeEach(function (done) {
    image = assign({}, { Id: '4' });
    images = new ImageStore();
    images._store['4'] = image;
    images._tags['ubuntu:latest'] = '4';
    done();
  });

  describe('findOneByName', function () {
    it('should find an image by name', function (done) {
      images.findOneByName('ubuntu')
        .then(function (o) { expect(o).to.deep.equal(image); })
        .finally(done);
    });
    it('should find an image by name with tag', function (done) {
      images.findOneByName('ubuntu:latest')
        .then(function (o) { expect(o).to.deep.equal(image); })
        .finally(done);
    });
    it('should find an image by id', function (done) {
      images.findOneByName('4')
        .then(function (o) { expect(o).to.deep.equal(image); })
        .finally(done);
    });

    it('should return NotFoundError if cannot find image', function (done) {
      images.findOneByName('node')
        .then(function () {
          throw new Error('it should have returned NotFoundError');
        })
        .catch(function (err) {
          expect(err).to.be.an.instanceof(NotFoundError);
        })
        .finally(done);
    });
    it('should return NotFoundError if image was lost', function (done) {
      // this is a really weird state, but we'll test for it
      // the tag still exists, but the image does not
      delete images._store['4'];
      images.findOneByName('ubuntu')
        .then(function () {
          throw new Error('it should have returned NotFoundError');
        })
        .catch(function (err) {
          expect(err).to.be.an.instanceof(NotFoundError);
        })
        .finally(done);
    });
  });

  describe('deleteByName', function () {
    it('should delete an image', function (done) {
      images.deleteByName('ubuntu')
        .then(function () { return images.listImages(); })
        .then(function (images) { expect(images).to.have.length(0); })
        .finally(done);
    });
  });

  describe('listImages', function () {
    it('should list images', function (done) {
      images._tags.foo = 'bar';
      images.listImages()
        .then(function (images) { expect(images).to.have.length(1); })
        .finally(done);
    });
    it('should list images with container config', function (done) {
      image.container_config = {}; // eslint-disable-line camelcase
      images.listImages()
        .then(function (images) { expect(images).to.have.length(1); })
        .finally(done);
    });
  });
});
