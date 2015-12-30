'use strict'

var app = require('express')()
var not = require('101/not')
var envIs = require('101/env-is')
var bodyParser = require('body-parser')
var createCount = require('callback-count')
var mw = require('./middleware')
var fs = require('fs')
var StringStream = require('./utils/string-stream')
var stream = require('stream')
var tarStream = require('tar-stream')
var ImageStore = require('./models/image-store')
var ContainerStore = require('./models/container-store')
var BaseStore = require('./models/base-store')
var NotFoundError = BaseStore.NotFoundError
var NotModifiedError = BaseStore.NotModifiedError
var ConflictError = BaseStore.ConflictError

var images = new ImageStore()
var containers = new ContainerStore()

// setup event stream
var eventStream = new stream.Stream()
function emitContainerEvent (eventType, container) {
  if (!container) { throw new Error('emitEvent needs a container') }
  eventStream.emit('data', JSON.stringify({
    status: eventType,
    time: Date.now(),
    id: container.Id,
    // TODO: ideally it shouldn't be hardcoded,
    // but it seem that we can't get it now
    from: 'ubuntu:latest'
  }))
}
containers.on('event', emitContainerEvent)

app.use(function (req, res, next) {
  req.url = req.originalUrl.replace(/\/v\d+\.\d+/, '')
  next()
})

app.get('/containers/json',
  function (req, res, next) {
    if (req.query && req.query.filters) {
      req.filters = JSON.parse(req.query.filters)
      if (req.filters.label) {
        var label = req.filters.label.split('=', 2)
        req.filters.label = {}
        req.filters.label[label[0]] = label[1]
      }
    }
    next()
  },
  function (req, res, next) {
    containers
      .listContainers(req.filters)
      .then(res.json.bind(res))
      .catch(next)
  })

app.post('/containers/create',
  bodyParser.json(),
  function (req, res, next) {
    // Create api supports adding name as a query parameter
    // https://docs.docker.com/engine/reference/api/docker_remote_api_v1.21/#create-a-container
    if (req.query.name) {
      req.body.name = req.query.name
    }

    containers
      .createContainer(req.body)
      .then(function (container) {
        res.status(201).json(container)
      })
      .catch(ConflictError, function (err) { res.status(err.statusCode).end(err.message) })
      .catch(next)
  })

app.get('/containers/:id/json', function (req, res, next) {
  containers
    .findOneByIdOrName(req.params.id)
    .then(res.json.bind(res))
    .catch(NotFoundError, function (err) { res.status(404).end(err.message) })
    .catch(next)
})

/**
 * This GET is to retrieve the Docker Log stream from the container
 */
app.get('/containers/:id/logs', function (req, res) {
  var stringStream = new StringStream('Just a bunch of text')
  res.status(200)
  stringStream.pipe(res)
})

app.get('/containers/:id/top', mw.notYetImplemented)

app.get('/containers/:id/changes', mw.notYetImplemented)

app.get('/containers/:id/export', mw.notYetImplemented)

app.post('/containers/:id/start', function (req, res, next) {
  containers
    .findOneByIdOrName(req.params.id)
    .then(function (container) {
      return container.start()
    })
    .then(function () {
      res.sendStatus(204)
    })
    .catch(next)
})

app.post('/containers/:id/stop', function (req, res, next) {
  containers
    .findOneByIdOrName(req.params.id)
    .then(function (container) {
      return container.stop()
    })
    .then(function () { res.sendStatus(204) })
    .catch(NotModifiedError, function (err) {
      res.status(304).end(err.message)
    })
    .catch(next)
})

app.post('/containers/:id/restart', function (req, res, next) {
  containers
    .findOneByIdOrName(req.params.id)
    .then(function (container) {
      return container.stop('restart')
    })
    .then(function (container) {
      return container.start(true)
    })
    .then(function () { res.sendStatus(204) })
    .catch(NotModifiedError, function (err) {
      res.status(304).end(err.message)
    })
    .catch(next)
})

app.post('/containers/:id/kill', function (req, res, next) {
  var signal = req.query.signal || 'SIGKILL'
  containers
    .findOneByIdOrName(req.params.id)
    .then(function (container) {
      return container.stop('kill', signal)
    })
    .then(function () { res.sendStatus(204) })
    .catch(NotModifiedError, function (err) {
      res.status(304).end(err.message)
    })
    .catch(next)
})

app.post('/containers/:id/attach', function (req, res, next) {
  containers
    .findOneByIdOrName(req.params.id)
    .then(function () {
      setTimeout(function () {
        res.sendStatus(200)
      }, 10)
    })
    .catch(next)
})

app.post('/containers/:id/wait', function (req, res, next) {
  containers
    .findOneByIdOrName(req.params.id)
    .then(function (container) {
      return container.stop()
    })
    .then(function () {
      setTimeout(function () {
        res.json({ StatusCode: 0 })
      }, 10)
    })
    .catch(next)
})

app.delete('/containers/:id', function (req, res, next) {
  containers
    .deleteById(req.params.id)
    .then(function () { res.sendStatus(204) })
    .catch(next)
})

app.post('/containers/:id/copy', mw.notYetImplemented)

app.post('/containers/:id/resize', mw.notYetImplemented)

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

app.get('/auth', mw.notYetImplemented)

app.get('/info', function (req, res, next) {
  // TODO: any other information we need?
  var data = {
    Mock: true
  }
  images
    .listImages()
    .then(function (images) {
      data.Images = images.length
      return containers.listContainers()
    })
    .then(function (containers) {
      data.Containers = containers.length
      res.json(data)
    })
    .catch(next)
})

app.get('/version', function (req, res) {
  res.json({
    Arch: 'amd64',
    GitCommit: 3600720,
    GoVersion: 'go1.2.1',
    KernelVersion: '3.13.3-tinycore64',
    Os: 'linux',
    Version: '0.9.1'
  })
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

app.get('/events', mw.getEvents(eventStream))

app.get(/\/images\/(.+)\/get/, function (req, res, next) {
  images
    .findOneByName(req.params[0])
    .then(function () {
      res.writeHead(200, { 'content-type': 'application/x-tar' })
      fs.createReadStream('misc/busybox.tar').pipe(res)
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

app.all('*', mw.notYetImplemented)

app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
  if (not(envIs('test'))) { console.error(err.stack) }
  res.status(500).end(err.message)
})

app.events = {
  stream: eventStream,
  generateEvent: mw.generateEvent
}

module.exports = app
