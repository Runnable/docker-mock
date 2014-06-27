# docker-mock 
# tony is cool and so is sundip

[![Build Status](https://travis-ci.org/Runnable/docker-mock.svg?branch=master)](https://travis-ci.org/Runnable/docker-mock) [![Dependency Status](https://david-dm.org/Runnable/docker-mock.svg)](https://david-dm.org/Runnable/docker-mock) [![devDependency Status](https://david-dm.org/Runnable/docker-mock/dev-status.svg)](https://david-dm.org/Runnable/docker-mock#info=devDependencies)

[![NPM](https://nodei.co/npm/docker-mock.png?compact=true)](https://nodei.co/npm/docker-mock/)

A mock for [Docker](http://docker.io)!

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

## Contributing

This is currently a work in progress, being built up as use cases come to light. If you would like to contribute, please note this repository is using a git-flow pattern, so please submit pull requests against the `develop` branch, and they will be merged into the future release branch and master.

Please make sure all unit tests pass and coverage remains high during development (see below for details).

### Testing

Testing is done locally via `npm test`.

### Coverage

Coverage is done in two ways. First is a readable HTML report:

`npm run coverage`

Second is coverage reported for Travis CI by `travis-cov`. This is invoked via:

`npm run travis`

If you wish to run both to make sure they pass, you can run:

`npm run coverage-all`
