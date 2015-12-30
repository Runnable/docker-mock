'use strict'

var chai = require('chai')
var assert = chai.assert

var assign = require('101/assign')
var ContainerStore = require('../../../lib/models/container-store')
var createCount = require('callback-count')
var EventEmitter = require('events').EventEmitter
var NotFoundError = require('../../../lib/models/base-store').NotFoundError
var ConflictError = require('../../../lib/models/base-store').ConflictError

describe('Container Store', function () {
  var containers
  var container
  beforeEach(function () {
    container = new EventEmitter()
    assign(container, {
      Id: 4,
      Image: 'ubuntu',
      Name: '/test-container',
      Created: Date.now(),
      State: { Running: true },
      Config: { Labels: { label: 'test-label' } }
    })
    containers = new ContainerStore()
    containers._store[4] = container
  })

  describe('findOneByName', function () {
    it('should find something by name', function () {
      return assert.isFulfilled(containers.findOneByName('test-container'))
        .then(function (o) { assert.deepEqual(o, container) })
    })

    it('should return NotFoundError if cannot find container', function () {
      return assert.isRejected(
        containers.findOneByName('nope-container'),
        NotFoundError
      )
    })
  })

  describe('findOneByIdOrName', function () {
    it('should find one by name', function () {
      return assert.isFulfilled(containers.findOneByIdOrName('test-container'))
        .then(function (o) { assert.deepEqual(o, container) })
    })
    it('should find one by id', function () {
      return assert.isFulfilled(containers.findOneByIdOrName(4))
        .then(function (o) { assert.deepEqual(o, container) })
    })
    it('should return a not found error if both fail', function () {
      return assert.isRejected(containers.findOneByIdOrName(-1), NotFoundError)
    })
  })

  describe('deleteById', function () {
    it('should remove a container and emit event', function (done) {
      var expectedEvents = ['destroy']
      var count = createCount(expectedEvents.length, done)
      containers.on('event', function (type, c) {
        var expectedEvent = expectedEvents.shift()
        assert.equal(type, expectedEvent)
        assert.deepEqual(c, container)
        count.next()
      })
      return assert.isFulfilled(containers.deleteById(4))
    })
  })

  describe('listContainers', function () {
    it('should list containers', function () {
      return assert.isFulfilled(containers.listContainers())
        .then(function (containers) {
          assert.lengthOf(containers, 1)
          assert.propertyVal(containers[0], 'Id', 4)
          assert.propertyVal(containers[0], 'Image', 'ubuntu')
        })
    })
    it('should list containers with a postive filter', function () {
      var filters = {
        status: 'running'
      }
      return assert.isFulfilled(containers.listContainers(filters))
        .then(function (containers) {
          assert.lengthOf(containers, 1)
          assert.equal(containers[0].State.Running, true)
        })
    })
    it('should list containers with a negative filter', function () {
      var filters = {
        label: { type: 'test-label' }
      }
      return assert.isFulfilled(containers.listContainers(filters))
        .then(function (containers) {
          assert.lengthOf(containers, 0)
        })
    })
  })

  describe('_runFilters', function () {
    var light
    var dark
    var list
    beforeEach(function () {
      light = {
        Labels: { side: 'light' },
        State: { Running: true }
      }
      dark = {
        Labels: { side: 'dark' },
        State: { Running: false }
      }
      list = [ light, dark ]
    })

    it('should return the given list w/o any filters', function () {
      var filtered = ContainerStore._runFilters(list, [])
      assert.deepEqual(filtered, list)
    })

    it('should ignore values without labels', function () {
      var filters = {
        label: { side: 'light' }
      }
      list.push({ State: { Running: true } })
      var filtered = ContainerStore._runFilters(list, filters)
      assert.deepEqual(filtered, [light])
    })

    it('should filter on labels', function () {
      var filters = {
        label: { side: 'light' }
      }
      var filtered = ContainerStore._runFilters(list, filters)
      assert.deepEqual(filtered, [light])
      filters.label.side = 'dark'
      filtered = ContainerStore._runFilters(list, filters)
      assert.deepEqual(filtered, [dark])
    })

    it('should filter on status', function () {
      var filters = {
        status: 'running'
      }
      var filtered = ContainerStore._runFilters(list, filters)
      assert.deepEqual(filtered, [light])
      filters.status = 'exited'
      filtered = ContainerStore._runFilters(list, filters)
      assert.deepEqual(filtered, [dark])
    })
  })

  describe('createContainer', function () {
    it('should create a container', function () {
      return assert.isFulfilled(containers.createContainer({}))
        .then(function () {
          return containers.listContainers()
        })
        .then(function (containers) {
          assert.lengthOf(containers, 2)
        })
    })
    it('should create a container with a name', function () {
      return assert.isFulfilled(containers.createContainer({name: 'new-container'}))
        .then(function () {
          return containers.listContainers()
        })
        .then(function (containers) {
          assert.lengthOf(containers, 2)
        })
    })
    it('should reject creating a container with an existing name with ConflictError', function () {
      return assert.isRejected(
        containers.createContainer({name: 'test-container'}), ConflictError
      )
    })
    it('should register for container events and emit create', function (done) {
      var expectedEvents = [ 'create', 'start' ]
      var count = createCount(expectedEvents.length, done)
      containers.on('event', function (type) {
        var expectedEvent = expectedEvents.shift()
        assert.equal(type, expectedEvent)
        count.next()
      })
      return assert.isFulfilled(containers.createContainer({}))
        .then(function (container) {
          return container.start()
        })
    })
  })
})
