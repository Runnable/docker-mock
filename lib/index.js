var app = require('express')();
var tar = require('tar');
var zlib = require('zlib');
var utils = require('./utils');

var containers = {};
var runningContainers = {};
var images = {};
var tags = {};

app.get('/containers/json', function (req, res, next) {
  var data = [];
  for (var Id in containers) {
    data.push({
      'Id': containers[Id].Id,
      'Image': containers[Id].Image,
      // TODO: extend with other data we may want
    });
  }
  res.json(200, data);
});
app.post('/containers/create', function (req, res, next) {
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
  res.json(201, returnData);
});
app.get('/containers/:id/json', function (req, res, next) {
  var Id = req.params.id;
  if (containers[Id]) res.json(200, containers[Id]);
  else res.send(404);
});
app.get('/containers/:id/top', notYetImplemented);
app.get('/containers/:id/changes', notYetImplemented);
app.get('/containers/:id/export', notYetImplemented);
app.post('/containers/:id/start', function (req, res, next) {
  var Id = req.params.id;
  if (!containers[Id]) return res.json(404);
  if (runningContainers[Id]) return res.json(500);
  var data = {
    // TODO: fill in some data
  };
  runningContainers[Id] = data;
  res.json(204, data);
});
app.post('/containers/:id/stop', function (req, res, next) {
  var Id = req.params.id;
  if (runningContainers[Id]) delete runningContainers[Id];
  res.send(204);
});
app.post('/containers/:id/restart', notYetImplemented);
app.post('/containers/:id/kill', notYetImplemented);
app.post('/containers/:id/attach', notYetImplemented);
app.post('/containers/:id/wait', notYetImplemented);
app.del('/containers/:id', function (req, res, next) {
  var Id = req.params.id;
  delete containers[Id];
  res.send(204);
});
app.post('/containers/:id/copy', notYetImplemented);
app.post('/containers/:id/resize', notYetImplemented);

app.get('/images/json', function (req, res, next) {
  var data = [];
  var repoTags;
  for (var Id in images) {
    repoTags = [];
    for (var tag in tags) {
      if (tags[tag] === Id) repoTags.push(tag);
    }
    data.push({
      'Id': Id,
      'RepoTags': repoTags,
      // TODO: any other data we need
    });
  }
  res.json(200, data);
});
app.post('/images/create', notYetImplemented);
app.post('/images/:name/insert', notYetImplemented);
app.post('/images/:name/json', notYetImplemented);
app.post('/images/:name/history', notYetImplemented);
app.post('/images/:name/push', notYetImplemented);
app.post('/images/:name/tag', notYetImplemented);
app.del('/images/:name', function (req, res, next) {
  var name = req.params.name;
  if (!tags[name]) return res.send(404);
  delete images[tags[name]];
  delete tags[name];
  res.send(200);
});
app.get('/images/search', notYetImplemented);
app.post('/build', function (req, res, next) {
  var foundDockerFile = false;
  var tag = req.query ? req.query.t : false;
  // for a little extra flexability, we'll support gzip
  if (req.headers['content-type'] === 'application/x-gzip') {
    req = req.pipe(zlib.createGunzip());
  }
  req.pipe(tar.Parse()).
    on('entry', function (entry) {
      if (entry.props.path === './Dockerfile') foundDockerFile = true;
    }).
    on('end', function () {
      if (!foundDockerFile) return res.send(500, 'Server Error - A Dockerfile is required.');
      var id = utils.randomId();
      images[id] = true;
      if (tag) tags[tag] = id;
      res.send(200, 'Successfully built ' + id);
    });
});

app.get('/auth', notYetImplemented);
app.get('/info', function (req, res, next) {
  res.json({
   'Containers': containers.length,
   'Images': images.length,
   'Mock': true,
   // TODO: any other information we need?
  });
});
app.get('/version', function (req, res, next) {
  res.json({
    'Arch': 'amd64',
    'GitCommit': 3600720,
    'GoVersion': 'go1.2.1',
    'KernelVersion': '3.13.3-tinycore64', 'Os':'linux', 'Version':'0.9.1'
  });
});
app.post('/commit', notYetImplemented);
app.get('/events', notYetImplemented);
app.get('/images/:name/get', notYetImplemented);
app.post('/images/load', notYetImplemented);

app.get('/notYetImplemented', notYetImplemented);
function notYetImplemented (req, res, next) {
  res.send(500, 'endpoint not yet implemented');
}

app.all('*', function (req, res, next) {
  res.send(404, 'I do not know about that end point. Sorry.');
  console.error(req.method, req.url);
});

module.exports = app;