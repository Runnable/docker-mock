'use strict'

var chai = require('chai')
var assert = chai.assert

var Container = require('../../lib/models/container')
var createCount = require('callback-count')
var NotModifiedError = require('../../lib/models/base-store').NotModifiedError

describe('Container', function () {
  var container
  beforeEach(function () {
    container = new Container()
  })

  describe('constructor options', function () {
    it('should respect various options passed in', function () {
      var opts = {
        Labels: { hello: 'world' },
        Image: 'ubuntu'
      }
      var c = new Container(opts)
      assert.deepProperty(c, 'Config.Labels')
      assert.deepEqual(c.Config.Labels, { hello: 'world' })
      assert.propertyVal(c, 'Image', 'ubuntu')
    })
    it('should prepend Name with a slash', function () {
      var c = new Container({ Name: 'foo' })
      assert.propertyVal(c, 'Name', '/foo')
    })
  })

  describe('start', function () {
    it('should start and emit the correct events', function (done) {
      assertEvents(container, ['start'], done)
      return assert.isFulfilled(container.start())
        .then(function (c) {
          assert.deepPropertyVal(c, 'State.Running', true)
          assert.deepProperty(c, 'NetworkSettings.Ports')
        })
    })
    it('should throw NotModifiedError if already started', function () {
      container.State.Running = true
      return assert.isRejected(container.start(), NotModifiedError)
    })
  })

  describe("restart (it's start/stop)", function () {
    it('should start and emit the correct events', function (done) {
      assertEvents(container, [ 'start', 'restart' ], done)
      // start(true) => restart
      return assert.isFulfilled(container.start(true))
    })
    it('should stop and emit the correct events', function (done) {
      assertEvents(container, ['die'], done)
      // start(true) => restart
      return assert.isFulfilled(container.stop('restart'))
    })
  })

  describe('stop', function () {
    it('should stop and emit the correct events', function (done) {
      assertEvents(container, [ 'die', 'stop' ], done)
      container.State.Running = true
      return assert.isFulfilled(container.stop())
    })
    it('should throw NotModifiedError if already stopped', function () {
      return assert.isRejected(container.stop(), NotModifiedError)
    })
  })

  describe('kill (stop)', function () {
    it('should stop via kill (default to SIGKILL) and emit the correct events',
      function (done) {
        assertEvents(container, [ 'die', 'kill' ], done)
        container.State.Running = true
        return assert.isFulfilled(container.stop('kill'))
          .then(function (c) {
            assert.equal(c.State.Running, false)
            assert.deepPropertyVal(c, 'State.ExitCode', 0)
          })
      }
    )
    it('should stop via kill and emit the correct events', function (done) {
      assertEvents(container, [ 'die', 'kill' ], done)
      container.State.Running = true
      return assert.isFulfilled(container.stop('kill', 'SIGKILL'))
        .then(function (c) {
          assert.deepPropertyVal(c, 'State.Running', false)
          assert.deepPropertyVal(c, 'State.ExitCode', 1)
        })
    })
    it('should stop via kill w/ signal and emit the correct events',
      function (done) {
        assertEvents(container, [ 'die', 'kill' ], done)
        container.State.Running = true
        return assert.isFulfilled(container.stop('kill', 'SIGINT'))
          .then(function (c) {
            assert.deepPropertyVal(c, 'State.Running', false)
            assert.deepPropertyVal(c, 'State.ExitCode', 0)
          })
      })
  })
})

function assertEvents (container, events, callback) {
  var count = createCount(events.length, callback)
  container.on('event', function (type) {
    var expectedEvent = events.shift()
    assert.equal(type, expectedEvent)
    count.next()
  })
}
