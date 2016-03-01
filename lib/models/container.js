'use strict'

var assign = require('101/assign')
var EventEmitter = require('events').EventEmitter
var mapKeys = require('object-loops/map-keys')
var NotModifiedError = require('./base-store').NotModifiedError
var Promise = require('bluebird')
var stream = require('stream')
var util = require('util')
var utils = require('../utils')

var sampleStats = require('./stats-sample.json')

module.exports = Container

var streams = new Map()

function Container (opts) {
  if (!opts) { opts = {} }
  var Id = utils.randomId()
  var data = {
    Id: Id,
    Memory: 0,
    MemorySwap: 0,
    Image: null,
    Config: {
      AttachStderr: true,
      AttachStdin: false,
      AttachStdout: true,
      Cmd: [],
      Env: [],
      ExposedPorts: {},
      Hostname: '',
      Image: null,
      // FIXME: this is a hack
      Labels: opts.Labels || {},
      OpenStdin: false,
      PortSpecs: null,
      StdinOnce: false,
      Tty: false,
      User: '',
      Volumes: {},
      WorkingDir: ''
    },
    HostConfig: {
      Dns: null,
      VolumesFrom: ''
    },
    Volumes: {},
    State: {
      Running: false,
      Pid: -1
    },
    NetworkSettings: {
      Bridge: '',
      Gateway: '',
      IPAddress: '',
      IPPrefixLen: 0,
      MacAddress: '',
      Ports: null
    }
  }
  delete opts.Labels
  var capitalizedOpts = mapKeys(opts, utils.capitalize)
  if (capitalizedOpts.Name) {
    capitalizedOpts.Name = '/' + capitalizedOpts.Name
  }
  assign(this, data, capitalizedOpts)

  var self = this
  streams.set(Id, new stream.Readable({
    objectMode: true,
    highWaterMark: 1,
    read: function (n) {
      //  console.log('READ')
      if (self.State.Running) {
        // console.log('PUSH')
        this.push(sampleStats)
      } else {
        self.once('event', function (event) {
          if (event === 'start' || event === 'restart') {
            this.push(sampleStats)
          }
        }.bind(this))
      }
    }
  }))
}
util.inherits(Container, EventEmitter)

Container.prototype.start = function (wasRestart) {
  return Promise.resolve()
    .bind(this)
    .then(function () {
      if (this.State.Running) {
        throw new NotModifiedError('Container already running')
      }

      this.State = {
        // TODO: more data!
        Running: true,
        Pid: utils.newPid()
      }
      this.NetworkSettings = {
        Bridge: 'docker0',
        Gateway: '172.17.42.1',
        IPAddress: '172.17.0.' + utils.newPort(),
        IPPrefixLen: 16,
        MacAddress: '02:42:ac:11:00:05',
        Ports: {
          '80/tcp': [{ HostPort: utils.newPort() }],
          '443/tcp': [{ HostPort: utils.newPort() }],
          '15000/tcp': [{ HostPort: utils.newPort() }]
        }
      }
      return this
    })
    .then(function (container) {
      this.emit('event', 'start', container)
      if (wasRestart) {
        this.emit('event', 'restart', container)
      }

      return container
    })
}

Container.prototype.onDelete = function () {
  this.removeAllListeners('event')
  streams.get(this.Id).push(null)
}

Container.prototype.stop = function (ignoreStopped, killSignal) {
  var exitCode = (killSignal === 'SIGKILL') ? 1 : 0
  return Promise.resolve()
    .bind(this)
    .then(function () {
      if (this.State.Running === false && !ignoreStopped) {
        throw new NotModifiedError('Container already stopped')
      }

      this.State = {
        // TODO: more data!
        ExitCode: exitCode,
        Running: false,
        Pid: 0
      }
      this.NetworkSettings = {
        Bridge: '',
        Gateway: '',
        IPAddress: '',
        IPPrefixLen: 0,
        MacAddress: '',
        Ports: null
      }

      return this
    })
    .then(function (container) {
      this.emit('event', 'die', container)
      if (!ignoreStopped) {
        // stop doesn't ignore stopped
        this.emit('event', 'stop', container)
      } else if (ignoreStopped === 'kill') {
        this.emit('event', 'kill', container)
      }

      // nothing special for restart
      return container
    })
}

Container.prototype.getStats = function (req, res) {
  // The default value is stream=1
  if (req.query.stream === '0') {
    res.send(sampleStats)
  } else {
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'transfer-encoding': 'chunked'
    })
    var transform = new stream.Transform({
      writableObjectMode: true,
      transform: function (data, encoding, cb) {
        this.push(JSON.stringify(data) + '\n')
        setTimeout(cb, 1000)
      }
    })
    streams.get(this.Id).pipe(transform).pipe(res)
  }
}
