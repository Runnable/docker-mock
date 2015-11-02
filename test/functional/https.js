'use strict'

var chai = require('chai')
var assert = chai.assert

var dockerMock = require('../../lib/index')
var fs = require('fs')
var https = require('https')
var join = require('path').join

var docker = require('dockerode')({
  protocol: 'https',
  host: 'localhost',
  port: 8443,
  ca: fs.readFileSync(join(__dirname, 'certs/ca.pem')),
  cert: fs.readFileSync(join(__dirname, 'certs/cert.pem')),
  key: fs.readFileSync(join(__dirname, 'certs/key.pem'))
})

describe('https', function () {
  var server
  before(function (done) {
    server = https.createServer({
      ca: fs.readFileSync(join(__dirname, 'certs/ca.pem')),
      cert: fs.readFileSync(join(__dirname, 'certs/server-cert.pem')),
      key: fs.readFileSync(join(__dirname, 'certs/server-key.pem'))
    }, dockerMock).listen(8443, done)
  })
  after(function (done) { server.close(done) })

  it('should successfully connect', function (done) {
    docker.info(function (err, data) {
      if (err) { return done(err) }
      assert.deepEqual(data, {
        Containers: 0,
        Images: 0,
        Mock: true
      })
      done()
    })
  })
})
