'use strict'

var assert = require('chai').assert

var async = require('async')
var isFunction = require('101/is-function')
var noop = require('101/noop')

var fixtures = module.exports = {
  checkClean: function (docker, done) {
    // the repository should be clean!
    async.parallel([
      fixtures.checkImages.bind(null, docker),
      fixtures.checkContainers.bind(null, docker),
      fixtures.checkInfo.bind(null, docker)
    ], function (err) {
      done(err)
    })
  },
  checkImages: function (docker, done) {
    async.waterfall([
      docker.listImages.bind(docker, {}),
      function (images, _cb) {
        assert.lengthOf(images, 0)
        _cb()
      }
    ], done)
  },
  checkContainers: function (docker, done) {
    async.waterfall([
      docker.listContainers.bind(docker),
      function (containers, _cb) {
        assert.lengthOf(containers, 0)
        _cb()
      }
    ], done)
  },
  checkInfo: function (docker, done) {
    async.waterfall([
      docker.info.bind(docker),
      function (data, _cb) {
        assert.equal(data.Containers, 0)
        assert.equal(data.Images, 0)
        assert.equal(data.Mock, true)
        _cb()
      }
    ], done)
  },
  watchBuild: function (removeImage, done) {
    if (isFunction(removeImage)) {
      done = removeImage
      removeImage = false
    }
    return function (err, res) {
      if (err) { return done(err) }
      res.on('data', noop)
      res.on('end', function () {
        if (removeImage) {
          removeImage.remove(done)
        } else {
          done()
        }
      })
    }
  },
  watchBuildFail: function (done) {
    return function (err) {
      if (err && err.statusCode === 500) {
        done()
      } else {
        done('expected to fail')
      }
    }
  },
  handleStream: function (done) {
    return function (funcErr, res) {
      if (funcErr) {
        done(funcErr)
      } else {
        var errorred = false
        res.on('error', function (err) {
          errorred = err
          done(err)
        })
        res.on('data', noop)
        res.on('end', function () {
          if (!errorred) { done() }
        })
      }
    }
  }
}
