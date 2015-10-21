'use strict';

var Container = require('../../lib/models/container');
var NotModifiedError = require('../../lib/models/base-store').NotModifiedError;
var createCount = require('callback-count');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

describe('Container', function () {
  var container;
  beforeEach(function (done) {
    container = new Container();
    done();
  });

  describe('constructor options', function () {
    it('should respect various options passed in', function (done) {
      var opts = {
        Labels: { hello: 'world' },
        Image: 'ubuntu'
      };
      var c = new Container(opts);
      expect(c.Config.Labels).to.deep.equal({ hello: 'world' });
      expect(c.Image).to.equal('ubuntu');
      done();
    });
  });

  describe('start', function () {
    it('should start and emit the correct events', function (done) {
      var expectedEvents = ['start'];
      var count = createCount(expectedEvents.length + 1, done);
      container.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        count.next();
      });
      container.start()
        .then(function (c) {
          expect(c.State.Running).to.be.true();
          expect(c.NetworkSettings.Ports).to.exist();
        })
        .finally(count.next);
    });
    it('should throw NotModifiedError if already started', function (done) {
      container.State.Running = true;
      container.start()
        .then(function () {
          throw new Error('it should have returned NotFoundError');
        })
        .catch(function (err) {
          expect(err).to.be.instanceof(NotModifiedError);
        })
        .finally(done);
    });
  });

  describe('restart (it\'s start/stop)', function () {
    it('should start and emit the correct events', function (done) {
      var expectedEvents = [ 'start', 'restart' ];
      var count = createCount(expectedEvents.length + 1, done);
      container.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        count.next();
      });
      // start(true) => restart
      container.start(true)
        .finally(count.next);
    });
    it('should stop and emit the correct events', function (done) {
      var expectedEvents = ['die'];
      var count = createCount(expectedEvents.length + 1, done);
      container.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        count.next();
      });
      // start(true) => restart
      container.stop('restart')
        .finally(count.next);
    });
  });

  describe('stop', function () {
    it('should stop and emit the correct events', function (done) {
      var expectedEvents = [ 'die', 'stop' ];
      var count = createCount(expectedEvents.length + 1, done);
      container.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        count.next();
      });
      container.State.Running = true;
      container.stop()
        .finally(count.next);
    });
    it('should throw NotModifiedError if already stopped', function (done) {
      container.stop()
        .then(function () {
          throw new Error('it should have returned NotFoundError');
        })
        .catch(function (err) {
          expect(err).to.be.instanceof(NotModifiedError);
        })
        .finally(done);
    });
  });

  describe('kill (stop)', function () {
    it('should stop via kill (default to SIGKILL) and emit the correct events', function (done) {
      var expectedEvents = [ 'die', 'kill' ];
      var count = createCount(expectedEvents.length + 1, done);
      container.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        count.next();
      });
      container.State.Running = true;
      container.stop('kill')
        .then(function (c) {
          expect(c.State.Running).to.be.false();
          expect(c.State.ExitCode).to.equal(0);
        })
        .finally(count.next);
    });
    it('should stop via kill and emit the correct events', function (done) {
      var expectedEvents = [ 'die', 'kill' ];
      var count = createCount(expectedEvents.length + 1, done);
      container.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        count.next();
      });
      container.State.Running = true;
      container.stop('kill', 'SIGKILL')
        .then(function (c) {
          expect(c.State.Running).to.be.false();
          expect(c.State.ExitCode).to.equal(1);
        })
        .finally(count.next);
    });
    it('should stop via kill w/ signal and emit the correct events', function (done) {
      var expectedEvents = [ 'die', 'kill' ];
      var count = createCount(expectedEvents.length + 1, done);
      container.on('event', function (type) {
        var expectedEvent = expectedEvents.shift();
        expect(type).to.equal(expectedEvent);
        count.next();
      });
      container.State.Running = true;
      container.stop('kill', 'SIGINT')
        .then(function (c) {
          expect(c.State.Running).to.be.false();
          expect(c.State.ExitCode).to.equal(0);
        })
        .finally(count.next);
    });
  });
});
