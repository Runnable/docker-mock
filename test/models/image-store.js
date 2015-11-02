'use strict'

var chai = require('chai')
var assert = chai.assert

var assign = require('101/assign')
var ImageStore = require('../../lib/models/image-store')
var NotFoundError = require('../../lib/models/base-store').NotFoundError

describe('Image Store', function () {
  var images
  var image
  beforeEach(function () {
    image = assign({}, { Id: '4' })
    images = new ImageStore()
    images._store['4'] = image
    images._tags['ubuntu:latest'] = '4'
    images._imageHistory['4'] = []
  })

  describe('findOneByName', function () {
    it('should find an image by name', function () {
      return assert.isFulfilled(images.findOneByName('ubuntu'))
        .then(function (o) { assert.deepEqual(o, image) })
    })
    it('should find an image by name with tag', function () {
      return assert.isFulfilled(images.findOneByName('ubuntu:latest'))
        .then(function (o) { assert.deepEqual(o, image) })
    })
    it('should find an image by id', function () {
      return assert.isFulfilled(images.findOneByName('4'))
        .then(function (o) { assert.deepEqual(o, image) })
    })

    it('should return NotFoundError if cannot find image', function () {
      return assert.isRejected(images.findOneByName('node'), NotFoundError)
    })
    it('should return NotFoundError if image was lost', function () {
      // this is a really weird state, but we'll test for it
      // the tag still exists, but the image does not
      delete images._store['4']
      return assert.isRejected(images.findOneByName('ubuntu'), NotFoundError)
    })
  })

  describe('deleteByName', function () {
    it('should delete an image', function () {
      return assert.isFulfilled(images.deleteByName('ubuntu'))
        .then(function () { return images.listImages() })
        .then(function (images) { assert.lengthOf(images, 0) })
    })
  })

  describe('listImages', function () {
    it('should list images', function () {
      images._tags.foo = 'bar'
      return assert.isFulfilled(images.listImages())
        .then(function (images) { assert.lengthOf(images, 1) })
    })
    it('should list images with container config', function () {
      image.container_config = {} // eslint-disable-line camelcase
      return assert.isFulfilled(images.listImages())
        .then(function (images) { assert.lengthOf(images, 1) })
    })
  })

  describe('commitComtainer', function () {
    it('should save a container', function () {
      var mockContainer = { _id: 8 }
      var query = { repo: 'test-repo' }
      return assert.isFulfilled(images.commitContainer(mockContainer, query))
        .then(function (image) {
          assert.ok(image.Id)
          return images.listImages()
        })
        .then(function (images) {
          assert.lengthOf(images, 2)
          assert.equal(images[1].RepoTags[0], 'test-repo:latest')
        })
    })
    it('should save a container with custom tag', function () {
      var mockContainer = { _id: 8 }
      var query = {
        repo: 'test-repo',
        tag: 'not-latest'
      }
      return assert.isFulfilled(images.commitContainer(mockContainer, query))
        .then(function (image) {
          assert.ok(image.Id)
          return images.listImages()
        })
        .then(function (images) {
          assert.lengthOf(images, 2)
          assert.equal(images[1].RepoTags[0], 'test-repo:not-latest')
        })
    })
  })

  describe('loadImage', function () {
    it('should create an image in the store', function () {
      var mockImage = {
        Id: '536ed6640d827ed0ef5e0e0f582e8d8c60eb9099c767b362e4430d0a6c42f691',
        Created: undefined,
        RepoTags: ['test-repo:not-latest']
      }
      return assert.isFulfilled(images.loadImage(mockImage))
        .then(function () {
          return images.listImages()
        })
        .then(function (images) {
          assert.lengthOf(images, 2)
          assert.equal(images[1].Id, mockImage.Id)
        })
    })
    it('should create an image in the store without tags', function () {
      var mockImage = {
        Id: '536ed6640d827ed0ef5e0e0f582e8d8c60eb9099c767b362e4430d0a6c42f691',
        Created: undefined,
        RepoTags: []
      }
      return assert.isFulfilled(images.loadImage(mockImage))
        .then(function () {
          return images.listImages()
        })
        .then(function (images) {
          assert.lengthOf(images, 2)
          assert.equal(images[1].Id, mockImage.Id)
        })
    })
  })

  describe('getHistory', function () {
    it('should return image history', function () {
      return assert.isFulfilled(images.getHistory('4'))
        .then(function (history) {
          assert.ok(history)
        })
    })
  })
})
