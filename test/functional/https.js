'use strict';

var dockerMock = require('../../lib/index');
var fs = require('fs');
var https = require('https');
var join = require('path').join;

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var after = lab.after;
var before = lab.before;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

var docker = require('dockerode')({
  protocol: 'https',
  host: 'localhost',
  port: 8443,
  ca: fs.readFileSync(join(__dirname, 'certs/ca.pem')),
  cert: fs.readFileSync(join(__dirname, 'certs/cert.pem')),
  key: fs.readFileSync(join(__dirname, 'certs/key.pem'))
});

describe('https', function () {
  var server;
  before(function (done) {
    server = https.createServer({
      ca: fs.readFileSync(join(__dirname, 'certs/ca.pem')),
      cert: fs.readFileSync(join(__dirname, 'certs/server-cert.pem')),
      key: fs.readFileSync(join(__dirname, 'certs/server-key.pem'))
    }, dockerMock).listen(8443, done);
  });
  after(function (done) { server.close(done); });

  it('should successfully connect', function (done) {
    docker.info(function (err, data) {
      if (err) { return done(err); }
      expect(data).to.deep.equal({
        Containers: 0,
        Images: 0,
        Mock: true
      });
      done();
    });
  });
});
