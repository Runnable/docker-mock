#!/usr/bin/env node

var dockerMock = require('./index');
var argv = require('minimist')(process.argv.slice(2));
var port = parseInt(argv.p || argv.port, 10) || 5354;

if(argv.h || argv.help) {
    console.log('Usage: docker-mock [-p=5354]\n       docker-mock -h | --help\n\nOptions:\n    -p, --port  The port to listen on.');
    return;
}

dockerMock.listen(port);
console.log('docker-mock is listening on port %d...', port);
