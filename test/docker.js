'use strict';

var JSONStream = require('JSONStream');
var async = require('async');
var concat = require('concat-stream');
var createCount = require('callback-count');
var dockerMock = require('../lib/index');
var eventsStream = require('../lib/middleware').eventsStream;
var noop = require('101/noop');
var request = require('request');
var tar = require('tar-stream');
var zlib = require('zlib');
var fs = require('fs');
var Lab = require('lab');
var lab = exports.lab = Lab.script();

var after = lab.after;
var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var describe = lab.describe;
var expect = require('code').expect;
var it = lab.it;

var server;
before(function (done) {
  server = dockerMock.listen(5354, done);
});
after(function (done) {
  server.close(done);
});

var docker = require('dockerode')({
  host: 'http://localhost',
  port: 5354
});

describe('containers', function () {
  it('should create and delete a container', function (done) {
    async.waterfall([
      docker.createContainer.bind(docker, {}),
      function (container, cb) {
        var count = createCount(cb);
        eventsStream.on('data', expectStatus('destroy', count.inc().next));
        container.remove(count.inc().next);
      }
    ], done);
  });
  it('should create a container with env in the body', function (done) {
    var createData = {
      Env: ['MY_AWESOME_ENV_VARIABLE=inconceivable']
    };
    async.waterfall([
      docker.createContainer.bind(docker, createData),
      function (container, cb) {
        container.inspect(cb);
      }
    ], function (err, containerData) {
      if (err) { return done(err); }
      expect(containerData.Env).to.be.an.array();
      expect(containerData.Env).to.have.length(1);
      expect(containerData.Env[0]).to.equal(createData.Env[0]);
      docker.getContainer(containerData.Id).remove(done);
    });
  });
  it('should list all the containers when there are none', function (done) {
    docker.listContainers(function (err, containers) {
      if (err) { return done(err); }
      expect(containers.length).to.equal(0);
      done();
    });
  });
  describe('labels', function () {
    var container;
    var Labels = {
      type: 'user-container',
      ultimateQuestion: 'batmanvssuperman',
      obviousAnswer: 'superman'
    };
    beforeEach(function (done) {
      docker.createContainer({
        Labels: Labels
      }, function (err, c) {
        if (err) { return done(err); }
        container = c;
        done();
      });
    });
    afterEach(function (done) {
      container.remove(done);
    });
    it('should save Labels on create and respond with Labels on inspect',
    function (done) {
      container.inspect(function (err, data) {
        if (err) { return done(err); }
        expect(data.Config.Labels).to.deep.contain(Labels);
        done();
      });
    });
  });
  describe('interactions', function () {
    var container;
    beforeEach(function (done) {
      docker.createContainer({}, function (err, c) {
        if (err) { return done(err); }
        container = c;
        done();
      });
    });
    afterEach(function (done) {
      container.remove(done);
    });

    it('should list all the containers', function (done) {
      docker.listContainers(function (err, containers) {
        if (err) { return done(err); }
        expect(containers.length).to.equal(1);
        expect(containers[0].Id).to.equal(container.id);
        done();
      });
    });
    it('should give us information about it', function (done) {
      container.inspect(function (err, data) {
        if (err) { return done(err); }
        expect(data.Id).to.equal(container.id);
        done();
      });
    });
    it('should attach to the container', function (done) {
      container.attach({}, function (err, stream) {
        if (err) { return done(err); }
        stream.on('data', noop);
        stream.on('end', function () { done(); });
      });
    });
    it('should error on an unknown container', function (done) {
      docker.getContainer('nope').inspect(function (err) {
        if (err) {
          done();
        } else {
          done('should have return a 404');
        }
      });
    });
    it('should be able to commit a container to an image', function (done) {
      async.waterfall([
        function (cb) {
          container.commit({
            repo: 'committedContainer'
          }, cb);
        },
        function (imageData, cb) {
          var image = docker.getImage('committedContainer');
          image.inspect(function (err, data) {
            if (err) { return cb(err); }
            expect(data.id).to.contain(imageData.Id);
            cb(null, image);
          });
        },
        function (image, cb) {
          image.remove(cb);
        }
      ], done);
    });
    it('should be able to start it', function (done) {
      async.series([
        container.start.bind(container),
        container.inspect.bind(container)
      ], function (err, data) {
        if (err) { return done(err); }
        data = data[1]; // get the inspect data
        expect(data.State.Running).to.be.true();
        expect(data.State.Pid).to.be.a.number();
        done();
      });
    });
    it('should be able to get the logs', function (done) {
      async.series([
        container.start.bind(container),
        container.logs.bind(container, {})
      ], function (err, data) {
        if (err) { return done(err); }
        var logs = data[1];
        var count = createCount(2, done);
        logs.pipe(concat(function (logBuffer) {
          expect(logBuffer.toString()).to.equal('Just a bunch of text');
          count.next();
        }));
        logs.on('end', function () { count.next(); });
      });
    });
    it('should should not start twice', function (done) {
      var originalInspect;
      async.series([
        container.start.bind(container),
        function (cb) {
          container.inspect(function (err, data) {
            originalInspect = data;
            cb(err);
          });
        },
        container.start.bind(container)
      ], function (seriesErr) {
        if (!seriesErr) { return done('should not have started second time'); }
        container.inspect(function (err, data) {
          if (err) { return done(err); }
          expect(data).to.deep.equal(originalInspect);
          done();
        });
      });
    });
    it('should be able to stop it', function (done) {
      async.series([
        container.start.bind(container),
        container.stop.bind(container),
        container.inspect.bind(container)
      ], function (err, data) {
        if (err) { return done(err); }
        data = data[2];
        expect(data.State.Running).to.be.false();
        expect(data.State.Pid).to.equal(0);
        done();
      });
    });
    it('should be able to stop and wait for it to stop', function (done) {
      async.series([
        container.start.bind(container),
        container.wait.bind(container),
        container.inspect.bind(container)
      ], function (err, data) {
        if (err) { return done(err); }
        data = data[2];
        expect(data.State.Running).to.be.false();
        expect(data.State.Pid).to.equal(0);
        done();
      });
    });
    it('should come back with an error if stopped twice', function (done) {
      async.series([
        container.start.bind(container),
        container.stop.bind(container)
      ], function (seriesErr) {
        if (seriesErr) { return done(seriesErr); }
        container.stop(function (stopErr) {
          expect(stopErr.statusCode).to.equal(304);
          container.inspect(function (err, data) {
            if (err) { return done(err); }
            expect(data.State.Running).to.be.false();
            expect(data.State.Pid).to.equal(0);
            done();
          });
        });
      });
    });
    it('should be able to kill it', function (done) {
      async.series([
        container.start.bind(container),
        container.kill.bind(container)
      ], function (seriesErr) {
        if (seriesErr) { return done(seriesErr); }
        container.inspect(function (err, data) {
          if (err) { return done(err); }
          expect(data.State.Running).to.be.false();
          done();
        });
      });
    });
    it('should be able to restart it', function (done) {
      async.series([
        container.start.bind(container),
        container.restart.bind(container)
      ], function (seriesErr) {
        if (seriesErr) { return done(seriesErr); }
        container.inspect(function (err, data) {
          if (err) { return done(err); }
          // FIXME: these test are broken. this does not return true
          expect(data.State.Running).to.be.true();
          done();
        });
      });
    });
  });
});

describe('images', function () {
  describe('image create', function () {
    beforeEach(function (done) {
      var count = createCount(2, done);
      docker.createImage({
        fromImage: 'foo',
        tag: '999',
        Created: 100
      }, function (err, res) {
        if (err) { return done(err); }
        res.on('data', noop);
        count.next();
        docker.createImage({
          fromImage: 'foo2',
          tag: '9992'
        }, function (err2, res2) {
          if (err2) { return done(err2); }
          res2.on('data', noop);
          count.next();
        });
      });
    });
    afterEach(function (done) {
      var count = createCount(2, done);
      docker.listImages(function (err, images) {
        if (err) { return done(err); }
        docker.getImage(images[0].Id).remove(count.next);
        docker.getImage(images[1].Id).remove(count.next);
      });
    });
    it('should allow image mocking of Created timestamp', function (done) {
      docker.listImages(function (err, images) {
        if (err) { return done(err); }
        expect(images).to.have.length(2);
        expect(images[0].Created).to.equal(100);
        expect(images[1].Created).to.be.about(new Date() / 1000 | 0, 10);
        done();
      });
    });
  });

  it('should be able to build images, and delete it', function (done) {
    var pack = tar.pack();
    pack.entry({ name: './', type: 'directory' });
    pack.entry({ name: './Dockerfile' }, 'FROM ubuntu\nADD ./src /root/src\n');
    pack.entry({ name: './src', type: 'directory' });
    pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
    pack.finalize();
    var image = docker.getImage('buildTest');
    docker.buildImage(pack, { t: 'buildTest' }, watchBuild(image, done));
  });
  it('should emulate a build failure', function (done) {
    var pack = tar.pack();
    pack.entry({ name: './', type: 'directory' });
    pack.entry({ name: './Dockerfile' }, 'FROM ubuntu\nADD ./src /root/src\n');
    pack.entry({ name: './src', type: 'directory' });
    pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
    pack.finalize();
    docker.buildImage(
      pack,
      { t: 'doomedImage', fail: true },
      watchBuildFail(done));
  });
  it('should be able to build images with namespace/repository, and delete it',
    function (done) {
      var pack = tar.pack();
      pack.entry({ name: './', type: 'directory' });
      pack.entry({ name: './Dockerfile' },
        'FROM ubuntu\nADD ./src /root/src\n');
      pack.entry({ name: './src', type: 'directory' });
      pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
      pack.finalize();
      var image = docker.getImage('docker-mock/buildTest');
      docker.buildImage(
        pack,
        { t: 'docker-mock/buildTest' },
        watchBuild(image, done));
    }
  );
  it('should be able to build images with registry/namespace/repository, ' +
    'and delete it',
    function (done) {
      var pack = tar.pack();
      pack.entry({ name: './', type: 'directory' });
      pack.entry({ name: './Dockerfile' },
        'FROM ubuntu\nADD ./src /root/src\n');
      pack.entry({ name: './src', type: 'directory' });
      pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
      pack.finalize();
      var image = docker.getImage('private.com/docker-mock/buildTest');
      docker.buildImage(pack,
        { t: 'private.com/docker-mock/buildTest' },
        watchBuild(image, done));
    }
  );
  it('should fail building an image w/o a dockerfile', function (done) {
    var badPack = tar.pack();
    badPack.entry({ name: './', type: 'directory' });
    badPack.entry({ name: './src', type: 'directory' });
    badPack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
    badPack.finalize();
    docker.buildImage(badPack, { t: 'buildTest' }, watchBuildFail(done));
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
    })).on('end', function (err) {
      if (err) { return done(err); }
      image.remove(done);
    });
  });
  it('should list all the images when there are none', function (done) {
    docker.listImages({}, function (err, images) {
      if (err) { return done(err); }
      expect(images).to.have.length(0);
      done();
    });
  });
  describe('image pulling', function () {
    it('should pull image', function (done) {
      docker.pull('my/repo:tag', handleStream(function (err) {
        if (err) { return done(err); }
        docker.getImage('my/repo:tag').remove(done);
      }));
    });
    it('should pull image without a tag', function (done) {
      docker.pull('my/repo', handleStream(function (err) {
        if (err) { return done(err); }
        docker.getImage('my/repo').remove(done);
      }));
    });
    it('should error if invalid image', function (done) {
      docker.pull('', function (err, stream) {
        if (err) { return done(err); }
        stream.on('data', function (data) {
          data = JSON.parse(data);
          if (data[0] && data[0].error && data[0].errorDetail) {
            done();
          }
        });
        stream.on('end', noop);
      });
    });
  });
  describe('interactions', function () {
    beforeEach(function (done) {
      var pack = tar.pack();
      pack.entry({ name: './', type: 'directory' });
      pack.entry({ name: './Dockerfile' },
        'FROM ubuntu\nADD ./src /root/src\n');
      pack.entry({ name: './src', type: 'directory' });
      pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
      pack.finalize();
      docker.buildImage(pack, { t: 'testImage' }, watchBuild(done));
    });
    beforeEach(function (done) {
      var pack = tar.pack();
      pack.entry({ name: './', type: 'directory' });
      pack.entry({ name: './Dockerfile' },
        'FROM ubuntu\nADD ./src /root/src\n');
      pack.entry({ name: './src', type: 'directory' });
      pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
      pack.finalize();
      docker.buildImage(
        pack,
        { t: 'somedomain.tld/username/testImage:tag' },
        watchBuild(done));
    });
    afterEach(function (done) {
       docker.listImages(function (err, images) {
        if (err) { return done(err); }
        var count = createCount(images.length, done);
        images.forEach(function (i) {
          docker.getImage(i.Id).remove(count.next);
        });
      });
    });
    it('should list all the images', function (done) {
      docker.listImages(function (err, images) {
        if (err) { return done(err); }
        expect(images).to.have.length(2);
        expect(images[0].RepoTags).to.have.length(1);
        expect(images[0].RepoTags[0]).to.equal('testImage:latest');
        expect(images[0].Created).to.be.a.number();
        expect(images[0].Created).to.be.about(new Date() / 1000 | 0, 10);
        done();
      });
    });
    it('should 404 on save image if it does not exist', function (done) {
      docker.getImage('fake').get(function (err, res) {
        expect(err.statusCode).to.equal(404);
        done();
      });
    });
    it('should save an image', function (done) {
      docker.getImage('testImage').get(handleStream(done));
    });
    it('should load an image', function (done) {
      var imageStream = fs.createReadStream('misc/busybox.tar');
      docker.loadImage(imageStream, function (err) {
        if (err) { return done(err); }
        docker.listImages(function (err, images) {
          if (err) { return done(err); }
          expect(images).to.have.length(5);
          done();
        });
      });
    });
    it('should push an image', function (done) {
      docker.getImage('testImage')
        .push({}, handleStream(done));
    });
    it('should push an image with a tag, name, user, domain', function (done) {
      docker.getImage('somedomain.tld/username/testImage:tag')
        .push({}, handleStream(done));
    });
    it('should get an images history', function (done) {
      docker.getImage('testImage')
        .history(function (err, history) {
          if (err) { return done(err); }
          expect(history).to.have.length(1);
          done();
        });
    });
    it('should 404 an image that does not exist', function (done) {
      docker.getImage('nopeImage')
        .history(function (err) {
          if (!err) { return done(new Error('expected an error')); }
          expect(err.statusCode).to.equal(404);
          done();
        });
    });
    it('should not push an image if it doesnt exist', function (done) {
      docker.getImage('nonexistantImage')
        .push({}, handleStream(function (err) {
          expect(err.statusCode).to.equal(404);
          done();
        }));
    });
    describe('private', function () {
      var repo;
      beforeEach(function (done) {
        var pack = tar.pack();
        pack.entry({ name: './', type: 'directory' });
        pack.entry({ name: './Dockerfile' },
          'FROM ubuntu\nADD ./src /root/src\n');
        pack.entry({ name: './src', type: 'directory' });
        pack.entry({ name: './src/index.js' }, 'console.log(\'hello\');\n');
        pack.finalize();
        repo = 'private.com/hey/testImage';
        docker.buildImage(pack, { t: repo }, watchBuild(done));
      });
      afterEach(function (done) {
        docker.getImage(repo).remove(done);
      });
      it('should push a private image', function (done) {
        docker.getImage(repo)
          .push({}, handleStream(done));
      });
      it('should not push a private image if it doesnt exist', function (done) {
        docker.getImage('private.com/hey/nonexistantImage')
          .push({}, handleStream(function (err) {
            expect(err.statusCode).to.equal(404);
            done();
          }));
      });
    });
  });
});

describe('events', function () {
  it('should return one time result when since is provided', function (done) {
    docker.getEvents(
      { since: new Date().getTime() },
      function (err, eventStream) {
        if (err) { return done(err); }
        var count = createCount(100, done);
        eventStream.pipe(JSONStream.parse()).on('data', function (json) {
          expect(json.status).to.be.a.string();
          expect(json.id).to.be.a.string();
          expect(json.from).to.be.a.string();
          expect(json.time).to.be.a.number();
          count.next();
        });
      }
    );
  });

  it('should return one time result when until is provided', function (done) {
    docker.getEvents(
      { until: new Date().getTime() },
      function (err, eventStream) {
        if (err) { return done(err); }
        var count = createCount(100, done);
        eventStream.pipe(JSONStream.parse()).on('data', function (json) {
          expect(json.status).to.be.a.string();
          expect(json.id).to.be.a.string();
          expect(json.from).to.be.a.string();
          expect(json.time).to.be.a.number();
          count.next();
        });
      }
    );
  });

  it('should stream emitted events', function (done) {
    process.env.DISABLE_RANDOM_EVENTS = true;
    var interval = setInterval(function () {
      dockerMock.events.stream.emit('data', dockerMock.events.generateEvent());
    }, 10);
    docker.getEvents(function (err, eventStream) {
      if (err) { return done(err); }
      var count = createCount(10, function () {
        clearInterval(interval);
        done();
      });
      var i = 0;
      eventStream.on('data', function (data) {
        var json = JSON.parse(data.toString());
        expect(json.status).to.be.a.string();
        expect(json.id).to.be.a.string();
        expect(json.from).to.be.a.string();
        expect(json.time).to.be.a.number();
        if (i < 10) {
          count.next();
        } else {
          eventStream.destroy();
        }
        i++;
      });
    });
  });

  it('should emit create, start, kill, start, restart, stop real events',
    function (done) {
      process.env.DISABLE_RANDOM_EVENTS = true;
      var container;
      var numEvents = 11;
      var count = createCount(numEvents, done);
      docker.getEvents(function (err, eventStream) {
        if (err) { return done(err); }
        var i = 0;
        eventStream.on('data', function (data) {
          var json = JSON.parse(data.toString());
          if (i === 0) {
            expect(json.status).to.equal('create');
          }
          if (i === 1) {
            expect(json.status).to.equal('start');
          }
          if (i === 2) {
            expect(json.status).to.equal('die');
          }
          if (i === 3) {
            expect(json.status).to.equal('kill');
          }
          if (i === 4) {
            expect(json.status).to.equal('start');
          }
          if (i === 5) {
            expect(json.status).to.equal('die');
          }
          if (i === 6) {
            expect(json.status).to.equal('start');
          }
          if (i === 7) {
            expect(json.status).to.equal('restart');
          }
          if (i === 8) {
            expect(json.status).to.equal('die');
          }
          if (i === 9) {
            expect(json.status).to.equal('stop');
          }
          if (i === 10) {
            expect(json.status).to.equal('destroy');
          }
          expect(json.status).to.be.a.string();
          expect(json.id).to.be.a.string();
          expect(json.from).to.be.a.string();
          expect(json.time).to.be.a.number();
          if (i < numEvents) {
            count.next();
          } else {
            eventStream.destroy();
          }
          i++;
        });
      });
      docker.createContainer({}, function (err, c) {
        if (err) { return done(err); }
        container = c;
        async.series([
          container.start.bind(container),
          container.kill.bind(container),
          container.start.bind(container),
          container.restart.bind(container),
          container.stop.bind(container),
          container.remove.bind(container)
        ], function (seriesErr) {
          if (seriesErr) { return done(seriesErr); }
        });
      });
    }
  );

  it('should stream random generated events', function (done) {
    delete process.env.DISABLE_RANDOM_EVENTS;
    var count = createCount(5, done);
    docker.getEvents(function (err, eventStream) {
      if (err) { return done(err); }
      var i = 0;
      eventStream.on('data', function (data) {
        var json = JSON.parse(data.toString());
        expect(json.status).to.be.a.string();
        expect(json.id).to.be.a.string();
        expect(json.from).to.be.a.string();
        expect(json.time).to.be.a.number();
        if (i < 5) {
          count.next();
        } else {
          eventStream.destroy();
        }
        i++;
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
  it('should respond with an error', function (done) {
    request.get('http://localhost:5354/_nope', function (err, res) {
      if (err && res.statusCode === 501) {
        done(err);
      } else if (res.statusCode !== 501) {
        done('should have sent a 501 error');
      } else {
        done();
      }
    });
  });
});

// make sure we are starting with a clean mock
// (tests should clean-up after themselves)
beforeEach(checkClean);

function checkClean (cb) {
  // the repository should be clean!
  async.parallel([
    checkImages,
    checkContainers,
    checkInfo
  ], function (err) {
    cb(err);
  });
}

function checkImages (cb) {
  async.waterfall([
    docker.listImages.bind(docker, {}),
    function (images, _cb) {
      expect(images.length).to.equal(0);
      _cb();
    }
  ], cb);
}

function checkContainers (cb) {
  async.waterfall([
    docker.listContainers.bind(docker),
    function (containers, _cb) {
      expect(containers.length).to.equal(0);
      _cb();
    }
  ], cb);
}

function checkInfo (cb) {
  async.waterfall([
    docker.info.bind(docker),
    function (data, _cb) {
      expect(data.Containers).to.equal(0);
      expect(data.Images).to.equal(0);
      expect(data.Mock).to.be.true();
      _cb();
    }
  ], cb);
}

function watchBuild (removeImage, cb) {
  if (typeof removeImage === 'function') {
    cb = removeImage;
    removeImage = false;
  }
  return function (err, res) {
    if (err) { return cb(err); }
    res.on('data', noop);
    res.on('end', function () {
      if (removeImage) {
        removeImage.remove(cb);
      } else {
        cb();
      }
    });
  };
}

function watchBuildFail (cb) {
  return function (err) {
    if (err && err.statusCode === 500) {
      cb();
    } else {
      cb('expected to fail');
    }
  };
}

function handleStream (cb) {
  return function (funcErr, res) {
    if (funcErr) {
      cb(funcErr);
    } else {
      var errorred = false;
      res.on('error', function (err) {
        errorred = err;
        cb(err);
      });
      res.on('data', noop);
      res.on('end', function () {
        if (!errorred) {
          cb();
        }
      });
    }
  };
}

function expectStatus (status, cb) {
  return function handler (data) {
    var json = JSON.parse(data);
    if (json.status === status) {
      eventsStream.removeListener('data', handler);
      cb();
    }
  };
}
