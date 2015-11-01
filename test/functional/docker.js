'use strict';

var chai = require('chai');
var assert = chai.assert;

var checkClean = require('./fixtures').checkClean;
var dockerMock = require('../../lib/index');
var request = require('request');

var docker = require('dockerode')({
  host: 'http://localhost',
  port: 5354
});

describe('docker misc', function () {
  var server;
  before(function (done) { server = dockerMock.listen(5354, done); });
  // make sure we are starting with a clean mock
  // (tests should clean-up after themselves)
  beforeEach(function (done) { checkClean(docker, done); });
  after(function (done) { server.close(done); });

  describe('/info', function () {
    it('should return info data', function (done) {
      docker.info(function (err, data) {
        if (err) { return done(err); }
        assert.propertyVal(data, 'Mock', true);
        done();
      });
    });
  });

  describe('/version', function () {
    it('should return version data', function (done) {
      docker.version(function (err, data) {
        if (err) { return done(err); }
        assert.ok(data.Os);
        done();
      });
    });
  });

  describe('invalid endpoints', function () {
    it('should respond with an error', function (done) {
      request.get('http://localhost:5354/_nope', function (err, res) {
        if (err) {
          done(err);
        } else if (res.statusCode !== 501) {
          done('should have sent a 501 error');
        } else {
          done();
        }
      });
    });
  });
});
