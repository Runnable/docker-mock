'use strict'

var app = require('express')()
var BaseStore = require('../../models/base-store')
var bodyParser = require('body-parser')
var ContainerStore = require('../../models/container-store')
var mw = require('../../middleware')
var Promise = require('bluebird')
var StringStream = require('../../utils/string-stream')

var ConflictError = BaseStore.ConflictError
var NotFoundError = BaseStore.NotFoundError
var NotModifiedError = BaseStore.NotModifiedError

var containers = new ContainerStore()

app.get('/containers/json',
  function (req, res, next) {
    // this can possibly throw, so wrapping in Promise.
    Promise.try(function () {
      if (req.query && req.query.filters) {
        // need to JSON.parse the filters, first.
        req.query.filters = JSON.parse(req.query.filters)
        req.query.filters = ContainerStore._formatQueryFilters(req.query.filters)
      }
    })
      .asCallback(next)
  },
  function (req, res, next) {
    containers
      .listContainers(req.query.filters)
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

module.exports = app
