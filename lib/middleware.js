/**
 * @module lib/middleware
 */
'use strict';

var containers = {};
var images = {};
var tags = {};

var assign = require('101/assign');
var duplexEmitter = require('duplex-emitter');
var exists = require('101/exists');
var find = require('101/find');
var join = require('path').join;
var keypath = require('keypather')();
var pick = require('101/pick');
var stream = require('stream');
var tar = require('tar');
var zlib = require('zlib');

var StringStream = require('./string-stream');
var utils = require('./utils');

var pid = 0;
function newPid () { return pid++; }
var port = 0;
function newPort () { return port++; }

var imageHistory = {};

var middlewares = module.exports = {
  eventsStream: new stream.Stream(),
  combine: function (req, res, next) {
    if (!req.data) { req.data = {}; }
    if (req.params.registry && req.params.namespace && req.params.repository) {
      req.data.repository = join(
        req.params.registry,
        req.params.namespace,
        req.params.repository);
    } else if (req.params.namespace && req.params.repository) {
      req.data.repository = join(req.params.namespace, req.params.repository);
    } else {
      req.data.repository = req.params.repository;
    }
    next();
  },
  findImage: function (req, res, next) {
    if (images[req.params.repository]) {
      req.data.image = images[req.params.repository];
      return next();
    }
    var repoSplit = req.params.repository.split(':');
    var repo = repoSplit[0];
    var tag = repoSplit[1] || 'latest';
    repo = repo + ':' + tag;
    var name = [
      req.params.registry,
      req.params.namespace,
      repo
    ].filter(exists).join('/');
    var imageId = tags[name];
    if (!imageId) { return res.sendStatus(404); }
    if (imageId && !images[imageId]) { return res.sendStatus(500); }
    req.data.image = images[imageId];
    req.data.image.RepoTags = [name];
    next();
  },
  buildImage: function (req, res) {
    var foundDockerFile = false;
    // TODO query.t is required
    var repoSplit = req.query.t.split(':');
    var repo = repoSplit[0];
    var tag = repoSplit[1] || 'latest';
    repo = repo + ':' + tag;
    var name = [
      req.params.registry,
      req.params.namespace,
      repo
    ].filter(exists).join('/');
    var intentionalFail = req.query.fail || false;
    // for a little extra flexability, we'll support gzip
    if (req.headers['content-type'] === 'application/x-gzip') {
      req = req.pipe(zlib.createGunzip());
    }
    var dockerfile = '';
    req.pipe(tar.Parse()). // eslint-disable-line
      on('entry', function (entry) {
        if (entry.props.path === './Dockerfile') { foundDockerFile = true; }
        if (entry.props.path === 'Dockerfile') {
          foundDockerFile = true;
          entry.on('data', function (d) {
            dockerfile += d.toString();
          });
        }
      }).
      on('end', function () {
        if (intentionalFail) {
          return resError(500, 'Intentional failure.');
        } else if (!foundDockerFile) {
          return resError(500, 'A Dockerfile is required');
        }
        var id = utils.randomId();
        images[id] = {
          id: id,
          Created: new Date() / 1000 | 0
        };
        tags[name] = id;
        var now = 1411762135;
        imageHistory[id] = dockerfile
          .split('\n')
          .reverse()
          .map(function (line, index) {
            return {
              Id: utils.randomId(),
              Created: now - (100000 * index),
              CreatedBy: line,
              Size: line.length,
              Tags: null
            };
          });
        res.status(200).json({ stream: 'Successfully built ' + id });
      });

    function resError (code, message) {
      res.status(code).json({
        error: 'Server Error - ' + message,
        errorDetail: {
          code: code,
          message: message
        }
      });
    }
  },
  findContainer: function (req, res, next) {
    if (!req.data) { req.data = {}; }
    var containerId = req.query.container || req.params.id;
    if (!containerId) { return res.sendStatus(404); }
    var foundId = find(Object.keys(containers), function (id) {
      return id.indexOf(containerId) === 0 ||
        containers[id].name === containerId;
    });
    if (!foundId) { return res.sendStatus(404); }
    req.data.container = containers[foundId];
    next();
  },
  attachContainer: function (req, res) {
    setTimeout(function () {
      res.sendStatus(200);
    }, 50);
  },
  createContainer: function (req, res, next) {
    var Id = utils.randomId();
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
        Labels: keypath.get(req, 'body.Labels') || {},
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
    };
    delete req.body.Labels;
    data = assign(data, req.body);
    containers[data.Id] = data;
    req.data = { container: containers[data.Id] };
    next();
  },
  commitContainer: function (req, res, next) {
    if (!req.data.container) { return res.sendStatus(500); }
    var container = req.data.container;
    var repo = req.query.repo;
    var tag = req.query.tag;
    var imageId = utils.randomId();

    tag = tag || 'latest';
    var name = [ repo, tag ].filter(exists).join(':');
    tags[name] = imageId;

    images[imageId] = {
      id: imageId,
      container: container.Id,
      RepoTags: [name]
    };

    req.data = { image: { Id: imageId } };
    next();
  },
  startContainer: function (req, res, next) {
    if (!req.data.container) { return res.sendStatus(500); }
    if (req.data.container.State.Running) {
      return res.status(304).send({ message: 'Container already running' });
    }
    var Id = req.data.container.Id;
    var container = containers[Id];

    container.State = {
      // TODO: more data!
      Running: true,
      Pid: newPid()
    };
    container.NetworkSettings = {
      Bridge: 'docker0',
      Gateway: '172.17.42.1',
      IPAddress: '172.17.0.' + newPort(),
      IPPrefixLen: 16,
      MacAddress: '02:42:ac:11:00:05',
      Ports: {
        '80/tcp': [{ HostPort: newPort() }],
        '443/tcp': [{ HostPort: newPort() }],
        '15000/tcp': [{ HostPort: newPort() }]
      }
    };
    req.data.container.State = container.State;
    req.data.container.NetworkSettings = container.NetworkSettings;
    next();
  },
  stopContainer: function (ignoreAlreadyStopped) {
    return function (req, res, next) {
      if (!req.data.container) { return res.sendStatus(500); }
      var Id = req.data.container.Id;
      var container = containers[Id];
      if (container.State.Running === false && !ignoreAlreadyStopped) {
        return res.status(304).send({ message: 'Container already stopped' });
      }
      container.State = {
        // TODO: more data!
        Running: false,
        Pid: 0
      };
      container.NetworkSettings = {
        Bridge: '',
        Gateway: '',
        IPAddress: '',
        IPPrefixLen: 0,
        MacAddress: '',
        Ports: null
      };
      req.data.container.State = container.State;
      next();
    };
  },
  stopAndWaitContainer: function (req, res) {
    middlewares.stopContainer(containers, true)(req, res, wait);
    function wait () {
      if (!req.data.container) { return res.sendStatus(500); }
      setTimeout(function () {
        res.status(200).json({ StatusCode: 0 });
      }, 25);
    }
  },
  deleteContainer: function (req, res, next) {
    if (!req.data.container) { return res.sendStatus(500); }
    var Id = req.data.container.Id;
    delete containers[Id];
    next();
  },
  deleteImage: function (req, res) {
    delete images[req.data.image.id];
    for (var i in req.data.image.RepoTags) {
      delete tags[req.data.image.RepoTags[i]];
    }
    res.sendStatus(200);
  },
  respondImage: function (code, pickFields) {
    return function (req, res) {
      if (!req.data || !req.data.image) { return res.sendStatus(500); }
      if (pickFields) { req.data.image = pick(req.data.image, pickFields); }
      res.status(code || 200).json(req.data.image);
    };
  },
  respondImageHistory: function (req, res) {
    // we didn't find the image
    if (!req.data || !req.data.image) { return res.sendStatus(404); }
    // we don't have a history (we should)
    if (!imageHistory[req.data.image.id]) { return res.sendStatus(500); }
    res.status(200).json(imageHistory[req.data.image.id]);
  },
  respondImages: function (req, res) {
    var data = Object.keys(images).map(function (id) {
      return {
        Id: id,
        Created: images[id].Created,
        RepoTags: Object.keys(tags).reduce(function (memo, tag) {
          if (tags[tag] === id) { memo.push(tag); }
          return memo;
        }, [])
      };
    });
    res.status(200).json(data);
  },
  emitEvent: function (status) {
    return function (req, res, next) {
      if (!req.data || !req.data.container) { return next(); }
      middlewares.eventsStream.emit('data', JSON.stringify({
        status: status,
        time: new Date().getTime(),
        id: req.data.container.Id,
        // TODO ideally it shouldn't be hardcoded,
        // but it seem that we can't get it now
        from: 'ubuntu:latest'
      }));
      next();
    };
  },
  respondContainer: function (code) {
    return function (req, res) {
      if (!req.data || !req.data.container) { return res.sendStatus(500); }
      if (code && code === 204) {
        res.sendStatus(204);
      } else {
        res.status(code || 200).send(req.data.container);
      }
    };
  },
  respondContainers: function (req, res) {
    res.status(200).json(Object.keys(containers).map(function (id) {
      var container = containers[id];
      return {
        Id: container.Id,
        Image: container.Image,
        Created: container.Created
        // TODO: extend with other data we may want
      };
    }));
  },
  respondLogStream: function (statusCode) {
    return function (req, res) {
      var stringStream = new StringStream('Just a bunch of text');
      res.status(statusCode);
      stringStream.pipe(res);
    };
  },
  getInfo: function (req, res) {
    res.json({
      Containers: Object.keys(containers).length,
      Images: Object.keys(images).length,
      Mock: true
      // TODO: any other information we need?
    });
  },
  // status is optional
  generateEvent: function (status) {
    var statuses = [
      'create',
      'destroy',
      'die',
      'export',
      'kill',
      'pause',
      'restart',
      'start',
      'stop',
      'unpause',
      'untag',
      'delete'
    ];
    var froms = [ 'sequenceiq/socat:latest', 'base:latest', 'nginx:latest' ];
    var id = utils.randomId();
    var from = froms[Math.floor(Math.random() * froms.length)];
    var time = new Date().getTime();
    status = status || statuses[Math.floor(Math.random() * statuses.length)];
    return JSON.stringify({
      status: status,
      id: id,
      from: from,
      time: time
    });
  },
  getEvents: function () {
    return function (req, res) {
      // do streaming when params are not specified
      // send response immediately when params are there
      if (req.query.since || req.query.until) {
        res.set('Content-Type', 'application/json');
        var data = '';
        for (var i = 0; i < 100; i++) {
          data += middlewares.generateEvent();
        }
        res.send(data);
      } else {
        res.writeHead(200, {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked'
        });
        // Force flush headers - Write headers to socket and mark as sent
        res.socket.write(res._header);
        res._headerSent = true;
        middlewares.eventsStream.pipe(res);
        // by default every 100ms new random event would be generated
        // and pushed to the response stream
        // if DISABLE_RANDOM_EVENTS = true than no event would be generated.
        if (!process.env.DISABLE_RANDOM_EVENTS) {
          setInterval(function () {
            middlewares.eventsStream.emit('data', middlewares.generateEvent());
          }, 100);
        }
      }
    };
  },
  getVersion: function (req, res) {
    res.json({
      Arch: 'amd64',
      GitCommit: 3600720,
      GoVersion: 'go1.2.1',
      KernelVersion: '3.13.3-tinycore64',
      Os: 'linux',
      Version: '0.9.1'
    });
  },
  pushRepo: function (req, res) {
    var repoSplit = req.params.repository.split(':');
    var repo = repoSplit[0];
    var tag = repoSplit[1] || 'latest';
    repo = repo + ':' + tag;
    var name = [
      req.params.registry,
      req.params.namespace,
      repo
    ].filter(exists).join('/');
    var imageId = tags[name];
    if (!imageId) {
      res.set('Connection', 'close');
      res.sendStatus(404);
    } else {
      res.status(200).json({ stream: 'Successfully pushed' });
    }
  },
  createImage: function (req, res) {
    var id = utils.randomId();
    var from = req.query.fromImage;
    var emitter = duplexEmitter(res);
    if (!from) {
      emitter.emit({ status: 'Downloading from http://' });
      emitter.emit({
        errorDetail: {
          message: 'Get http://: http: no Host in request URL'
        },
        error: 'Get http://: http: no Host in request URL'
      });
      return res.end();
    }
    images[id] = {
      id: id,
      Created: parseInt(keypath.get(req, 'query.Created')) ||
        (new Date() / 1000 | 0)
    };
    tags[from + ':' + (req.query.tag || 'latest')] = id;
    emitter.emit({
      status: 'The image you are pulling has been verified',
      id: from
    });
    for (var i = 0; i < 100; i++) {
      emitter.emit({
        status: 'Pulling',
        progress: i + ' B/ 100 B',
        progressDetail: {
          current: i,
          total: 100
        }
      });
    }
    emitter.emit({
      status: 'Status: Image is up to date for' + from
    });
    res.end();
  },
  notYetImplemented: function (req, res) {
    res.status(501).send(
      'endpoint not yet implemented: ' + req.method + ' ' + req.path);
  }
};

