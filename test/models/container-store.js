'use strict';

var chai = require('chai');
var assert = chai.assert;

var assign = require('101/assign');
var ContainerStore = require('../../lib/models/container-store');
var createCount = require('callback-count');
var EventEmitter = require('events').EventEmitter;
var NotFoundError = require('../../lib/models/base-store').NotFoundError;

describe('Container Store', function () {
  var containers;
  var container;
  beforeEach(function () {
    container = new EventEmitter();
    assign(container, {
      Id: 4,
      Image: 'ubuntu',
      Name: '/test-container',
      Created: Date.now()
    });
    containers = new ContainerStore();
    containers._store[4] = container;
  });

  describe('findOneByName', function () {
    it('should find something by name', function () {
      assert.isFulfilled(containers.findOneByName('test-container'))
        .then(function (o) { assert.deepEqual(o, container); });
    });

    it('should return NotFoundError if cannot find container', function () {
      assert.isRejected(
        containers.findOneByName('nope-container'),
        NotFoundError
      );
    });
  });

  describe('findOneByIdOrName', function () {
    it('should find one by name', function () {
      assert.isFulfilled(containers.findOneByIdOrName('test-container'))
        .then(function (o) { assert.deepEqual(o, container); });
    });
    it('should find one by id', function () {
      assert.isFulfilled(containers.findOneByIdOrName(4))
        .then(function (o) { assert.deepEqual(o, container); });
    });
    it('should return a not found error if both fail', function () {
      assert.isRejected(containers.findOneByIdOrName(-1), NotFoundError);
    });
  });

  describe('deleteById', function () {
    it('should remove a container and emit event', function (done) {
      var expectedEvents = ['destroy'];
      var count = createCount(expectedEvents.length, done);
      containers.on('event', function (type, c) {
        var expectedEvent = expectedEvents.shift();
        assert.equal(type, expectedEvent);
        assert.deepEqual(c, container);
        count.next();
      });
      assert.isFulfilled(containers.deleteById(4));
    });
  });

  describe('listContainers', function () {
    it('should list containers', function () {
      assert.isFulfilled(containers.listContainers())
        .then(function (containers) {
          assert.lengthOf(containers, 1);
          assert.propertyVal(containers[0], 'Id', 4);
          assert.propertyVal(containers[0], 'Image', 'ubuntu');
        });
    });
  });

  describe('createContainer', function () {
    it('should create a container', function () {
      assert.isFulfilled(containers.createContainer({}))
        .then(function () {
          return containers.listContainers();
        })
        .then(function (containers) {
          assert.lengthOf(containers, 2);
        });
    });
    it('should register for container events and emit create', function (done) {
      var expectedEvents = [ 'create', 'start' ];
      var count = createCount(expectedEvents.length, done);
      containers.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        assert.equal(type, expectedEvent);
        count.next();
      });
      assert.isFulfilled(containers.createContainer({}))
        .then(function (container) {
          return container.start();
        });
    });
  });
});
