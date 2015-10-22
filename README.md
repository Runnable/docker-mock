# docker-mock

[![Build Status](https://img.shields.io/travis/Runnable/docker-mock/master.svg?style=flat-square)](https://travis-ci.org/Runnable/docker-mock)
[![Dependency Status](https://img.shields.io/david/Runnable/docker-mock.svg?style=flat-square)](https://david-dm.org/Runnable/docker-mock)
[![devDependency Status](https://img.shields.io/david/dev/Runnable/docker-mock.svg?style=flat-square)](https://david-dm.org/Runnable/docker-mock#info=devDependencies)
[![Code Climate](https://img.shields.io/codeclimate/github/Runnable/docker-mock.svg?style=flat-square)](https://codeclimate.com/github/Runnable/docker-mock)
[![Test Coverage](https://img.shields.io/codeclimate/coverage/github/Runnable/docker-mock.svg?style=flat-square)](https://codeclimate.com/github/Runnable/docker-mock)

[![NPM](https://nodei.co/npm/docker-mock.png?compact=true)](https://nodei.co/npm/docker-mock/)

A mock for [Docker](http://docker.io)!

## Usage

Require it from your node program:

```javascript
var dockerMock = require('docker-mock');
dockerMock.listen(5354);
```

You can also use the command line interface, just run `docker-mock` after installing the package globally.

## Examples

See the tests for some sample usage, but you should be able to point your docker client at this mock and test against it.

## Failures

This does have support for simulating failures during build. This is done (using `dockerode`) by doing the following:

```javascript
// file is a tar containing at minimum a Dockerfile
var file = ...;
docker.buildImage(
  file,
  {
    t: 'doomedImage',
    fail: true
  },
  function (err, res) {
    // err will not be null
  });
```


## Configuration

If you want to disable randomly generated events exposed under `/events` endpoint please use ENV var: `DISABLE_RANDOM_EVENTS=true`.


## Events

You can manually emit docker mock events.

```javascript
  var dockerMock = require('docker-mock');
  dockerMock.listen(5354);
  dockerMock.events.stream.emit('data', JSON.stringify({ status: 'die', from: '..', id: '...', time: '...' }));
  // or
  dockerMock.events.stream.emit('data', dockerMock.events.generateEvent());

```

## Contributing

Please make sure all unit tests pass, lint passes, and coverage remains high during development (see below for details).

### Testing

Testing is done locally via `npm test`.

### Coverage

Coverage is now run by Lab via `npm test`. Output at the bottom shows percent coverage verses a threshold set in `package.json`.
