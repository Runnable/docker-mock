var stream = require('stream');
var _ = require('lodash');
var tar = require('tar');
var zlib = require('zlib');
var join = require('path').join;
var utils = require('./utils');
var series = require('middleware-flow').series;
var pid = 0;
function newPid () { return pid++; }
var port = 0;
function newPort () { return port++; }
var StringStream = require('./string-stream');
var duplexEmitter = require('duplex-emitter');

module.exports = {
  eventsStream: new stream.Stream(),
  combine: function (req, res, next) {
    if (!req.data) req.data = {};
    if (req.params.registry && req.params.namespace && req.params.repository) {
      req.data.repository = join(req.params.registry, req.params.namespace, req.params.repository);
    } else if (req.params.namespace && req.params.repository) {
      req.data.repository = join(req.params.namespace, req.params.repository);
    } else {
      req.data.repository = req.params.repository;
    }
    next();
  },
  findImage: function (images, tags) {
    return function (req, res, next) {
      var repoSplit = req.params.repository.split(':');
      var repo = repoSplit[0];
      var tag = repoSplit[1] || 'latest';
      repo = repo +':'+ tag;
      var name = [req.params.registry, req.params.namespace, repo].filter(exists).join('/');
      var imageId = tags[name];
      if (!imageId) return res.send(404);
      if (imageId && !images[imageId]) return res.send(500);
      req.data.image = images[imageId];
      req.data.image.RepoTags = [name];
      next();
    };
  },
  buildImage: function (images, tags) {
    return function (req, res, next) {
      var foundDockerFile = false;
      // TODO query.t is required
      var repoSplit = req.query.t.split(':');
      var repo = repoSplit[0];
      var tag = repoSplit[1] || 'latest';
      repo = repo +':'+ tag;
      var name = [req.params.registry, req.params.namespace, repo].filter(exists).join('/');
      var intentionalFail = req.query.fail || false;
      // for a little extra flexability, we'll support gzip
      if (req.headers['content-type'] === 'application/x-gzip') {
        req = req.pipe(zlib.createGunzip());
      }
      req.pipe(tar.Parse()).
        on('entry', function (entry) {
          if (entry.props.path === './Dockerfile') foundDockerFile = true;
          if (entry.props.path === 'Dockerfile') foundDockerFile = true;
        }).
        on('end', function () {
          if (intentionalFail) return resError(500, 'Intentional failure.');
          else if (!foundDockerFile) return resError(500, 'A Dockerfile is required');
          var id = utils.randomId();
          images[id] = {
            'id': id
          };
          tags[name] = id;
          res.json(200, { 'stream': 'Successfully built ' + id });
        });

        function resError (code, message) {
          res.json(code, {
            error: 'Server Error - ' + message,
            errorDetail: {
              code: code,
              message: message
            }
          });
        }
    };
  },
  findContainer: function (containers) {
    return function (req, res, next) {
      if (!req.data) req.data = {};
      var containerId = req.query.container || req.params.id;
      if (!containerId) return res.send(404);
      req.data.container = _.find(containers, function (container, id) {
        return id.indexOf(containerId) === 0;
      });
      if (!req.data.container) return res.sendStatus(404);
      var container = req.data.container;
      next();
    };
  },
  attachContainer: function (req, res, next) {
    setTimeout(function () {
      res.send(200);
    }, 50);
  },
  createContainer: function (containers) {
    return function (req, res, next) {
      var Id = utils.randomId();
      var data = {
        'Id': Id,
        'Hostname': '',
        'User': '',
        'Memory': 0,
        'MemorySwap': 0,
        'AttachStdin': false,
        'AttachStdout': true,
        'AttachStderr': true,
        'PortSpecs': null,
        'Tty': false,
        'OpenStdin': false,
        'StdinOnce': false,
        'Env': null,
        'Cmd': [],
        'Dns': null,
        'Image': null,
        'Volumes': {},
        'VolumesFrom': '',
        'WorkingDir': '',
        'ExposedPorts': {},
        'State': {
          Running: false,
          Pid: -1
        },
        'NetworkSettings': {
          Bridge: "",
          Gateway: "",
          IPAddress: "",
          IPPrefixLen: 0,
          MacAddress: "",
          Ports: null
        }
      };
      data = _.extend(data, req.body);
      containers[data.Id] = data;
      req.data = { container: containers[data.Id] };
      next();
    };
  },
  commitContainer: function (images, tags) {
    return function (req, res, next) {
      if (!req.data.container) return res.send(500);
      var container = req.data.container;
      var repo = req.query.repo;
      var tag = req.query.tag;
      var m = req.query.m;
      var author = req.query.author;
      var run = req.query.run;
      var imageId = utils.randomId();

      tag = tag || 'latest';
      var name = [repo, tag].filter(exists).join(':');
      tags[name] = imageId;

      images[imageId] = {
        id: imageId,
        container: container.Id,
        RepoTags: [name]
      };

      req.data = { image: { 'Id': imageId } };
      next();
    };
  },
  startContainer: function (containers) {
    return function (req, res, next) {
      if (!req.data.container) return res.send(500);
      if (req.data.container.State.Running) {
        return res.send(304, {message: 'Container already running'});
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
        IPAddress: '172.17.0.'+newPort(),
        IPPrefixLen: 16,
        MacAddress: '02:42:ac:11:00:05',
        Ports: {
          '80/tcp':[{ HostPort: newPort() }],
          '443/tcp':[{ HostPort: newPort() }],
          '15000/tcp':[{ HostPort: newPort() }]
        }
      };
      req.data.container.State = container.State;
      req.data.container.NetworkSettings = container.NetworkSettings;
      next();
    };
  },
  stopContainer: function (containers, ignoreAlreadyStopped) {
    return function (req, res, next) {
      if (!req.data.container) return res.send(500);
      var Id = req.data.container.Id;
      var container = containers[Id];
      if (container.State.Running === false && !ignoreAlreadyStopped) {
        return res.send(304, {message: 'Container already stopped'});
      }
      container.State = {
        // TODO: more data!
        Running: false,
        Pid: 0
      };
      container.NetworkSettings = {
        Bridge: "",
        Gateway: "",
        IPAddress: "",
        IPPrefixLen: 0,
        MacAddress: "",
        Ports: null
      };
      req.data.container.State = container.State;
      next();
    };
  },
  stopAndWaitContainer: function (containers) {
    var self = this;
    return function (req, res, next) {
      self.stopContainer(containers, true)(req, res, wait);
      function wait () {
        if (!req.data.container) return res.send(500);
        setTimeout(function () {
          res.json(200, { 'StatusCode': 0 });
        }, 25);
      }
    };
  },
  deleteContainer: function (containers) {
    return function (req, res, next) {
      if (!req.data.container) return res.send(500);
      var Id = req.data.container.Id;
      delete containers[Id];
      next();
    };
  },
  deleteImage: function (images, tags) {
    return function (req, res, next) {
      delete images[req.data.image.id];
      for (var i in req.data.image.RepoTags) {
        delete tags[req.data.image.RepoTags[i]];
      }
      res.send(200);
    };
  },
  respondImage: function (code, pick) {
    return function (req, res, next) {
      if (!req.data || !req.data.image) return res.send(500);
      if (pick) req.data.image = _.pick(req.data.image, pick);
      res.json(code || 200, req.data.image);
    };
  },
  respondImages: function (images, tags) {
    return function (req, res, next) {
      var data = _.map(images, function (image, id) {
        return {
          'Id': id,
          'RepoTags': _.transform(tags, function (acc, imageId, tag) {
            if (imageId === id) acc.push(tag);
          }, [])
        };
      });
      res.json(200, data);
    };
  },
  emitEvent: function(status) {
    var self = this;
    return function (req, res, next) {
      if (!req.data || !req.data.container) return next();
      self.eventsStream.emit('data', JSON.stringify({
        status: status,
        time: new Date().getTime(),
        id: req.data.container.Id,
        from: 'ubuntu:latest' // TODO ideally it shouldn't be hardcoded. But it seem tha we can't get it now
      }));
      next();
    };
  },
  respondContainer: function (code, pick) {
    return function (req, res, next) {
      if (!req.data || !req.data.container) return res.send(500);
      if (pick) req.data.container = _.pick(req.data.container, pick);
      if (code && code === 204) res.send(204);
      else res.status(code || 200).send(req.data.container);
    };
  },
  respondContainers: function (containers) {
    return function (req, res, next) {
      res.json(200, _.map(containers, function (container, Id) {
        return {
          'Id': container.Id,
          'Image': container.Image,
          'Created': container.Created
          // TODO: extend with other data we may want
        };
      }));
    };
  },
  respondLogStream: function (statusCode) {
    return function (req, res, next) {
      var stream = new StringStream('Just a bunch of text');
      res.status(statusCode || 200);
      stream.pipe(res);
    };
  },
  getInfo: function (containers, images) {
    return function (req, res, next) {
      res.json({
        'Containers': _.size(containers),
        'Images': _.size(images),
        'Mock': true
        // TODO: any other information we need?
      });
    };
  },
  generateEvent: function () {
    var statuses = ['create', 'destroy', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause', 'untag', 'delete'];
    var froms = ['sequenceiq/socat:latest', 'base:latest', 'nginx:latest'];
    var id = utils.randomId();
    var from = froms[Math.floor(Math.random() * froms.length)];
    var time = new Date().getTime();
    var status = statuses[Math.floor(Math.random() * statuses.length)];
    return JSON.stringify({
      status: status,
      id: id,
      from: from,
      time: time
    });
  },
  getEvents: function () {
    var self = this;
    return function (req, res) {
      // do streaming when params are not specified
      res.set('Content-Type', 'application/json');

      // send response immediately when params are there
      if (req.query.since || req.query.until) {
        var data = '';
        for (var i = 0; i < 100; i++) {
          data += self.generateEvent();
        }
        res.send(data);
      } else {
        self.eventsStream.pipe(res);
        // by default every 100ms new random event would be generated and pushed to the response stream
        // if DISABLE_RANDOM_EVENTS = true than no event would be generated.
        if (!process.env.DISABLE_RANDOM_EVENTS) {
          setInterval(function () {
            self.eventsStream.emit('data', self.generateEvent());
          }, 100);
        }
      }
    };
  },
  getVersion: function (req, res, next) {
    res.json({
      'Arch': 'amd64',
      'GitCommit': 3600720,
      'GoVersion': 'go1.2.1',
      'KernelVersion': '3.13.3-tinycore64', 'Os':'linux', 'Version':'0.9.1'
    });
  },
  pushRepo: function (tags) {
    return function (req, res, next) {
      var repoSplit = req.params.repository.split(':');
      var repo = repoSplit[0];
      var tag = repoSplit[1] || 'latest';
      repo = repo +':'+ tag;
      var name = [req.params.registry, req.params.namespace, repo].filter(exists).join('/');
      var imageId = tags[name];
      if (!imageId) {
        res.set('Connection', 'close');
        res.send(404);
      }
      else {
        res.json(200, { 'stream': 'Successfully pushed' });
      }
    };
  },
  createImage: function (images, tags) {
    return function (req, res, next) {
      var id = utils.randomId();
      var from = req.query.fromImage;
      var emitter = duplexEmitter(res);
      if(!from) {
        emitter.emit({'status':'Downloading from http://'});
        emitter.emit({
          'errorDetail': {
            'message':'Get http://: http: no Host in request URL'
          },
          'error':'Get http://: http: no Host in request URL'
        });
        return res.end();
      }

      images[id] = { id: id };
      tags[from + ':' + (req.query.tag || 'latest')] = id;
      emitter.emit({'status':'The image you are pulling has been verified','id':from});
      for (var i = 0; i < 100; i++) {
        emitter.emit({status: 'Pulling', 'progress': i+' B/ 100 B', 'progressDetail':{'current':i, 'total':100}});
      }
      emitter.emit({status: 'Status: Image is up to date for' + from});
      res.end();
    };
  },
  notYetImplemented: function (req, res, next) {
    res.send(501, 'endpoint not yet implemented: ' + req.method + ' ' + req.path);
  }
};

function exists (v) {
  return v !== undefined && v !== null;
}
