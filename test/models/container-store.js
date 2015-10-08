'use strict';

var EventEmitter = require('events').EventEmitter;
var ContainerStore = require('../../lib/models/container-store');
var NotFoundError = require('../../lib/models/base-store').NotFoundError;
var assign = require('101/assign');
var createCount = require('callback-count');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

describe('Container Store', function () {
  var containers;
  var container;
  beforeEach(function (done) {
    container = new EventEmitter();
    assign(container, {
      Id: 4,
      Image: 'ubuntu',
      Name: '/test-container',
      Created: Date.now()
    });
    containers = new ContainerStore();
    containers._store[4] = container;
    done();
  });

  describe('findOneByName', function () {
    it('should find something by name', function (done) {
      containers.findOneByName('test-container')
        .then(function (o) { expect(o).to.deep.equal(container); })
        .finally(done);
    });

    it('should return NotFoundError if cannot find container', function (done) {
      containers.findOneByName('nope-container')
        .then(function () {
          throw new Error('it should have returned NotFoundError');
        })
        .catch(function (err) {
          expect(err).to.be.an.instanceof(NotFoundError);
        })
        .finally(done);
    });
  });

  describe('findOneByIdOrName', function () {
    it('should find one by name', function (done) {
      containers.findOneByIdOrName('test-container')
        .then(function (o) { expect(o).to.deep.equal(container); })
        .finally(done);
    });
    it('should find one by id', function (done) {
      containers.findOneByIdOrName(4)
        .then(function (o) { expect(o).to.deep.equal(container); })
        .finally(done);
    });
  });

  describe('deleteById', function () {
    it('should remove a container and emit event', function (done) {
      var expectedEvents = ['destroy'];
      var count = createCount(expectedEvents.length + 1, done);
      containers.on('event', function (type, c) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        expect(c).to.deep.equal(container);
        count.next();
      });
      containers.deleteById(4)
        .finally(count.next);
    });
  });

  describe('listContainers', function () {
    it('should list containers', function (done) {
      containers.listContainers()
        .then(function (containers) {
          expect(containers).to.have.length(1);
          expect(containers[0]).to.deep.contain({ Id: 4, Image: 'ubuntu' });
        })
        .finally(done);
    });
  });

  describe('createContainer', function () {
    it('should create a container', function (done) {
      containers.createContainer({})
        .then(function () {
          return containers.listContainers();
        })
        .then(function (containers) {
          expect(containers).to.have.length(2);
        })
        .finally(done);
    });
    it('should register for container events and emit create', function (done) {
      var expectedEvents = [ 'create', 'start' ];
      var count = createCount(expectedEvents.length + 1, done);
      containers.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        count.next();
      });
      containers.createContainer({})
        .then(function (container) {
          return container.start();
        })
        .finally(count.next);
    });
  });
});
