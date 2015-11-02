'use strict'

var util = require('util')
var utils = require('../utils')
var BaseStore = require('./base-store')
var NotFoundError = BaseStore.NotFoundError

var exists = require('101/exists')
var tar = require('tar')
var zlib = require('zlib')
var duplexEmitter = require('duplex-emitter')
var keypather = require('keypather')()
var Promise = require('bluebird')

module.exports = ImageStore

function ImageStore () {
  this._tags = {}
  this._imageHistory = {}
  BaseStore.call(this)
}
util.inherits(ImageStore, BaseStore)

ImageStore.prototype.findOneByName = function (name) {
  return Promise.resolve()
    .bind(this)
    .then(function () {
      var image = this._store[name]
      var id
      if (!image) {
        if (name.indexOf(':') === -1) { name += ':latest' }
        id = this._tags[name]
        if (!id) { throw new NotFoundError('Image not found') }
        image = this._store[id]
        if (!image) { throw new NotFoundError('Image not found') }
        image.RepoTags = [this._tags[name]]
      }
      return image
    })
}

ImageStore.prototype.deleteByName = function (name) {
  return this.findOneByName(name)
    .bind(this)
    .then(function (image) {
      var id = image.Id
      var name
      // FIXME: this condition isn't tested by unit tests :(
      if (image.RepoTags) {
        name = image.RepoTags[0]
      }
      delete this._store[id]
      if (name) {
        delete this._tags[name]
      }
      return true
    })
}

ImageStore.prototype.listImages = function () {
  return Promise.resolve()
    .bind(this)
    .then(function () {
      return Object.keys(this._store).map(function (id) {
        // if we have full image info, we can return that instead
        // assume if container_config exist on image, it is full object
        if (this._store[id].container_config) {
          return this._store[id]
        }
        // fake return object if we do not have all info
        return {
          Id: id,
          Created: this._store[id].Created,
          RepoTags: Object.keys(this._tags).reduce(function (memo, tag) {
            if (this._tags[tag] === id) { memo.push(tag) }
            return memo
          }.bind(this), [])
        }
      }.bind(this))
    })
}

ImageStore.prototype.create = function (req, res, callback) {
  // don't promisify this, it's actually middleware atm.
  var id = utils.randomId()
  var from = req.query.fromImage
  var emitter = duplexEmitter(res)
  if (!from) {
    emitter.emit({ status: 'Downloading from http://' })
    emitter.emit({
      errorDetail: {
        message: 'Get http://: http: no Host in request URL'
      },
      error: 'Get http://: http: no Host in request URL'
    })
    return res.end()
  }
  this._store[id] = {
    Id: id,
    Created: parseInt(keypather.get(req, 'query.Created'), 10) ||
      Math.floor(Date.now() / 1000)
  }
  this._tags[from + ':' + (req.query.tag || 'latest')] = id
  emitter.emit({
    status: 'The image you are pulling has been verified',
    id: from
  })
  for (var i = 0; i < 100; i++) {
    emitter.emit({
      status: 'Pulling',
      progress: i + ' B/ 100 B',
      progressDetail: {
        current: i,
        total: 100
      }
    })
  }
  emitter.emit({
    status: 'Status: Image is up to date for' + from
  })
  callback()
}

ImageStore.prototype.commitContainer = function (container, query) {
  return Promise.resolve()
    .bind(this)
    .then(function () {
      var repo = query.repo
      var tag = query.tag || 'latest'
      var name = [ repo, tag ].filter(exists).join(':')
      var imageId = utils.randomId()

      this._tags[name] = imageId
      this._store[imageId] = {
        Id: imageId,
        Container: container.Id,
        RepoTags: [name]
      }
      return { Id: imageId }
    })
}

ImageStore.prototype.loadImage = function (data) {
  return Promise.resolve()
    .bind(this)
    .then(function () {
      this._store[data.Id] = data
      if (data.RepoTags.length) {
        data.RepoTags.forEach(function (tag) {
          this._tags[tag] = data.Id
        }.bind(this))
      }
      return true
    })
}

ImageStore.prototype.getHistory = function (id) {
  var history = this._imageHistory[id]
  return Promise.resolve(history)
}

ImageStore.prototype.build = function (req) {
  var self = this
  return new Promise(function (resolve, reject) {
    var foundDockerFile = false
    // TODO query.t is required
    var repoSplit = req.query.t.split(':')
    var repo = repoSplit[0]
    var tag = repoSplit[1] || 'latest'
    var name = repo + ':' + tag
    var intentionalFail = req.query.fail || false
    // for a little extra flexability, we'll support gzip
    if (req.headers['content-type'] === 'application/x-gzip') {
      req = req.pipe(zlib.createGunzip())
    }
    var dockerfile = ''
    req.pipe(tar.Parse()) // eslint-disable-line new-cap
      .on('entry', function (entry) {
        if (entry.props.path === './Dockerfile') { foundDockerFile = true }
        if (entry.props.path === 'Dockerfile') {
          foundDockerFile = true
          entry.on('data', function (d) {
            dockerfile += d.toString()
          })
        }
      })
      .on('end', function () {
        if (intentionalFail) {
          return resError(500, 'Intentional failure.')
        } else if (!foundDockerFile) {
          return resError(500, 'A Dockerfile is required')
        }
        var id = utils.randomId()
        var now = Date.now()
        self._store[id] = {
          Id: id,
          Created: Math.floor(now / 1000)
        }
        self._tags[name] = id
        self._imageHistory[id] = dockerfile
          .split('\n')
          .reverse()
          .map(function (line, index) {
            return {
              Id: utils.randomId(),
              Created: now - (100000 * index),
              CreatedBy: line,
              Size: line.length,
              Tags: null
            }
          })
        resolve({ stream: 'Successfully built ' + id })
      })

    function resError (code, message) {
      var error = new Error('Server Error - ' + message, {
        code: code,
        message: message
      })
      reject(error)
    }
  })
}
