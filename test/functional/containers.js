'use strict';

var async = require('async');
var checkClean = require('./fixtures').checkClean;
var concat = require('concat-stream');
var createCount = require('callback-count');
var dockerMock = require('../../lib/index');
var noop = require('101/noop');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var after = lab.after;
var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

var docker = require('dockerode')({
  host: 'http://localhost',
  port: 5354
});

describe('containers', function () {
  var server;
  before(function (done) { server = dockerMock.listen(5354, done); });
  // make sure we are starting with a clean mock
  // (tests should clean-up after themselves)
  beforeEach(function (done) { checkClean(docker, done); });
  after(function (done) { server.close(done); });

  it('should create and delete a container', function (done) {
    async.waterfall([
      docker.createContainer.bind(docker, {}),
      function (container, cb) {
        var count = createCount(cb);
        // eventsStream.on('data', expectStatus('destroy', count.inc().next));
        container.remove(count.inc().next);
      }
    ], done);
  });
  it('should create a container with env in the body', function (done) {
    var createData = {
      name: 'hello',
      Env: ['MY_AWESOME_ENV_VARIABLE=inconceivable']
    };
    async.waterfall([
      docker.createContainer.bind(docker, createData),
      function (container, cb) {
        container.inspect(cb);
      }
    ], function (err, containerData) {
      if (err) { return done(err); }
      // this should be capitalized and used
      expect(containerData.Name).to.equal('/' + createData.name);
      expect(containerData.Env).to.be.an.array();
      expect(containerData.Env).to.have.length(1);
      expect(containerData.Env[0]).to.equal(createData.Env[0]);
      docker.getContainer(createData.name).remove(done);
    });
  });
  it('should list all the containers when there are none', function (done) {
    docker.listContainers(function (err, containers) {
      if (err) { return done(err); }
      expect(containers.length).to.equal(0);
      done();
    });
  });
  describe('labels', function () {
    var container;
    var Labels = {
      type: 'user-container',
      ultimateQuestion: 'batmanvssuperman',
      obviousAnswer: 'superman'
    };
    beforeEach(function (done) {
      docker.createContainer({
        Labels: Labels
      }, function (err, c) {
        if (err) { return done(err); }
        container = c;
        done();
      });
    });
    afterEach(function (done) {
      container.remove(done);
    });
    it('should save Labels on create and respond with Labels on inspect',
    function (done) {
      container.inspect(function (err, data) {
        if (err) { return done(err); }
        expect(data.Config.Labels).to.deep.contain(Labels);
        done();
      });
    });
  });
  describe('interactions', function () {
    var container;
    beforeEach(function (done) {
      docker.createContainer({}, function (err, c) {
        if (err) { return done(err); }
        container = c;
        done();
      });
    });
    afterEach(function (done) {
      container.remove(done);
    });

    it('should list all the containers', function (done) {
      docker.listContainers(function (err, containers) {
        if (err) { return done(err); }
        expect(containers.length).to.equal(1);
        expect(containers[0].Id).to.equal(container.id);
        done();
      });
    });
    it('should give us information about it', function (done) {
      container.inspect(function (err, data) {
        if (err) { return done(err); }
        expect(data.Id).to.equal(container.id);
        done();
      });
    });
    it('should attach to the container', function (done) {
      container.attach({}, function (err, stream) {
        if (err) { return done(err); }
        stream.on('data', noop);
        stream.on('end', function () { done(); });
      });
    });
    it('should error on an unknown container', function (done) {
      docker.getContainer('nope').inspect(function (err) {
        // FIXME(bryan): not checking for 404
        if (err) {
          done();
        } else {
          done('should have return a 404');
        }
      });
    });
    it('should be able to commit a container to an image', function (done) {
      async.waterfall([
        function (cb) {
          container.commit({
            repo: 'committedContainer'
          }, cb);
        },
        function (imageData, cb) {
          var image = docker.getImage('committedContainer');
          image.inspect(function (err, data) {
            if (err) { return cb(err); }
            expect(data.Id).to.contain(imageData.Id);
            cb(null, image);
          });
        },
        function (image, cb) {
          image.remove(cb);
        }
      ], done);
    });
    it('should be able to start it', function (done) {
      var count = createCount(2, done);
      dockerMock.events.stream.on('data', function (data) {
        dockerMock.events.stream.removeAllListeners('data');
        data = JSON.parse(data);
        expect(data).to.deep.contain({
          status: 'start',
          id: container.id
        });
        count.next();
      });
      async.series([
        container.start.bind(container),
        container.inspect.bind(container)
      ], function (err, data) {
        if (err) { return count.next(err); }
        data = data[1]; // get the inspect data
        expect(data.State.Running).to.be.true();
        expect(data.State.Pid).to.be.a.number();
        count.next();
      });
    });
    it('should be able to get the logs', function (done) {
      async.series([
        container.start.bind(container),
        container.logs.bind(container, {})
      ], function (err, data) {
        if (err) { return done(err); }
        var logs = data[1];
        var count = createCount(2, done);
        logs.pipe(concat(function (logBuffer) {
          expect(logBuffer.toString()).to.equal('Just a bunch of text');
          count.next();
        }));
        logs.on('end', function () { count.next(); });
      });
    });
    it('should should not start twice', function (done) {
      var originalInspect;
      async.series([
        container.start.bind(container),
        function (cb) {
          container.inspect(function (err, data) {
            originalInspect = data;
            cb(err);
          });
        },
        container.start.bind(container)
      ], function (seriesErr) {
        if (!seriesErr) { return done('should not have started second time'); }
        container.inspect(function (err, data) {
          if (err) { return done(err); }
          expect(data).to.deep.equal(originalInspect);
          done();
        });
      });
    });
    it('should be able to stop it', function (done) {
      var count = createCount(4, function (err) {
        dockerMock.events.stream.removeAllListeners('data');
        done(err);
      });
      // these events should happen in this order
      var expectedEvents = [ 'start', 'die', 'stop' ];
      dockerMock.events.stream.on('data', function (data) {
        data = JSON.parse(data);
        var expectedEvent = expectedEvents.shift();
        expect(data).to.deep.contain({
          status: expectedEvent,
          id: container.id
        });
        count.next();
      });
      async.series([
        container.start.bind(container),
        container.stop.bind(container),
        container.inspect.bind(container)
      ], function (err, data) {
        if (err) { return count.next(err); }
        data = data[2];
        expect(data.State.Running).to.be.false();
        expect(data.State.Pid).to.equal(0);
        count.next();
      });
    });
    it('should be able to stop and wait for it to stop', function (done) {
      async.series([
        container.start.bind(container),
        container.wait.bind(container),
        container.inspect.bind(container)
      ], function (err, data) {
        if (err) { return done(err); }
        data = data[2];
        expect(data.State.Running).to.be.false();
        expect(data.State.Pid).to.equal(0);
        done();
      });
    });
    it('should come back with an error if stopped twice', function (done) {
      async.series([
        container.start.bind(container),
        container.stop.bind(container)
      ], function (seriesErr) {
        if (seriesErr) { return done(seriesErr); }
        container.stop(function (stopErr) {
          expect(stopErr.statusCode).to.equal(304);
          container.inspect(function (err, data) {
            if (err) { return done(err); }
            expect(data.State.Running).to.be.false();
            expect(data.State.Pid).to.equal(0);
            done();
          });
        });
      });
    });
    it('should be able to kill it', function (done) {
      var count = createCount(4, function (err) {
        dockerMock.events.stream.removeAllListeners('data');
        done(err);
      });
      // these events should happen in this order
      var expectedEvents = [ 'start', 'die', 'kill' ];
      dockerMock.events.stream.on('data', function (data) {
        data = JSON.parse(data);
        var expectedEvent = expectedEvents.shift();
        expect(data).to.deep.contain({
          status: expectedEvent,
          id: container.id
        });
        count.next();
      });
      async.series([
        container.start.bind(container),
        container.kill.bind(container)
      ], function (seriesErr) {
        if (seriesErr) { return count.next(seriesErr); }
        container.inspect(function (err, data) {
          if (err) { return count.next(err); }
          expect(data.State.Running).to.be.false();
          expect(data.State.ExitCode).to.equal(1);
          count.next();
        });
      });
    });
    it('should be able to kill it w/ a signal', function (done) {
      var count = createCount(4, function (err) {
        dockerMock.events.stream.removeAllListeners('data');
        done(err);
      });
      // these events should happen in this order
      var expectedEvents = [ 'start', 'die', 'kill' ];
      dockerMock.events.stream.on('data', function (data) {
        data = JSON.parse(data);
        var expectedEvent = expectedEvents.shift();
        expect(data).to.deep.contain({
          status: expectedEvent,
          id: container.id
        });
        count.next();
      });
      async.series([
        container.start.bind(container),
        container.kill.bind(container, { signal: 'SIGINT' })
      ], function (seriesErr) {
        if (seriesErr) { return count.next(seriesErr); }
        container.inspect(function (err, data) {
          if (err) { return count.next(err); }
          expect(data.State.Running).to.be.false();
          // 0 anything other than SIGKILL
          expect(data.State.ExitCode).to.equal(0);
          count.next();
        });
      });
    });
    it('should be able to restart it', function (done) {
      var count = createCount(5, function (err) {
        dockerMock.events.stream.removeAllListeners('data');
        done(err);
      });
      // these events should happen in this order
      var expectedEvents = [ 'start', 'die', 'start', 'restart' ];
      dockerMock.events.stream.on('data', function (data) {
        data = JSON.parse(data);
        var expectedEvent = expectedEvents.shift();
        expect(data).to.deep.contain({
          status: expectedEvent,
          id: container.id
        });
        count.next();
      });
      async.series([
        container.start.bind(container),
        container.restart.bind(container)
      ], function (seriesErr) {
        if (seriesErr) { return count.next(seriesErr); }
        container.inspect(function (err, data) {
          if (err) { return count.next(err); }
          // FIXME: these test are broken. this does not return true
          expect(data.State.Running).to.be.true();
          count.next();
        });
      });
    });
  });
});
