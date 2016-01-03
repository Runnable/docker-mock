'use strict'

var app = require('express')()
var ContainerStore = require('../../models/container-store')
var ImageStore = require('../../models/image-store')
var mw = require('../../middleware')
var stream = require('stream')

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

app.get('/events', mw.getEvents(eventStream))

module.exports = app
module.exports.eventStream = eventStream
