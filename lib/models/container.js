'use strict'

var assign = require('101/assign')
var EventEmitter = require('events').EventEmitter
var mapKeys = require('object-loops/map-keys')
var NotModifiedError = require('./base-store').NotModifiedError
var Promise = require('bluebird')
var util = require('util')
var utils = require('../utils')

module.exports = Container

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
