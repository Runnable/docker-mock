var _ = require('lodash');
var tar = require('tar');
var zlib = require('zlib');
var join = require('path').join;
var utils = require('./utils');
var series = require('middleware-flow').series;
var testFile = './test.txt';
var fs = require('fs');

module.exports = {
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
      if (!req.data.container) return res.send(404);
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
          'Running': false,
          'Pid': -1
        },
        'NetworkSettings': {
          'Ports': {
            '80/tcp':[{HostPort:12322}],
            '15000/tcp':[{HostPort:12321}]
          }
        }
      };
      var returnData = {
        'Id': Id,
        'Warnings': []
      };
      containers[Id] = data;
      req.data = { container: containers[Id] };
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
      if (req.data.container.State.Running) return res.send(500);
      var Id = req.data.container.Id;
      var State = {
        // TODO: more data!
        Running: true,
        Pid: 123
      };
      containers[Id].State = State;
      req.data.container.State = State;
      next();
    };
  },
  stopContainer: function (containers) {
    return function (req, res, next) {
      if (!req.data.container) return res.send(500);
      var Id = req.data.container.Id;
      var State = {
        // TODO: more data!
        Running: false,
        Pid: -1
      };
      containers[Id].State = State;
      req.data.container.State = State;
      next();
    };
  },
  stopAndWaitContainer: function (containers) {
    return series(
      this.stopContainer(containers),
      function (req, res, next) {
        if (!req.data.container) return res.send(500);
        setTimeout(function () {
          res.json(200, { 'StatusCode': 0 });
        }, 25);
      }
    );
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
  respondContainer: function (code, pick) {
    return function (req, res, next) {
      if (!req.data || !req.data.container) return res.send(500);
      if (pick) req.data.container = _.pick(req.data.container, pick);
      if (code && code === 204) res.send(204);
      else res.send(code || 200, req.data.container);
    };
  },
  respondContainers: function (containers) {
    return function (req, res, next) {
      res.json(200, _.map(containers, function (container, Id) {
        return {
          'Id': container.Id,
          'Image': container.Image
          // TODO: extend with other data we may want
        };
      }));
    };
  },
  respondLogStream: function () {
    return function (req, res, next) {
      fs.writeFileSync(testFile, 'Just a bunch of text');
      var stream = fs.createReadStream(testFile);
      stream.pipe(res);
      fs.unlinkSync(testFile);
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
        res.send(404);
      }
      else {
        res.json(200, { 'stream': 'Successfully pushed' });
      }
    };
  },
  notYetImplemented: function (req, res, next) {
    res.send(501, 'endpoint not yet implemented: ' + req.method + ' ' + req.path);
  }
};

function exists (v) {
  return v !== undefined && v !== null;
}
