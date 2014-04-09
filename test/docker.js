var blanket = require('blanket')({
  'pattern': 'lib',
  'data-cover-never': 'node_modules'
});

var dockerMock = require('../lib/index');
var async = require('async');
var request = require('request');
var tar = require('tar-stream');
var zlib = require('zlib');
dockerMock.listen(5354);

var docker = require('dockerode')({host: 'http://localhost', port: 5354});

describe('containers', function () {
  it('should create and delete a container', function (done) {
    async.waterfall([
      docker.createContainer.bind(docker, {}),
      function (container, cb) {
        container.remove(cb);
      }
    ], done);
  });
  it('should list all the containers when there are none', function (done) {
    docker.listContainers(function (err, containers) {
      if (err) return done(err);
      containers.length.should.equal(0);
      done();
    });
  });
  describe('interactions', function () {
    var container;
    beforeEach(function (done) {
      docker.createContainer({}, function (err, c) {
        if (err) return done(err);
        container = c;
        done();
      });
    });
    afterEach(function (done) {
      container.remove(done);
    });
    it('should list all the containers', function (done) {
      docker.listContainers(function (err, containers) {
        if (err) return done(err);
        containers.length.should.equal(1);
        containers[0].Id.should.equal(container.id);
        done();
      });
    });
    it('should give us information about it', function (done) {
      container.inspect(function (err, data) {
        if (err) return done(err);
        data.Id.should.equal(container.id);
        done();
      });
    });
    it('should error on an unknown container', function (done) {
      docker.getContainer('nope').inspect(function (err, data) {
        if (err) done();
        else done('should have return a 404');
      });
    });
    it('should be able to start it', function (done) {
      container.start(done);
    });
    it('should should not start twice', function (done) {
      container.start(function (err, data) {
        if (err) return done(err);
        container.start(function (err, data) {
          if (err) done();
          else done('should not have started second time');
        });
      });
    });
    it('should be able to stop it', function (done) {
      async.waterfall([
        container.start.bind(container),
        container.stop.bind(container)
      ], done);
    });
    it('should noop if stopped twice', function (done) {
      async.waterfall([
        container.start.bind(container),
        container.stop.bind(container),
        container.stop.bind(container)
      ], done);
    });
  });
});

describe('images', function () {
  it('should be able to build images, and delete it', function (done) {
    var pack = tar.pack();
    pack.entry({ name: './', type: 'directory' });
    pack.entry({ name: './Dockerfile' }, 'FROM ubuntu\nADD ./src /root/src\n');
    pack.entry({ name: './src', type: 'directory' });
    pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
    pack.finalize();
    var image = docker.getImage('buildTest');
    async.series([
      docker.buildImage.bind(docker, pack, { t: 'buildTest' }),
      image.remove.bind(image)
    ], done);
  });
  it('should fail building an image w/o a dockerfile', function (done) {
    var badPack = tar.pack();
    badPack.entry({ name: './', type: 'directory' });
    badPack.entry({ name: './src', type: 'directory' });
    badPack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
    badPack.finalize();
    docker.buildImage(badPack, { t: 'buildTest' }, function (err, data) {
      if (err) done();
      else done('should not have built w/o dockerfile');
    });
  });
  it('should build an image that has been gzipped', function (done) {
    var pack = tar.pack();
    pack.entry({ name: './', type: 'directory' });
    pack.entry({ name: './Dockerfile' }, 'FROM ubuntu\nADD ./src /root/src\n');
    pack.entry({ name: './src', type: 'directory' });
    pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
    pack.finalize();
    pack = pack.pipe(zlib.createGzip());
    var image = docker.getImage('buildTest');
    pack.pipe(request.post({
      url: 'http://localhost:5354/build',
      qs: { 't': 'buildTest' },
      headers: { 'content-type': 'application/x-gzip' }
    })).on('end', function (err, data) {
      if (err) return done(err);
      image.remove(done);
    }); 
  });
  it('should list all the images when there are none', function (done) {
    docker.listImages({}, function (err, images) {
      if (err) return done(err);
      images.length.should.equal(0);
      done();
    });
  });
  describe('interactions', function () {
    beforeEach(function (done) {
      var pack = tar.pack();
      pack.entry({ name: './', type: 'directory' });
      pack.entry({ name: './Dockerfile' }, 'FROM ubuntu\nADD ./src /root/src\n');
      pack.entry({ name: './src', type: 'directory' });
      pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
      pack.finalize();
      docker.buildImage(pack, { t: 'testImage' }, done);
    });
    afterEach(function (done) {
      docker.getImage('testImage').remove(done);
    });
    it('should list all the images', function (done) {
      docker.listImages({}, function (err, images) {
        if (err) return done(err);
        images.length.should.equal(1);
        images[0].RepoTags.length.should.equal(1);
        images[0].RepoTags[0].should.equal('testImage');
        done();
      });
    });
  });
});

describe('misc', function () {
  describe('/info', function () {
    it('should return info data', function (done) {
      docker.info(done);
    });
  });
  describe('/version', function () {
    it('should return version data', function (done) {
      docker.version(done);
    });
  });
});

describe('invalid endpoints', function () {
  describe('not yet implemented', function () {
    it('should respond with an error', function (done) {
      request.get('http://localhost:5354/notYetImplemented', function (err, res) {
        if (err) done(err);
        else if (res.statusCode !== 500) done('should have sent a 500 error');
        else done();
      });
    });
  });
  describe('not a docker endpoint', function () {
    it('should respond with an error', function (done) {
      request.get('http://localhost:5354/_nope', function (err, res) {
        if (err) done(err);
        else if (res.statusCode !== 404) done('should have sent a 404 error');
        else done();
      });
    });
  });
});
