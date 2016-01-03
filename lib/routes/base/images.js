'use strict'

var app = require('express')()
var BaseStore = require('../../models/base-store')
var ContainerStore = require('../../models/container-store')
var createCount = require('callback-count')
var fs = require('fs')
var ImageStore = require('../../models/image-store')
var mw = require('../../middleware')
var tarStream = require('tar-stream')

var NotFoundError = BaseStore.NotFoundError

var images = new ImageStore()
var containers = new ContainerStore()

app.get('/images/json', function (req, res, next) {
  images
    .listImages()
    .then(res.json.bind(res))
    .catch(next)
})

app.post('/images/create', function (req, res, next) {
  // this function is NOT promisified
  images.create(req, res, function (err) {
    if (err) { next(err) }
    res.end()
  })
})

// app.post(/\/images\/(.+)\/insert/, mw.notYetImplemented)

app.get(/\/images\/(.+)\/json/, function (req, res, next) {
  images
    .findOneByName(req.params[0])
    .then(res.json.bind(res))
    .catch(next)
})

app.get(/\/images\/(.+)\/history/, function (req, res, next) {
  images
    .findOneByName(req.params[0])
    .then(function (image) {
      return images.getHistory(image.Id)
    })
    .then(res.json.bind(res))
    .catch(NotFoundError, function (err) { res.status(404).end(err.message) })
    .catch(next)
})

app.post(/\/images\/(.+)\/push/, function (req, res, next) {
  images
    .findOneByName(req.params[0])
    .then(function () {
      res.status(200).json({ stream: 'Successfully pushed' })
    })
    .catch(NotFoundError, function (err) { res.status(404).end(err.message) })
    .catch(next)
})

app.post(/\/images\/(.+)\/tag/, mw.notYetImplemented)

app.delete(/\/images\/(.+)/, function (req, res, next) {
  images
    .deleteByName(req.params[0])
    .then(function () { res.sendStatus(200) })
    .catch(next)
})

app.get('/images/search', mw.notYetImplemented)

app.post('/build', function (req, res, next) {
  images
    .build(req)
    .then(function (newImage) {
      res.status(200).json(newImage)
    })
    .catch(next)
})

app.post('/commit', function (req, res, next) {
  containers
    .findOneByIdOrName(req.query.container)
    .then(function (container) {
      return images.commitContainer(container, req.query)
    })
    .then(function (image) {
      res.status(201).json(image)
    })
    .catch(next)
})

app.get(/\/images\/(.+)\/get/, function (req, res, next) {
  images
    .findOneByName(req.params[0])
    .then(function () {
      res.writeHead(200, { 'content-type': 'application/x-tar' })
      fs.createReadStream('resources/busybox.tar').pipe(res)
    })
    .catch(NotFoundError, function (err) {
      res.status(404).end(err.message)
    })
    .catch(next)
})

app.post('/images/load', function (req, res) {
  var extract = tarStream.extract()
  extract.on('entry', function (header, extractStream, cb) {
    var count = createCount(cb)
    // if json part, save image
    if (/[0-9a-zA-Z]{32}\/json/.test(header.name)) {
      count.inc()
      extractStream.on('data', function (d) {
        var image = JSON.parse(d)
        // have to rename some things to fit
        image.Id = image.id
        image.Created = image.created
        image.RepoTags = image.RepoTags || []
        images.loadImage(image, count.next)
      })
    }
    extractStream.on('end', count.next)
    extractStream.resume()
  })
  req.on('end', function () {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end()
  })
  req.pipe(extract)
})

module.exports = app
