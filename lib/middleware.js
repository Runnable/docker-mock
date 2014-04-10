var _ = require('lodash');
var tar = require('tar');
var zlib = require('zlib');
var join = require('path').join;
var utils = require('./utils');

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
      var name = req.data.repository;
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
      var tag = req.query ? req.query.t : false;
      var intentionalFail = req.query.fail || false;
      // for a little extra flexability, we'll support gzip
      if (req.headers['content-type'] === 'application/x-gzip') {
        req = req.pipe(zlib.createGunzip());
      }
      req.pipe(tar.Parse()).
        on('entry', function (entry) {
          if (entry.props.path === './Dockerfile') foundDockerFile = true;
        }).
        on('end', function () {
          if (intentionalFail) return res.send(500, new Buffer('intentional failure'));
          if (!foundDockerFile) return res.send(500, new Buffer('Server Error - A Dockerfile is required.'));
          var id = utils.randomId();
          images[id] = {
            'id': id
          };
          if (tag) tags[tag] = id;
          res.send(200, new Buffer('Successfully built ' + id));
        });
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
        'ExposedPorts': {}
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
      images[imageId] = {
        'id': imageId,
        'container': container.Id
      };
      if (tag) tags[tag] = imageId;
      req.data = { image: { 'Id': imageId } };
      next();
    };
  },
  startContainer: function (runningContainers) {
    return function (req, res, next) {
      var Id = req.data.container.Id;
      if (!Id) return res.json(500);
      if (runningContainers[Id]) return res.json(500);
      var data = {
        // TODO: fill in some data
      };
      runningContainers[Id] = data;
      res.json(204, data);
    };
  },
  stopContainer: function (runningContainers) {
    return function (req, res, next) {
      var Id = req.data.container.Id;
      if (!Id) return res.send(500);
      if (runningContainers[Id]) delete runningContainers[Id];
      res.send(204);
    };
  },
  deleteContainer: function (containers) {
    return function (req, res, next) {
      if (!req.data.container) return res.send(500);
      var Id = req.data.container.Id;
      delete containers[Id];
      res.send(204);
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
    // console.log(code, pick, typeof req, typeof res, typeof next);
    return function (req, res, next) {
      if (!req.data || !req.data.container) return res.send(500);
      if (pick) req.data.container = _.pick(req.data.container, pick);
      res.json(code || 200, req.data.container);
    };
  },
  respondContainers: function (containers) {
    return function (req, res, next) {
      res.json(200, _.map(containers, function (container, Id) {
        return {
          'Id': container.Id,
          'Image': container.Image,
          // TODO: extend with other data we may want
        };
      }));
    };
  },
  getInfo: function (containers, images) {
    return function (req, res, next) {
      res.json({
       'Containers': _.size(containers),
       'Images': _.size(images),
       'Mock': true,
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
  notYetImplemented: function (req, res, next) {
    res.send(501, 'endpoint not yet implemented: ' + req.method + ' ' + req.path);
  }
};
