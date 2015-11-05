#!/usr/bin/env node
'use strict';

var dockerMock = require('../lib');
var argv = require('minimist')(process.argv.slice(2));
var port = parseInt(argv.p || argv.port, 10) || 5354;

main();

function main () {
  if (argv.h || argv.help) {
    console.log('Usage: docker-mock [-p=5354]\n' +
      '       docker-mock -h | --help\n\n' +
      'Options:\n' +
      '   -p, --port  The port to listen on.');
    return;
  }

  dockerMock.listen(port);
  console.log('docker-mock is listening on port %d...', port);
}
