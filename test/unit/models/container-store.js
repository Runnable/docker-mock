'use strict'

var chai = require('chai')
var assert = chai.assert
var sinon = require('sinon')

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
  afterEach(function () {
    containers.removeAllListeners('event')
    // quick way to get rid of our Store instance
    ContainerStore._instance = null
  })

  it('should always return the same instance', function () {
    var testContainerStore = new ContainerStore()
    assert.equal(containers, testContainerStore)
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

  describe('_formatQueryFilters', function () {
    it('should do nothing without any labels', function () {
      var obj = {}
      assert.equal(ContainerStore._formatQueryFilters(obj), obj)
    })

    it('should throw if labels is not an array', function () {
      var filters = {
        label: {}
      }
      assert.throws(
        function () { ContainerStore._formatQueryFilters(filters) },
        Error,
        /labels must be an array/i
      )
    })

    it('should leave simple labels alone', function () {
      var filters = {
        label: [ 'foo' ]
      }
      var expected = {
        label: { foo: '' }
      }
      assert.deepEqual(ContainerStore._formatQueryFilters(filters), expected)
    })

    it('should split simple key values', function () {
      var filters = {
        label: [ 'foo=bar' ]
      }
      var expected = {
        label: { foo: 'bar' }
      }
      assert.deepEqual(ContainerStore._formatQueryFilters(filters), expected)
    })

    it('should split complex key values and remove quotes', function () {
      var filters = {
        label: [ 'foo="bar=baz"' ]
      }
      var expected = {
        label: { foo: 'bar=baz' }
      }
      assert.deepEqual(ContainerStore._formatQueryFilters(filters), expected)
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
        Labels: { side: 'light', name: '' },
        State: { Running: true }
      }
      dark = {
        Labels: { side: 'dark', name: 'kyloren' },
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

    it('should work with empty strings in the label values', function () {
      var filters = {
        label: { name: '' }
      }
      var filtered = ContainerStore._runFilters(list, filters)
      assert.deepEqual(filtered, [light])
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

  describe('_formatBodyLabels', function () {
    it('should return nothing if no labels are passed in', function () {
      assert.notOk(ContainerStore._formatBodyLabels())
    })

    it('should return an object if an array is passed in', function () {
      var arr = [ 'foo', 'bar' ]
      var obj = {
        foo: '',
        bar: ''
      }
      assert.deepEqual(ContainerStore._formatBodyLabels(arr), obj)
    })

    it('should simply return the object if it is passed one', function () {
      var obj = { foo: 'bar' }
      assert.equal(ContainerStore._formatBodyLabels(obj), obj)
    })

    it('should throw an error if an array or object is not passed in', function () {
      assert.throws(
        function () { ContainerStore._formatBodyLabels('foobar') },
        Error,
        /labels is malformed/i
      )
    })
  })

  describe('createContainer', function () {
    beforeEach(function () {
      sinon.spy(ContainerStore, '_formatBodyLabels')
    })
    afterEach(function () {
      ContainerStore._formatBodyLabels.restore()
    })

    it('should create a container', function () {
      return assert.isFulfilled(containers.createContainer({}))
        .then(function (newContainer) {
          return containers.listContainers()
        })
        .then(function (containers) {
          assert.lengthOf(containers, 2)
        })
    })

    it('should create a container with a name', function () {
      var data = { name: 'new-container' }
      return assert.isFulfilled(containers.createContainer(data))
        .then(function () {
          return containers.listContainers()
        })
        .then(function (containers) {
          assert.lengthOf(containers, 2)
        })
    })

    it('should format the body-provided labels', function () {
      var data = {
        name: 'new-container',
        labels: { foo: 'bar' }
      }
      return assert.isFulfilled(containers.createContainer(data))
        .then(function () {
          sinon.assert.calledOnce(ContainerStore._formatBodyLabels)
        })
    })

    it('should reject creating a container with an existing name with ConflictError', function () {
      return assert.isRejected(
        containers.createContainer({ name: 'test-container' }),
        ConflictError
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
