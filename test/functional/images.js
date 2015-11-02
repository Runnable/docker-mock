'use strict'

var chai = require('chai')
var assert = chai.assert

var async = require('async')
var checkClean = require('./fixtures').checkClean
var createCount = require('callback-count')
var dockerMock = require('../../lib/index')
var fs = require('fs')
var handleStream = require('./fixtures').handleStream
var noop = require('101/noop')
var request = require('request')
var tar = require('tar-stream')
var watchBuild = require('./fixtures').watchBuild
var watchBuildFail = require('./fixtures').watchBuildFail
var zlib = require('zlib')

var docker = require('dockerode')({
  host: 'http://localhost',
  port: 5354
})

describe('images', function () {
  var server
  before(function (done) { server = dockerMock.listen(5354, done) })
  // make sure we are starting with a clean mock
  // (tests should clean-up after themselves)
  beforeEach(function (done) { checkClean(docker, done) })
  after(function (done) { server.close(done) })

  describe('image create', function () {
    beforeEach(function (done) {
      var count = createCount(2, done)
      docker.createImage({
        fromImage: 'foo',
        tag: '999',
        Created: 100
      }, function (err, res) {
        if (err) { return done(err) }
        res.on('data', noop)
        count.next()
        docker.createImage({
          fromImage: 'foo2',
          tag: '9992'
        }, function (err2, res2) {
          if (err2) { return done(err2) }
          res2.on('data', noop)
          count.next()
        })
      })
    })
    afterEach(function (done) {
      var count = createCount(2, done)
      docker.listImages(function (err, images) {
        if (err) { return done(err) }
        docker.getImage(images[0].Id).remove(count.next)
        docker.getImage(images[1].Id).remove(count.next)
      })
    })
    it('should allow image mocking of Created timestamp', function (done) {
      docker.listImages(function (err, images) {
        if (err) { return done(err) }
        assert.lengthOf(images, 2)
        assert.equal(images[0].Created, 100)
        assert.closeTo(images[1].Created, Math.floor(Date.now() / 1000), 10)
        done()
      })
    })
  })

  it('should be able to build images, and delete it', function (done) {
    var pack = tar.pack()
    pack.entry({ name: './', type: 'directory' })
    pack.entry({ name: './Dockerfile' }, 'FROM ubuntu\nADD ./src /root/src\n')
    pack.entry({ name: './src', type: 'directory' })
    pack.entry({ name: './src/index.js' }, "console.log('hello')\n")
    pack.finalize()
    var image = docker.getImage('buildTest')
    docker.buildImage(pack, { t: 'buildTest' }, watchBuild(image, done))
  })
  it('should emulate a build failure', function (done) {
    var pack = tar.pack()
    pack.entry({ name: './', type: 'directory' })
    pack.entry({ name: './Dockerfile' }, 'FROM ubuntu\nADD ./src /root/src\n')
    pack.entry({ name: './src', type: 'directory' })
    pack.entry({ name: './src/index.js' }, "console.log('hello')\n")
    pack.finalize()
    docker.buildImage(
      pack,
      { t: 'doomedImage', fail: true },
      watchBuildFail(done))
  })
  it('should be able to build images with namespace/repository, and delete it',
    function (done) {
      var pack = tar.pack()
      pack.entry({ name: './', type: 'directory' })
      pack.entry({ name: './Dockerfile' },
        'FROM ubuntu\nADD ./src /root/src\n')
      pack.entry({ name: './src', type: 'directory' })
      pack.entry({ name: './src/index.js' }, "console.log('hello')\n")
      pack.finalize()
      var image = docker.getImage('docker-mock/buildTest')
      docker.buildImage(
        pack,
        { t: 'docker-mock/buildTest' },
        watchBuild(image, done))
    }
  )
  it('should be able to build images with registry/namespace/repository, ' +
  'and delete it',
    function (done) {
      var pack = tar.pack()
      pack.entry({ name: './', type: 'directory' })
      pack.entry({ name: './Dockerfile' },
        'FROM ubuntu\nADD ./src /root/src\n')
      pack.entry({ name: './src', type: 'directory' })
      pack.entry({ name: './src/index.js' }, "console.log('hello')\n")
      pack.finalize()
      var image = docker.getImage('private.com/docker-mock/buildTest')
      docker.buildImage(pack,
        { t: 'private.com/docker-mock/buildTest' },
        watchBuild(image, done))
    }
  )
  it('should fail building an image w/o a dockerfile', function (done) {
    var badPack = tar.pack()
    badPack.entry({ name: './', type: 'directory' })
    badPack.entry({ name: './src', type: 'directory' })
    badPack.entry({ name: './src/index.js' }, "console.log('hello')\n")
    badPack.finalize()
    docker.buildImage(badPack, { t: 'buildTest' }, watchBuildFail(done))
  })
  it('should build an image that has been gzipped', function (done) {
    var pack = tar.pack()
    pack.entry({ name: './', type: 'directory' })
    pack.entry({ name: './Dockerfile' }, 'FROM ubuntu\nADD ./src /root/src\n')
    pack.entry({ name: './src', type: 'directory' })
    pack.entry({ name: './src/index.js' }, "console.log('hello')\n")
    pack.finalize()
    pack = pack.pipe(zlib.createGzip())
    var image = docker.getImage('buildTest')
    pack.pipe(request.post({
      url: 'http://localhost:5354/build',
      qs: { t: 'buildTest' },
      headers: { 'content-type': 'application/x-gzip' }
    })).on('end', function (err) {
      if (err) { return done(err) }
      image.remove(done)
    })
  })
  it('should list all the images when there are none', function (done) {
    docker.listImages({}, function (err, images) {
      if (err) { return done(err) }
      assert.lengthOf(images, 0)
      done()
    })
  })
  describe('image pulling', function () {
    it('should pull image', function (done) {
      docker.pull('my/repo:tag', handleStream(function (err) {
        if (err) { return done(err) }
        docker.getImage('my/repo:tag').remove(done)
      }))
    })
    it('should pull image without a tag', function (done) {
      docker.pull('my/repo', handleStream(function (err) {
        if (err) { return done(err) }
        docker.getImage('my/repo').remove(done)
      }))
    })
    it('should error if invalid image', function (done) {
      docker.pull('', function (err, stream) {
        if (err) { return done(err) }
        stream.on('data', function (data) {
          data = JSON.parse(data)
          if (data[0] && data[0].error && data[0].errorDetail) {
            done()
          }
        })
        stream.on('end', noop)
      })
    })
  })
  describe('interactions', function () {
    beforeEach(function (done) {
      var pack = tar.pack()
      pack.entry({ name: './', type: 'directory' })
      pack.entry({ name: './Dockerfile' },
        'FROM ubuntu\nADD ./src /root/src\n')
      pack.entry({ name: './src', type: 'directory' })
      pack.entry({ name: './src/index.js' }, "console.log('hello')\n")
      pack.finalize()
      docker.buildImage(pack, { t: 'testImage' }, watchBuild(done))
    })
    beforeEach(function (done) {
      var pack = tar.pack()
      pack.entry({ name: './', type: 'directory' })
      pack.entry({ name: './Dockerfile' },
        'FROM ubuntu\nADD ./src /root/src\n')
      pack.entry({ name: './src', type: 'directory' })
      pack.entry({ name: './src/index.js' }, "console.log('hello')\n")
      pack.finalize()
      docker.buildImage(
        pack,
        { t: 'somedomain.tld/username/testImage:tag' },
        watchBuild(done))
    })
    afterEach(function (done) {
      docker.listImages(function (err, images) {
        if (err) { return done(err) }
        var count = createCount(images.length, done)
        images.forEach(function (i) {
          docker.getImage(i.Id).remove(count.next)
        })
      })
    })
    it('should list all the images', function (done) {
      docker.listImages(function (err, images) {
        if (err) { return done(err) }
        assert.lengthOf(images, 2)
        assert.lengthOf(images[0].RepoTags, 1)
        assert.equal(images[0].RepoTags[0], 'testImage:latest')
        assert.isNumber(images[0].Created)
        assert.closeTo(images[0].Created, Math.floor(Date.now() / 1000), 10)
        done()
      })
    })
    it('should 404 on save image if it does not exist', function (done) {
      docker.getImage('fake').get(function (err) {
        assert.equal(err.statusCode, 404)
        done()
      })
    })
    it('should save an image', function (done) {
      docker.getImage('testImage').get(handleStream(done))
    })
    it('should load an image', function (done) {
      var numImages
      async.series([
        function listImages (cb) {
          docker.listImages(function (err, images) {
            if (err) { return cb(err) }
            numImages = images.length
            cb()
          })
        },
        function loadImage (cb) {
          var imageStream = fs.createReadStream('misc/busybox.tar')
          docker.loadImage(imageStream, cb)
        },
        function listImages (cb) {
          docker.listImages(function (err, images) {
            if (err) { return cb(err) }
            // the tarball has 3 images and no repotag: three layers expected
            assert.equal(images.length - numImages, 3)
            cb()
          })
        }
      ], done)
    })
    it('should push an image', function (done) {
      docker.getImage('testImage')
        .push({}, handleStream(done))
    })
    it('should push an image with a tag, name, user, domain', function (done) {
      docker.getImage('somedomain.tld/username/testImage:tag')
        .push({}, handleStream(done))
    })
    it('should get an images history', function (done) {
      docker.getImage('testImage')
        .history(function (err, history) {
          if (err) { return done(err) }
          assert.lengthOf(history, 1)
          done()
        })
    })
    it('should 404 an image that does not exist', function (done) {
      docker.getImage('nopeImage')
        .history(function (err) {
          if (!err) { return done(new Error('expected an error')) }
          assert.equal(err.statusCode, 404)
          done()
        })
    })
    it('should not push an image if it doesnt exist', function (done) {
      docker.getImage('nonexistantImage')
        .push({}, handleStream(function (err) {
          assert.equal(err.statusCode, 404)
          done()
        }))
    })
    describe('private', function () {
      var repo
      beforeEach(function (done) {
        var pack = tar.pack()
        pack.entry({ name: './', type: 'directory' })
        pack.entry({ name: './Dockerfile' },
          'FROM ubuntu\nADD ./src /root/src\n')
        pack.entry({ name: './src', type: 'directory' })
        pack.entry({ name: './src/index.js' }, "console.log('hello')\n")
        pack.finalize()
        repo = 'private.com/hey/testImage'
        docker.buildImage(pack, { t: repo }, watchBuild(done))
      })
      afterEach(function (done) {
        docker.getImage(repo).remove(done)
      })
      it('should push a private image', function (done) {
        docker.getImage(repo)
          .push({}, handleStream(done))
      })
      it('should not push a private image if it doesnt exist', function (done) {
        docker.getImage('private.com/hey/nonexistantImage')
          .push({}, handleStream(function (err) {
            assert.equal(err.statusCode, 404)
            done()
          }))
      })
    })
  })
})
